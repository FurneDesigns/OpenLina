'use client'
import { useEffect } from 'react'
import { useSocket } from './useSocket'
import { useAgentStore } from '@/store/useAgentStore'
import type { AgentMessage, AgentStatus } from '@/types/agent'
import type { CanvasState } from '@/types/agent'

export function useAgentSync() {
  const socket = useSocket('agents')
  const { setAgents, setEdges, addMessage, updateAgent } = useAgentStore()

  useEffect(() => {
    socket.on('canvas:synced', (data: CanvasState) => {
      setAgents(data.agents)
      setEdges(data.edges)
    })

    socket.on('agent:message', (msg: AgentMessage) => {
      addMessage(msg)
    })

    socket.on('agent:status', ({ agentId, status }: { agentId: string; status: AgentStatus }) => {
      updateAgent(agentId, { status })
    })

    return () => {
      socket.off('canvas:synced')
      socket.off('agent:message')
      socket.off('agent:status')
    }
  }, [socket, setAgents, setEdges, addMessage, updateAgent])
}
