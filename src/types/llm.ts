export type LLMProviderType = 'api' | 'cli'

export type LLMProviderId = 'anthropic' | 'openai' | 'google' | 'ollama' | 'cli' | string

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface InvokeOptions {
  messages: ChatMessage[]
  cwd?: string
  signal?: AbortSignal
  modelOverride?: string
  // Caller-provided session id. If supplied, CLI adapters MUST use it for the PTY session
  // so subscribers (e.g. the bottom terminal) can attach before spawn.
  sessionId?: string
  // Streaming hooks
  onChunk?: (delta: string) => void
  onSession?: (sessionId: string) => void
  // For commandline initial-input scenarios (e.g. claude with stdin)
  stdinInput?: string
  // Maximum wall-time in ms; adapter may shorten
  timeoutMs?: number
}

export interface InvokeResult {
  text: string
  tokens?: number
  modelLabel?: string
  providerType: LLMProviderType
  sessionId?: string
}

export interface LLMConfigRow {
  id: string
  platform_id: string | null
  label: string | null
  model_id: string | null
  provider_type: LLMProviderType
  cli_command: string | null
  enabled: number
  priority: number
  created_at: string
}

export interface PlatformRow {
  id: string
  label: string | null
  api_key: string | null
  endpoint_url: string | null
  enabled: number
  created_at: string
}

export interface LLMAdapter {
  id: string                    // llm_config id
  label: string
  providerType: LLMProviderType
  modelId?: string
  cliCommand?: string
  invoke(opts: InvokeOptions): Promise<InvokeResult>
}

export interface CliAdapterOptions {
  command: string
  modelId?: string
  apiKey?: string | null
  endpoint?: string | null
  buildArgs: (prompt: string, modelOverride?: string) => string[]
  env?: NodeJS.ProcessEnv
}
