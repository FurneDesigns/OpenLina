'use client'
import { useEffect } from 'react'
import { useSocket } from './useSocket'
import { useLLMStore } from '@/store/useLLMStore'
import type { LLMConfigSummary } from '@/types/llm'

export function useLLMFailover() {
  const socket = useSocket('llm')
  const { setFailover, setQueue } = useLLMStore()

  useEffect(() => {
    socket.on('llm:failover', (event: { nextLlmId: string; reason: string; message: string }) => {
      setFailover(true, `${event.reason}: ${event.message}`, event.nextLlmId)
    })

    socket.on('llm:response', () => {
      setTimeout(() => setFailover(false), 5000)
    })

    socket.on('llm:queue-updated', ({ queue }: { queue: LLMConfigSummary[] }) => {
      setQueue(queue)
    })

    return () => {
      socket.off('llm:failover')
      socket.off('llm:response')
      socket.off('llm:queue-updated')
    }
  }, [socket, setFailover, setQueue])
}
