import { v4 as uuid } from 'uuid'
import { getDb } from '../db'
import { getOrderedAdapters } from './index'
import { trimMessagesToFit } from './context-window'
import { classifyError } from './types'
import type { LLMRequest, LLMResponse, FailoverEvent, FailoverErrorType } from '@/types/llm'
import type { LLMMessage } from './types'

export type FailoverEventCallback = (event: FailoverEvent) => void

export async function invokeWithFailover(
  messages: LLMMessage[],
  options: {
    requestId?: string
    agentId?: string
    onFailover?: FailoverEventCallback
    signal?: AbortSignal
    onChunk?: (delta: string) => void
  } = {},
): Promise<LLMResponse> {
  const requestId = options.requestId ?? uuid()
  const db = getDb()
  const adapters = getOrderedAdapters()

  if (adapters.length === 0) {
    throw new Error('No LLM adapters configured. Please add at least one platform in Settings.')
  }

  if (options.signal?.aborted) throw new Error('Aborted')

  let currentMessages = [...messages]

  for (let i = 0; i < adapters.length; i++) {
    const adapter = adapters[i]
    const request: LLMRequest = {
      requestId, messages: currentMessages,
      signal: options.signal, onChunk: options.onChunk,
    }

    try {
      const response = await adapter.invoke(request)
      return response
    } catch (err: unknown) {
      if (options.signal?.aborted) {
        throw new Error('Aborted')
      }

      const { type, message } = classifyError(err)

      // Log the failure
      db.prepare(`
        INSERT INTO llm_failover_log (id, request_id, llm_config_id, error_type, error_message)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuid(), requestId, adapter.platformId, type, message)

      const nextAdapter = adapters[i + 1]
      if (!nextAdapter) {
        throw new Error(`All ${adapters.length} LLM(s) failed. Last error: ${message}`)
      }

      // Trim context for the next model if needed
      if (type === 'context_length') {
        currentMessages = trimMessagesToFit(currentMessages, nextAdapter.getContextWindow())
      }

      options.onFailover?.({
        requestId,
        failedLlmId: adapter.platformId,
        nextLlmId: nextAdapter.platformId,
        reason: type,
        message,
      })
    }
  }

  throw new Error('Failover loop exhausted without result')
}
