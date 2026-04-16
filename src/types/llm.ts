export type PlatformId = 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom'

export interface Platform {
  id: PlatformId | string
  label: string
  enabled: boolean
  apiKeyEnc?: string
  endpointUrl?: string
  orgId?: string
  extraConfig?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface LLMConfig {
  id: string
  platformId: string
  modelId: string
  label: string
  priority: number
  maxTokens?: number
  temperature: number
  systemPrompt?: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface LLMConfigSummary {
  id: string
  label: string
  modelId: string
  platformId: string
  priority: number
  enabled: boolean
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMRequest {
  requestId: string
  messages: LLMMessage[]
  maxTokens?: number
  temperature?: number
  agentId?: string
  signal?: AbortSignal
  /** Called with each text chunk as it arrives (CLI streaming / API streaming) */
  onChunk?: (delta: string) => void
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface LLMResponse {
  content: string
  llmConfigId: string
  platformId: string
  modelId: string
  usage: TokenUsage
  latencyMs: number
}

export type FailoverErrorType =
  | 'context_length'
  | 'rate_limit'
  | 'quota'
  | 'timeout'
  | 'auth'
  | 'unknown'

export interface FailoverEvent {
  requestId: string
  failedLlmId: string
  nextLlmId: string
  reason: FailoverErrorType
  message: string
}

export interface FailoverContext {
  requestId: string
  originalMessages: LLMMessage[]
  attempts: Array<{
    llmConfigId: string
    error: FailoverErrorType
    message: string
  }>
}
