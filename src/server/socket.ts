import type { Server as HttpServer } from 'node:http'
import { Server as IOServer, type Namespace, type Socket } from 'socket.io'
import { PipelineRunner } from '../lib/pipeline/PipelineRunner'
import { ptyManager } from '../lib/terminal/PtyManager'
import { devServerManager } from '../lib/devserver/DevServerManager'
import { buildAdaptersFromDb, getAdapterById } from '../lib/llm/registry'
import type { PipelineStartArgs, PipelineStopArgs, PipelineResumeArgs, DevServerArgs, TerminalCreateArgs, TerminalInputArgs, TerminalResizeArgs, TerminalAttachArgs, LlmChatArgs } from '../types/socket-events'

let _ioInstance: IOServer | null = null

export function getIO(): IOServer | null {
  return _ioInstance
}

export function initSocketServer(http: HttpServer): IOServer {
  const io = new IOServer(http, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  })
  _ioInstance = io
  registerPipelineNs(io.of('/pipeline'))
  registerTerminalNs(io.of('/terminal'))
  registerLlmNs(io.of('/llm'))
  // Bridge devserver events globally
  devServerManager.on('status', (info) => {
    io.of('/pipeline').emit('devserver:status', info)
  })
  devServerManager.on('log', ({ projectId, line }: any) => {
    // Stream as terminal_output. BottomTerminal creates a tab lazily on first arrival
    // (won't steal focus from whatever the user has selected).
    io.of('/pipeline').emit('pipeline:terminal_output', {
      stepId: `devserver_${projectId}`,
      stepLabel: 'devserver',
      data: line + '\r\n',
    })
  })
  return io
}

function registerPipelineNs(ns: Namespace) {
  ns.on('connection', (socket: Socket) => {
    const runners = new Map<string, PipelineRunner>()

    socket.on('pipeline:start', async (raw: PipelineStartArgs, ack?: (r: any) => void) => {
      try {
        const args = raw || ({} as PipelineStartArgs)
        if (!args.projectId) throw new Error('projectId required')
        const max = args.maxIterations === 0 ? Number.MAX_SAFE_INTEGER : (args.maxIterations || 1)
        const runner = new PipelineRunner()
        wireRunner(runner, socket)
        // Register runner synchronously when run_created fires so Stop can find it
        runner.once('run_created', (p: any) => { if (p?.runId) runners.set(p.runId, runner) })
        runner.once('run_complete', (p: any) => { if (p?.runId) runners.delete(p.runId) })
        // Fire-and-forget; don't await (otherwise we can't receive Stop until run finishes)
        runner.start(args.projectId, max).catch((err) => {
          socket.emit('pipeline:agent_error', { runId: '', stepId: '', message: err?.message || String(err) })
        })
        ack?.({ ok: true })
      } catch (err: any) {
        ack?.({ ok: false, error: err?.message || String(err) })
      }
    })

    socket.on('pipeline:resume', async (raw: PipelineResumeArgs, ack?: (r: any) => void) => {
      try {
        const args = raw || ({} as PipelineResumeArgs)
        if (!args.runId) throw new Error('runId required')
        const runner = new PipelineRunner()
        wireRunner(runner, socket)
        runners.set(args.runId, runner)
        runner.once('run_complete', (p: any) => { if (p?.runId) runners.delete(p.runId) })
        runner.resume(args.runId).catch((err) => {
          socket.emit('pipeline:agent_error', { runId: args.runId, stepId: '', message: err?.message || String(err) })
        })
        ack?.({ ok: true })
      } catch (err: any) {
        ack?.({ ok: false, error: err?.message || String(err) })
      }
    })

    socket.on('pipeline:stop', (raw: PipelineStopArgs, ack?: (r: any) => void) => {
      try {
        const args = raw || ({} as PipelineStopArgs)
        const runner = runners.get(args.runId)
        if (runner) runner.stop()
        ack?.({ ok: true })
      } catch (err: any) { ack?.({ ok: false, error: err?.message || String(err) }) }
    })

    socket.on('devserver:start', async (raw: DevServerArgs, ack?: (r: any) => void) => {
      try {
        if (!raw?.projectId || !raw?.workspacePath) throw new Error('projectId and workspacePath required')
        const info = await devServerManager.start(raw.projectId, raw.workspacePath)
        ack?.({ ok: true, info })
      } catch (err: any) {
        ack?.({ ok: false, error: err?.message || String(err) })
      }
    })
    socket.on('devserver:stop', async (raw: DevServerArgs, ack?: (r: any) => void) => {
      try { await devServerManager.stop(raw.projectId); ack?.({ ok: true }) }
      catch (err: any) { ack?.({ ok: false, error: err?.message || String(err) }) }
    })
    socket.on('devserver:status', (raw: DevServerArgs, ack?: (r: any) => void) => {
      ack?.({ ok: true, info: devServerManager.status(raw.projectId) })
    })
  })
}

