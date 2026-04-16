export type AgentStatus = 'idle' | 'running' | 'error' | 'waiting'

export interface Agent {
  id: string
  projectId?: string
  name: string
  description?: string
  llmConfigId?: string
  systemPrompt: string
  tools: string[]
  canvasX: number
  canvasY: number
  status: AgentStatus
  color: string
  createdAt: string
  updatedAt: string
}

export interface AgentEdge {
  id: string
  sourceId: string
  targetId: string
  label?: string
  edgeType: 'default' | 'conditional' | 'broadcast'
  createdAt: string
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface AgentMessage {
  id: string
  fromAgentId?: string
  toAgentId?: string
  content: string
  role: MessageRole
  metadata?: {
    llmConfigId?: string
    usage?: { inputTokens: number; outputTokens: number }
    latencyMs?: number
    [key: string]: unknown
  }
  createdAt: string
}

export interface AgentPosition {
  id: string
  canvasX: number
  canvasY: number
}

export interface CanvasState {
  agents: Agent[]
  edges: AgentEdge[]
}
