import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import type { ChatMessage, InvokeOptions, InvokeResult, LLMAdapter } from '../types'
import { ptyManager } from '../../terminal/PtyManager'
import { PromptResponder } from '../prompt-responder'
import { prepareCliBeforeRun, getInitialInputForCli } from '../cli-setup'

export interface CliAdapterToolDefaults {
  staticArgs: string[]
  modelFlag: string | null
  envVars: Record<string, string>
  // For some CLIs, the model id is positional (ollama), no flag.
  modelAsPositional?: boolean
  // Non-interactive CLIs (print mode). We pipe prompt via stdin and close it
  // instead of going through PTY + responder + nudges (which corrupt these flows).
  nonInteractive?: boolean
  // How to deliver the prompt for non-interactive CLIs:
  //  - 'stdin': write to stdin then close
  //  - 'lastArg': append the prompt as the last positional argv (default for some CLIs that don't read stdin)
  promptDelivery?: 'stdin' | 'lastArg'
}

export const TOOL_DEFAULTS: Record<string, CliAdapterToolDefaults> = {
  claude: {
    // claude -p reads the prompt from argv. No --verbose: it appends to a log file that
    // can lock between invocations on WSL/macOS.
    staticArgs: ['-p', '--dangerously-skip-permissions'],
    modelFlag: '--model',
    envVars: { CI: 'true', NO_COLOR: '1', FORCE_COLOR: '0' },
    nonInteractive: true,
    promptDelivery: 'lastArg',
  },
  codex: {
    staticArgs: ['exec', '--full-auto', '--skip-git-repo-check'],
    modelFlag: '--model',
    envVars: { CI: 'true', RUST_LOG: 'info', NO_COLOR: '1' },
    nonInteractive: true,
    promptDelivery: 'lastArg',
  },
  gemini: {
    staticArgs: ['-y', '-p'],
    modelFlag: '-m',
    envVars: { CI: 'true', TERM: 'dumb', NO_COLOR: '1' },
    nonInteractive: true,
    promptDelivery: 'lastArg',
  },
  llm: {
    staticArgs: [],
    modelFlag: '-m',
    envVars: { CI: 'true' },
    nonInteractive: true,
    promptDelivery: 'lastArg',
  },
  aider: {
    staticArgs: [
      '--yes-always', '--no-pretty', '--no-show-model-warnings',
      '--no-auto-commits', '--no-git', '--message',
    ],
    modelFlag: '--model',
    envVars: { CI: 'true', AIDER_VERBOSE: '0', TERM: 'dumb', NO_COLOR: '1' },
    nonInteractive: true,
    promptDelivery: 'lastArg',
  },
  opencode: {
    staticArgs: ['run'],
    modelFlag: '--model',
    envVars: { OPENCODE_YOLO: 'true', CI: 'true' },
  },
  openclaw: {
    staticArgs: ['run'],
    modelFlag: '--model',
    envVars: { OPENCODE_YOLO: 'true', CI: 'true' },
  },
  ollama: {
    staticArgs: ['run'],
    modelFlag: null,
    envVars: {},
    modelAsPositional: true,
    nonInteractive: true,
    promptDelivery: 'stdin',
  },
}

export interface CliAdapterOpts {
  id: string
  label: string
  command: string
  modelId?: string
}

export const ARG_LIMIT_BYTES = 50_000
const RAW_OUTPUT_CAP = 60_000
// Legacy PTY-interactive constants — claude can think for several minutes before first byte.
const COLD_TIMEOUT_MS = parseInt(process.env.OPENLINA_CLI_COLD_MS || '', 10) || 5 * 60_000
const WARM_TIMEOUT_MS = parseInt(process.env.OPENLINA_CLI_WARM_MS || '', 10) || 3 * 60_000
const WALL_TIMEOUT_MS = parseInt(process.env.OPENLINA_CLI_WALL_MS || '', 10) || 20 * 60_000

const BAILOUT_PATTERNS: RegExp[] = [
  /trusted directory/i,
  /no prompt provided/i,
  /unauthorized/i,
  /rate limit/i,
  /not authenticated/i,
  /please run.*(login|auth)/i,
]

function buildPrompt(messages: ChatMessage[]): string {
  const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const dialog = messages
    .filter((m) => m.role !== 'system')
    .map((m) => (m.role === 'user' ? `USER:\n${m.content}` : `ASSISTANT:\n${m.content}`))
    .join('\n\n')
  return [sys, dialog].filter(Boolean).join('\n\n---\n\n')
}

