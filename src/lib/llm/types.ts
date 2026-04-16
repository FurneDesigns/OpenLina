import type { LLMMessage, LLMRequest, LLMResponse, FailoverErrorType } from '@/types/llm'

export interface CliAdapterOptions {
  command: string
  buildArgs: (prompt: string) => string[]
  env: Record<string, string>
}

export interface LLMAdapter {
  platformId: string
  invoke(request: LLMRequest): Promise<LLMResponse>
  getContextWindow(): number
  /** CLI-based adapters expose this so the pipeline can run them via PTY */
  getCliOptions?(): CliAdapterOptions
}

export class LLMError extends Error {
  constructor(
    public readonly errorType: FailoverErrorType,
    message: string,
  ) {
    super(message)
    this.name = 'LLMError'
  }
}

export function classifyError(err: unknown): { type: FailoverErrorType; message: string } {
  if (err instanceof LLMError) {
    return { type: err.errorType, message: err.message }
  }
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()
  if (lower.includes('context') || lower.includes('token') || lower.includes('length')) {
    return { type: 'context_length', message: msg }
  }
  if (lower.includes('rate') || lower.includes('429')) {
    return { type: 'rate_limit', message: msg }
  }
  if (lower.includes('quota') || lower.includes('billing') || lower.includes('credit')) {
    return { type: 'quota', message: msg }
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return { type: 'timeout', message: msg }
  }
  if (lower.includes('auth') || lower.includes('401') || lower.includes('403')) {
    return { type: 'auth', message: msg }
  }
  return { type: 'unknown', message: msg }
}

export type { LLMMessage, LLMRequest, LLMResponse }
