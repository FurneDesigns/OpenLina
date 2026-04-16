import { spawn } from 'child_process'
import type { LLMAdapter, LLMRequest, LLMResponse, CliAdapterOptions } from '../types'
import { LLMError } from '../types'
import type { LLMMessage } from '@/types/llm'

/**
 * Builds a single text prompt from a messages array for passing to a CLI tool.
 * System prompts are prepended, followed by the conversation.
 */
function buildPrompt(messages: LLMMessage[]): string {
  const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
  const conv = messages
    .filter((m) => m.role !== 'system')
    .map((m) => (m.role === 'assistant' ? `Assistant: ${m.content}` : m.content))
    .join('\n\n')

  return sys ? `${sys}\n\n---\n\n${conv}` : conv
}

export interface CLIAdapterOptions {
  llmConfigId: string
  platformId: string
  /** Executable name, e.g. "claude", "codex", "llm" */
  command: string
  /** Model flag value, e.g. "claude-sonnet-4-6" */
  modelId: string
  /** Additional static args before the prompt, e.g. ["-p"] for claude or ["-q"] for codex */
  staticArgs?: string[]
  /** Optional model flag, e.g. "--model" — will be appended as ["--model", modelId] */
  modelFlag?: string
  /** Env vars to inject into the subprocess (e.g. ANTHROPIC_API_KEY) */
  envVars?: Record<string, string>
}

const TOOL_DEFAULTS: Record<string, Omit<CLIAdapterOptions, 'llmConfigId' | 'platformId' | 'command' | 'modelId' | 'envVars'>> = {
  claude:  { staticArgs: ['-p'],        modelFlag: '--model' },
  codex:   { staticArgs: [],            modelFlag: '--model' },
  llm:     { staticArgs: [],            modelFlag: '-m' },
  aider:   { staticArgs: ['--message'], modelFlag: '--model' },
  sgpt:    { staticArgs: [],            modelFlag: '--model' },
  custom:  { staticArgs: [] },
}

export class CLIAdapter implements LLMAdapter {
  readonly platformId: string
  private llmConfigId: string
  private command: string
  private modelId: string
  private staticArgs: string[]
  private modelFlag?: string
  private envVars: Record<string, string>

  constructor(opts: CLIAdapterOptions) {
    this.platformId = opts.platformId
    this.llmConfigId = opts.llmConfigId
    this.command = opts.command
    // Map unsupported model that triggers blocking interactive CLI warnings
    this.modelId = opts.modelId === 'o4-mini' && opts.command === 'codex' ? 'gpt-4o-mini' : opts.modelId
    this.envVars = opts.envVars ?? {}

    const defaults = TOOL_DEFAULTS[opts.command] ?? TOOL_DEFAULTS.custom
    this.staticArgs = opts.staticArgs ?? defaults.staticArgs ?? []
    this.modelFlag  = opts.modelFlag  ?? defaults.modelFlag
  }

  getContextWindow(): number {
    return 128000 // CLIs generally handle large contexts
  }

  getCliOptions(): CliAdapterOptions {
    return {
      command: this.command,
      buildArgs: (prompt: string) => [
        ...this.staticArgs,
        ...(this.modelFlag && this.modelId ? [this.modelFlag, this.modelId] : []),
        prompt,
      ],
      env: this.envVars,
    }
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    if (request.signal?.aborted) throw new LLMError('unknown', 'Aborted')

    const prompt = buildPrompt(request.messages)

    const args = [
      ...this.staticArgs,
      ...(this.modelFlag && this.modelId ? [this.modelFlag, this.modelId] : []),
      prompt,
    ]

    const start = Date.now()

    return new Promise<LLMResponse>((resolve, reject) => {
      let stdout = ''
      let stderr = ''

      const proc = spawn(this.command, args, {
        env: { ...process.env, ...this.envVars },
        shell: false,
      })

      proc.stdout.on('data', (d: Buffer) => {
        const text = d.toString()
        stdout += text
        request.onChunk?.(text)   // stream to caller in real-time
      })
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

      const onAbort = () => {
        proc.kill('SIGTERM')
        setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 2000)
        reject(new LLMError('unknown', 'Aborted'))
      }

      request.signal?.addEventListener('abort', onAbort, { once: true })

      proc.on('close', (code) => {
        request.signal?.removeEventListener('abort', onAbort)
        if (request.signal?.aborted) return // already rejected

        if (code === 0 || (code !== 0 && stdout.trim())) {
          // Even non-zero exit can have useful output (some CLIs exit 1 on success)
          const content = stdout.trim()
          if (!content) {
            reject(new LLMError('unknown', `${this.command} produced no output. stderr: ${stderr.slice(0, 200)}`))
            return
          }
          resolve({
            content,
            llmConfigId: this.llmConfigId,
            platformId: this.platformId,
            modelId: this.modelId,
            usage: {
              // CLIs don't always report token counts — estimate from chars
              inputTokens: Math.ceil(prompt.length / 4),
              outputTokens: Math.ceil(content.length / 4),
              totalTokens: Math.ceil((prompt.length + content.length) / 4),
            },
            latencyMs: Date.now() - start,
          })
        } else {
          const errMsg = stderr.trim() || `${this.command} exited with code ${code}`
          if (errMsg.toLowerCase().includes('rate') || errMsg.includes('429')) {
            reject(new LLMError('rate_limit', errMsg))
          } else if (errMsg.toLowerCase().includes('auth') || errMsg.toLowerCase().includes('unauthorized')) {
            reject(new LLMError('auth', errMsg))
          } else {
            reject(new LLMError('unknown', errMsg))
          }
        }
      })

      proc.on('error', (err) => {
        request.signal?.removeEventListener('abort', onAbort)
        if (err.message.includes('ENOENT')) {
          reject(new LLMError('unknown', `"${this.command}" not found. Is it installed and in PATH?`))
        } else {
          reject(new LLMError('unknown', err.message))
        }
      })
    })
  }
}