function capOutput(s: string): string {
  if (s.length <= RAW_OUTPUT_CAP) return s
  const head = s.slice(0, RAW_OUTPUT_CAP / 2)
  const tail = s.slice(-RAW_OUTPUT_CAP / 2)
  return `${head}\n\n[... ${s.length - RAW_OUTPUT_CAP} bytes truncated ...]\n\n${tail}`
}

export function createCliAdapter(opts: CliAdapterOpts): LLMAdapter {
  const defaults = TOOL_DEFAULTS[opts.command] || {
    staticArgs: [],
    modelFlag: null,
    envVars: { CI: 'true' },
  }

  return {
    id: opts.id,
    label: opts.label,
    providerType: 'cli',
    cliCommand: opts.command,
    modelId: opts.modelId,
    async invoke(invoke: InvokeOptions): Promise<InvokeResult> {
      const prompt = buildPrompt(invoke.messages)

      // Build CLI args
      const args: string[] = [...defaults.staticArgs]
      const model = invoke.modelOverride || opts.modelId
      if (defaults.modelAsPositional && model) {
        args.push(model)
      } else if (defaults.modelFlag && model) {
        args.push(defaults.modelFlag, model)
      }

      // Pre-flight (TOS dialogs, settings, etc.)
      try { await prepareCliBeforeRun(opts.command) } catch {}

      const cwd = invoke.cwd || process.cwd()
      const env: NodeJS.ProcessEnv = { ...process.env, ...defaults.envVars }

      // ── Non-interactive path: claude/codex/etc. need a real TTY (even in -p mode)
      // or they hang on subsequent invocations. We use PTY but skip responder/nudges/script-wrap.
      if (defaults.nonInteractive) {
        let delivery = defaults.promptDelivery || 'stdin'
        const promptBytes = Buffer.byteLength(prompt, 'utf8')
        if (delivery === 'lastArg' && promptBytes > ARG_LIMIT_BYTES) {
          delivery = 'stdin'
        }
        const finalArgs = [...args]
        if (delivery === 'lastArg') finalArgs.push(prompt)
        const banner =
          `$ cd ${cwd}\n` +
          Object.entries(defaults.envVars).map(([k, v]) => `$ export ${k}=${v}`).join('\n') +
          (Object.keys(defaults.envVars).length ? '\n' : '') +
          `$ ${opts.command} ${finalArgs.map((a, i) => (a.length > 200 ? `\\\n  '''${a}'''` : shellEscape(a))).join(' ')}\n\n`
        invoke.onChunk?.(banner)
        const sessionId = invoke.sessionId || `cli_${opts.id}_${Date.now()}`
        invoke.onSession?.(sessionId)
        return runNonInteractivePty({
          sessionId,
          command: opts.command,
          args: finalArgs,
          cwd, env,
          stdinPayload: delivery === 'stdin' ? prompt : null,
          modelLabel: opts.label,
          signal: invoke.signal,
          onChunk: invoke.onChunk,
        })
      }

      // ── Interactive PTY path (opencode, openclaw, anything custom) ──
      const useStdin = Buffer.byteLength(prompt, 'utf8') > ARG_LIMIT_BYTES
      const initialInput = useStdin ? prompt : (invoke.stdinInput || getInitialInputForCli(opts.command))
      if (!useStdin) args.push(prompt)

      const banner =
        `$ cd ${cwd}\n` +
        Object.entries(defaults.envVars).map(([k, v]) => `$ export ${k}=${v}`).join('\n') +
        (Object.keys(defaults.envVars).length ? '\n' : '') +
        `$ ${opts.command} ${args.map((a) => (a.length > 200 ? '<prompt>' : a)).join(' ')}\n\n`
      invoke.onChunk?.(banner)

      const useScriptWrap = process.platform === 'linux'
      const sessionId = invoke.sessionId || `cli_${opts.id}_${Date.now()}`
      invoke.onSession?.(sessionId)

      const responder = new PromptResponder(opts.command)
      let realOutput = ''
      let lastRealAt = 0
      let coldStarted = Date.now()
      let everSawReal = false
      const ECHO_GRACE_BYTES = initialInput ? Buffer.byteLength(initialInput, 'utf8') + 32 : 0
      let bytesSeen = 0

      const cmdToRun = useScriptWrap ? 'script' : opts.command
      const argsToRun = useScriptWrap
        ? ['-qc', `${shellEscape(opts.command)} ${args.map(shellEscape).join(' ')}`, '/dev/null']
        : args

      const session = await ptyManager.spawn({
        sessionId,
        command: cmdToRun,
        args: argsToRun,
        cwd,
        env,
        cols: 120,
        rows: 32,
      })

      let resolved = false
      let nudge4Sent = false
      let nudge8Sent = false
      let timer: NodeJS.Timeout | null = null

      return new Promise<InvokeResult>((resolve, reject) => {
        const cleanup = (final: () => void) => {
          if (resolved) return
          resolved = true
          if (timer) clearInterval(timer)
          try { ptyManager.kill(sessionId) } catch {}
          final()
        }

        const onAbort = () => cleanup(() => reject(new Error('aborted')))
        invoke.signal?.addEventListener?.('abort', onAbort, { once: true })

        ptyManager.onData(sessionId, (data: string) => {
          bytesSeen += data.length
          // Handle responder first
          const replied = responder.feed(data, (reply) => {
            try { ptyManager.write(sessionId, reply) } catch {}
            invoke.onChunk?.(`\n[responder] sent: ${JSON.stringify(reply)}\n`)
          })
          // Strip echo grace
          if (!everSawReal && bytesSeen <= ECHO_GRACE_BYTES) {
            invoke.onChunk?.(data)
            return
          }
          // Real output
          everSawReal = true
          lastRealAt = Date.now()
          realOutput += data
          invoke.onChunk?.(data)

          // Bailout heuristics
          if (realOutput.length < 400) {
            for (const pat of BAILOUT_PATTERNS) {
              if (pat.test(realOutput)) {
                cleanup(() => reject(new Error(`cli bailout: ${pat}`)))
                return
              }
            }
          }
          if (replied) lastRealAt = Date.now()
        })

        // Write stdin if needed (after first event loop tick to let pty settle)
        if (initialInput || useStdin) {
          setTimeout(() => {
            try {
              if (useStdin) {
                ptyManager.write(sessionId, prompt)
              }
              if (initialInput && !useStdin) {
                // small initial nudge for some CLIs
                ptyManager.write(sessionId, initialInput)
              }
            } catch {}
          }, 50)
        }

        // Idle / wall-clock watchdogs
        timer = setInterval(() => {
          const now = Date.now()
          if (now - coldStarted > WALL_TIMEOUT_MS) {
            cleanup(() => reject(new Error('cli wall-clock timeout (20m)')))
            return
          }
          if (!everSawReal) {
            const cold = now - coldStarted
            if (!nudge4Sent && cold > 4_000) {
              nudge4Sent = true
              try { ptyManager.write(sessionId, 'Y\r') } catch {}
            }
            if (!nudge8Sent && cold > 8_000) {
              nudge8Sent = true
              try { ptyManager.write(sessionId, '\r') } catch {}
            }
            if (cold > COLD_TIMEOUT_MS) {
              cleanup(() => reject(new Error('cli cold timeout (no output 120s)')))
            }
            return
          }
          if (now - lastRealAt > WARM_TIMEOUT_MS) {
            cleanup(() => reject(new Error('cli warm timeout (5m no output)')))
          }
        }, 1_000)

        ptyManager.onExit(sessionId, (code) => {
          cleanup(() => {
            if (!everSawReal) {
              reject(new Error(`cli exited (code=${code}) without real output`))
              return
            }
            resolve({
              text: capOutput(realOutput),
              modelLabel: opts.label,
              providerType: 'cli',
              sessionId,
            })
          })
        })
      })
    },
  }
}

