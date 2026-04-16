'use client'
import { create } from 'zustand'
import type { Agent, AgentEdge, AgentMessage } from '@/types/agent'

interface AgentStore {
  agents: Agent[]
  edges: AgentEdge[]
  messages: AgentMessage[]
  selectedAgentId: string | null
  setAgents: (agents: Agent[]) => void
  setEdges: (edges: AgentEdge[]) => void
  addAgent: (agent: Agent) => void
  updateAgent: (id: string, patch: Partial<Agent>) => void
  removeAgent: (id: string) => void
  addEdge: (edge: AgentEdge) => void
  removeEdge: (id: string) => void
  addMessage: (msg: AgentMessage) => void
  selectAgent: (id: string | null) => void
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  edges: [],
  messages: [],
  selectedAgentId: null,

  setAgents: (agents) => set({ agents }),
  setEdges: (edges) => set({ edges }),
  addAgent: (agent) => set((s) => ({ agents: [...s.agents, agent] })),
  updateAgent: (id, patch) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),
  removeAgent: (id) =>
    set((s) => ({
      agents: s.agents.filter((a) => a.id !== id),
      edges: s.edges.filter((e) => e.sourceId !== id && e.targetId !== id),
    })),
  addEdge: (edge) => set((s) => ({ edges: [...s.edges, edge] })),
  removeEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),
  addMessage: (msg) => set((s) => ({ messages: [msg, ...s.messages].slice(0, 500) })),
  selectAgent: (id) => set({ selectedAgentId: id }),
}))