function wireRunner(runner: PipelineRunner, socket: Socket): void {
  const fwd = (event: string) => (payload: any) => socket.emit(`pipeline:${event}`, payload)
  runner.on('run_created', fwd('run_created'))
  runner.on('iteration_start', fwd('iteration_start'))
  runner.on('agent_start', (payload) => {
    socket.emit('pipeline:agent_start', payload)
    // Header line for the bottom terminal tab so the user knows which agent is running.
    const header = `\r\n\x1b[36m━━ ${payload.role || 'agent'} · ${payload.name || ''} (iter ${payload.iteration}) ━━\x1b[0m\r\n`
    socket.emit('pipeline:terminal_output', { stepId: payload.stepId, sessionId: payload.sessionId, data: header })
    if (payload.sessionId) {
      ptyManager.onData(payload.sessionId, (data) => {
        socket.emit('pipeline:terminal_output', { stepId: payload.stepId, sessionId: payload.sessionId, data })
      })
    }
  })
  runner.on('agent_chunk', (payload) => {
    socket.emit('pipeline:agent_chunk', payload)
    // ALSO mirror to bottom terminal so the user sees prompts, banners, npm output,
    // API responses — everything happening in real time per agent step.
    socket.emit('pipeline:terminal_output', { stepId: payload.stepId, data: payload.delta })
  })
  runner.on('agent_complete', (payload) => {
    socket.emit('pipeline:agent_complete', payload)
    socket.emit('pipeline:terminal_output', { stepId: payload.stepId, data: `\r\n\x1b[32m✓ completed (${payload.modelLabel || payload.providerType})\x1b[0m\r\n` })
  })
  runner.on('agent_error', (payload) => {
    socket.emit('pipeline:agent_error', payload)
    socket.emit('pipeline:terminal_output', { stepId: payload.stepId, data: `\r\n\x1b[31m✗ ${payload.message}\x1b[0m\r\n` })
  })
  runner.on('agent_artifact', fwd('agent_artifact'))
  runner.on('qa_verdict', fwd('qa_verdict'))
  runner.on('review_verdict', fwd('review_verdict'))
  runner.on('files_written', fwd('files_written'))
  runner.on('run_complete', fwd('run_complete'))
}

function registerTerminalNs(ns: Namespace) {
  ns.on('connection', (socket: Socket) => {
    const attached = new Set<string>()

    socket.on('session:create', async (raw: TerminalCreateArgs, ack?: (r: any) => void) => {
      try {
        const sessionId = raw.sessionId || `term_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        await ptyManager.spawn({
          sessionId,
          command: raw.command,
          args: raw.args || [],
          cwd: raw.cwd,
          cols: raw.cols ?? 120,
          rows: raw.rows ?? 32,
        })
        attachSession(socket, sessionId, attached)
        ack?.({ ok: true, sessionId })
      } catch (err: any) {
        ack?.({ ok: false, error: err?.message || String(err) })
      }
    })
    socket.on('session:attach', (raw: TerminalAttachArgs, ack?: (r: any) => void) => {
      try { attachSession(socket, raw.sessionId, attached); ack?.({ ok: true }) }
      catch (err: any) { ack?.({ ok: false, error: err?.message || String(err) }) }
    })
    socket.on('session:input', (raw: TerminalInputArgs) => {
      try { ptyManager.write(raw.sessionId, raw.data) } catch {}
    })
    socket.on('session:resize', (raw: TerminalResizeArgs) => {
      try { ptyManager.resize(raw.sessionId, raw.cols, raw.rows) } catch {}
    })
    socket.on('session:kill', (raw: { sessionId: string }, ack?: (r: any) => void) => {
      try { ptyManager.kill(raw.sessionId); ack?.({ ok: true }) } catch (err: any) { ack?.({ ok: false, error: err?.message || String(err) }) }
    })
    socket.on('disconnect', () => { attached.clear() })
  })
}

function attachSession(socket: Socket, sessionId: string, attached: Set<string>) {
  if (attached.has(sessionId)) return
  attached.add(sessionId)
  ptyManager.onData(sessionId, (data) => socket.emit('terminal:output', { sessionId, data }))
  ptyManager.onExit(sessionId, (code) => socket.emit('terminal:exit', { sessionId, code }))
}

function registerLlmNs(ns: Namespace) {
  ns.on('connection', (socket: Socket) => {
    socket.on('llm:chat', async (raw: LlmChatArgs, ack?: (r: any) => void) => {
      try {
        const adapters = raw.llmConfigId ? [getAdapterById(raw.llmConfigId)].filter(Boolean) as any[] : buildAdaptersFromDb()
        if (!adapters.length) throw new Error('no adapter available')
        const adapter = adapters[0]
        const result = await adapter.invoke({
          messages: raw.messages || [],
          onChunk: (delta: string) => socket.emit('llm:chunk', { delta }),
        })
        ack?.({ ok: true, text: result.text, modelLabel: result.modelLabel })
      } catch (err: any) {
        ack?.({ ok: false, error: err?.message || String(err) })
      }
    })
  })
}