function shellEscape(s: string): string {
  if (s.length === 0) return "''"
  if (/^[A-Za-z0-9_\-./=:@%+]+$/.test(s)) return s
  return `'${s.replace(/'/g, `'\\''`)}'`
}

interface RunNonInteractiveArgs {
  sessionId?: string
  command: string
  args: string[]
  cwd: string
  env: NodeJS.ProcessEnv
  stdinPayload: string | null
  modelLabel: string
  signal?: AbortSignal
  onChunk?: (delta: string) => void
}

// Cool-down between successive invocations of the same CLI. Some CLIs (notably claude)
// keep a background daemon / state-db lock that lingers for ~1s after the foreground
// process exits — invoking the next one too fast results in silent hangs.
const lastInvocationAt = new Map<string, number>()
const COOL_DOWN_MS = 1_500

async function runNonInteractivePty(opts: RunNonInteractiveArgs): Promise<InvokeResult> {
  const last = lastInvocationAt.get(opts.command) || 0
  const wait = Math.max(0, COOL_DOWN_MS - (Date.now() - last))
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastInvocationAt.set(opts.command, Date.now())

  const sessionId = opts.sessionId || `pty_${opts.command}_${Date.now()}`
  await ptyManager.spawn({
    sessionId,
    command: opts.command,
    args: opts.args,
    cwd: opts.cwd,
    env: opts.env,
    cols: 200,
    rows: 50,
  })

  return new Promise<InvokeResult>((resolve, reject) => {
    let resolved = false
    let realOutput = ''
    let lastOutputAt = Date.now()
    let everSawOutput = false
    const startedAt = Date.now()
    let heartbeat: NodeJS.Timeout | null = null

    const finalize = (err: Error | null) => {
      if (resolved) return
      resolved = true
      clearInterval(watcher)
      if (heartbeat) clearInterval(heartbeat)
      try { ptyManager.kill(sessionId) } catch {}
      if (err) return reject(err)
      resolve({
        text: capOutput(realOutput),
        modelLabel: opts.modelLabel,
        providerType: 'cli',
        sessionId,
      })
    }

    opts.signal?.addEventListener?.('abort', () => finalize(new Error('aborted')), { once: true })

    ptyManager.onData(sessionId, (data: string) => {
      realOutput += data
      everSawOutput = true
      lastOutputAt = Date.now()
      opts.onChunk?.(data)
    })
    ptyManager.onExit(sessionId, (code: number) => {
      if (!everSawOutput) {
        return finalize(new Error(`${opts.command} exited (code=${code}) with no output`))
      }
      finalize(null)
    })

    if (opts.stdinPayload != null) {
      setTimeout(() => {
        try {
          ptyManager.write(sessionId, opts.stdinPayload!)
          ptyManager.write(sessionId, '\x04') // EOF after the payload
        } catch {}
      }, 100)
    } else {
      // For lastArg delivery, give the CLI ~2s to start reading argv, then send Ctrl-D
      // to signal EOF on stdin. Many CLIs (claude included) won't start streaming output
      // until they're sure no stdin is coming.
      setTimeout(() => {
        if (resolved) return
        try { ptyManager.write(sessionId, '\x04') } catch {}
      }, 2_000)
    }

    // Heartbeat with adaptive cadence so a 5-min cold doesn't spam 30 lines.
    // First minute → every 15s; up to 5min → every 30s; beyond → every 60s.
    let lastHeartbeatAt = Date.now()
    heartbeat = setInterval(() => {
      if (resolved) return
      if (everSawOutput) { if (heartbeat) clearInterval(heartbeat); heartbeat = null; return }
      const elapsedMs = Date.now() - startedAt
      const interval = elapsedMs < 60_000 ? 15_000 : elapsedMs < 5 * 60_000 ? 30_000 : 60_000
      if (Date.now() - lastHeartbeatAt < interval) return
      lastHeartbeatAt = Date.now()
      const elapsed = (elapsedMs / 1000).toFixed(0)
      opts.onChunk?.(`\r\n\x1b[33m⌛ ${opts.command} thinking — ${elapsed}s elapsed, no first byte yet…\x1b[0m\r\n`)
    }, 5_000)

    // Timeouts are intentionally generous because claude can spend 1–3 minutes "thinking"
    // before it starts streaming. Override via env vars for tighter loops in CI.
    const COLD = parseInt(process.env.OPENLINA_CLI_COLD_MS || '', 10) || 5 * 60_000
    const WARM = parseInt(process.env.OPENLINA_CLI_WARM_MS || '', 10) || 3 * 60_000
    const WALL = parseInt(process.env.OPENLINA_CLI_WALL_MS || '', 10) || 20 * 60_000
    const watcher = setInterval(() => {
      const now = Date.now()
      if (now - startedAt > WALL) return finalize(new Error(`${opts.command} wall-clock timeout (${(WALL/60_000).toFixed(0)}m)`))
      if (!everSawOutput && now - startedAt > COLD) return finalize(new Error(`${opts.command} cold timeout (${(COLD/1000).toFixed(0)}s no first byte)`))
      if (everSawOutput && now - lastOutputAt > WARM) return finalize(new Error(`${opts.command} warm timeout (${(WARM/60_000).toFixed(0)}m no progress since last byte)`))
    }, 1_000)
  })
}

async function runNonInteractive(opts: RunNonInteractiveArgs): Promise<InvokeResult> {
  const last = lastInvocationAt.get(opts.command) || 0
  const wait = Math.max(0, COOL_DOWN_MS - (Date.now() - last))
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastInvocationAt.set(opts.command, Date.now())

  return new Promise<InvokeResult>((resolve, reject) => {
    // Always pipe stdin (even when we have no payload). Some CLIs check isatty(0)
    // and refuse to do anything if it's 'ignore'. Closing the pipe immediately
    // gives them a clean EOF instead.
    const child = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    })

    let resolved = false
    let realOutput = ''
    let stderrTail = ''
    let lastOutputAt = Date.now()
    let everSawOutput = false
    const startedAt = Date.now()

    const killTree = (sig: NodeJS.Signals) => {
      try {
        const pid = child.pid
        if (!pid) return
        try { process.kill(-pid, sig) }
        catch { try { child.kill(sig) } catch {} }
      } catch {}
    }
    const finalize = (err: Error | null) => {
      if (resolved) return
      resolved = true
      clearInterval(watcher)
      // SIGTERM, then SIGKILL after 500ms — gives graceful shutdown a chance,
      // guarantees no zombie claude processes blocking subsequent invocations.
      killTree('SIGTERM')
      setTimeout(() => killTree('SIGKILL'), 500)
      if (err) {
        // Always surface stderr tail on errors — claude often reports auth / rate limit issues there.
        const tail = stderrTail.trim().slice(-600)
        if (tail && !err.message.includes(tail.slice(0, 80))) {
          err = new Error(`${err.message}${tail ? `\n--- ${opts.command} stderr ---\n${tail}` : ''}`)
        }
        return reject(err)
      }
      resolve({
        text: capOutput(realOutput),
        modelLabel: opts.modelLabel,
        providerType: 'cli',
      })
    }

    opts.signal?.addEventListener?.('abort', () => finalize(new Error('aborted')), { once: true })

    child.stdout?.on('data', (d: Buffer) => {
      const s = d.toString()
      realOutput += s
      everSawOutput = true
      lastOutputAt = Date.now()
      opts.onChunk?.(s)
    })
    child.stderr?.on('data', (d: Buffer) => {
      const s = d.toString()
      stderrTail = (stderrTail + s).slice(-4000)
      lastOutputAt = Date.now()
      opts.onChunk?.(s)
    })
    child.on('error', (err) => finalize(err))
    child.on('exit', (code) => {
      if (!everSawOutput) {
        return finalize(new Error(`${opts.command} exited (code=${code}) with no output. stderr tail: ${stderrTail.slice(-500)}`))
      }
      finalize(null)
    })

    // Watchdogs (configurable via env for tighter CI loops)
    const COLD = parseInt(process.env.OPENLINA_CLI_COLD_MS || '', 10) || 5 * 60_000
    const WARM = parseInt(process.env.OPENLINA_CLI_WARM_MS || '', 10) || 3 * 60_000
    const WALL = parseInt(process.env.OPENLINA_CLI_WALL_MS || '', 10) || 20 * 60_000
    const watcher = setInterval(() => {
      const now = Date.now()
      if (now - startedAt > WALL) return finalize(new Error(`${opts.command} wall-clock timeout (${(WALL/60_000).toFixed(0)}m)`))
      if (!everSawOutput && now - startedAt > COLD) return finalize(new Error(`${opts.command} cold timeout (${(COLD/1000).toFixed(0)}s no first byte). stderr: ${stderrTail.slice(-500)}`))
      if (everSawOutput && now - lastOutputAt > WARM) return finalize(new Error(`${opts.command} warm timeout (${(WARM/60_000).toFixed(0)}m no progress)`))
    }, 1_000)

    // Always close stdin so the CLI sees EOF. Without EOF, some CLIs block forever
    // waiting for "more input" even when they got the prompt from argv.
    if (child.stdin) {
      try {
        if (opts.stdinPayload != null) child.stdin.write(opts.stdinPayload)
        child.stdin.end()
      } catch (err) {
        finalize(err as Error)
      }
    }
  })
}

// Re-export so other modules can locate models cache dir.
export const CLI_MODELS_CACHE_DIR = path.join(os.homedir(), '.openlina', 'cli')
