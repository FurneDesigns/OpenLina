import type { Agent, AgentEdge, AgentMessage, AgentPosition, AgentStatus } from './agent'
import type { LLMConfigSummary, TokenUsage, FailoverErrorType } from './llm'
import type { CanvasState } from './agent'

// ─── Terminal Namespace ────────────────────────────────────────────────────────

export interface TerminalClientEvents {
  'session:create': (data: {
    sessionId: string
    command: string
    cwd: string
    cols: number
    rows: number
  }) => void
  'session:input': (data: { sessionId: string; data: string }) => void
  'session:resize': (data: { sessionId: string; cols: number; rows: number }) => void
  'session:kill': (data: { sessionId: string }) => void
}

export interface TerminalServerEvents {
  'terminal:output': (data: { sessionId: string; data: string }) => void
  'terminal:exit': (data: { sessionId: string; exitCode: number }) => void
  'terminal:error': (data: { sessionId: string; message: string }) => void
}

// ─── Agents Namespace ─────────────────────────────────────────────────────────

export interface AgentClientEvents {
  'agent:subscribe': (data: { agentId: string }) => void
  'agent:unsubscribe': (data: { agentId: string }) => void
  'agent:send': (data: {
    fromAgentId: string | null
    toAgentId: string
    content: string
    role: 'user' | 'system'
  }) => void
  'agent:broadcast': (data: { fromAgentId: string; content: string }) => void
  'agent:run': (data: { agentId: string; prompt: string }) => void
  'agent:cancel': (data: { agentId: string }) => void
  'canvas:update': (data: { agents: AgentPosition[]; edges: AgentEdge[] }) => void
}

export interface AgentServerEvents {
  'agent:message': (msg: AgentMessage) => void
  'agent:status': (data: { agentId: string; status: AgentStatus }) => void
  'agent:error': (data: { agentId: string; message: string }) => void
  'canvas:synced': (data: CanvasState) => void
}

// ─── LLM Namespace ────────────────────────────────────────────────────────────

export interface LLMClientEvents {
  'llm:invoke': (data: {
    requestId: string
    messages: Array<{ role: string; content: string }>
    agentId?: string
  }) => void
}

export interface LLMServerEvents {
  'llm:response': (data: {
    requestId: string
    content: string
    llmConfigId: string
    usage: TokenUsage
  }) => void
  'llm:stream-chunk': (data: { requestId: string; delta: string }) => void
  'llm:failover': (data: {
    requestId: string
    failedLlmId: string
    nextLlmId: string
    reason: FailoverErrorType
    message: string
  }) => void
  'llm:error': (data: { requestId: string; message: string }) => void
  'llm:queue-updated': (data: { queue: LLMConfigSummary[] }) => void
}
