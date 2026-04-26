// Pipeline namespace events
export interface PipelineStartArgs { projectId: string; maxIterations: number }
export interface PipelineStopArgs { runId: string }
export interface PipelineResumeArgs { runId: string }

export interface DevServerArgs { projectId: string; workspacePath?: string }

// Terminal namespace events
export interface TerminalCreateArgs {
  sessionId?: string
  command: string
  args?: string[]
  cwd?: string
  cols?: number
  rows?: number
}
export interface TerminalInputArgs { sessionId: string; data: string }
export interface TerminalResizeArgs { sessionId: string; cols: number; rows: number }
export interface TerminalAttachArgs { sessionId: string }

// LLM namespace events
export interface LlmChatArgs {
  llmConfigId?: string
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
}
