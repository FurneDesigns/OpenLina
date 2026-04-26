import { getDb, genId, nowIso } from '../db'
import type { ChatMessage, InvokeResult, LLMAdapter } from './types'

export interface InvokeWithFailoverArgs {
  adapters: LLMAdapter[]            // ordered, highest priority first
  messages: ChatMessage[]
  cwd?: string
  signal?: AbortSignal
  modelOverride?: string
  sessionId?: string
  onChunk?: (delta: string, adapter: LLMAdapter) => void
  onSession?: (sessionId: string, adapter: LLMAdapter) => void
  onAdapterChange?: (adapter: LLMAdapter) => void
  requestId?: string
}

export async function invokeWithFailover(args: InvokeWithFailoverArgs): Promise<{ result: InvokeResult; adapter: LLMAdapter }> {
  const reqId = args.requestId || genId('req')
  const errors: { adapter: LLMAdapter; err: any }[] = []
  for (const adapter of args.adapters) {
    if (args.signal?.aborted) throw new Error('aborted')
    try {
      args.onAdapterChange?.(adapter)
      // Banner so the user can see the prompt being sent (especially for API adapters
      // that don't have a CLI banner of their own).
      if (adapter.providerType === 'api') {
        const sysParts = args.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n')
        const userParts = args.messages.filter((m) => m.role !== 'system').map((m) => `[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n')
        args.onChunk?.(`── ${adapter.label} ── prompt ──\n${sysParts ? `[SYSTEM]\n${sysParts}\n\n` : ''}${userParts}\n── response ──\n`, adapter)
      }
      const result = await adapter.invoke({
        messages: args.messages,
        cwd: args.cwd,
        signal: args.signal,
        modelOverride: args.modelOverride,
        sessionId: args.sessionId,
        onChunk: (d) => args.onChunk?.(d, adapter),
        onSession: (s) => args.onSession?.(s, adapter),
      })
      return { result, adapter }
    } catch (err: any) {
      errors.push({ adapter, err })
      logFailover(reqId, adapter, err)
      // continue to next adapter
    }
  }
  const summary = errors.map((e) => `${e.adapter.label}: ${e.err?.message || e.err}`).join(' | ')
  throw new Error(`All adapters failed. ${summary}`)
}

function logFailover(reqId: string, adapter: LLMAdapter, err: any): void {
  try {
    const db = getDb()
    db.prepare(`INSERT INTO llm_failover_log (id, request_id, llm_config_id, error_type, error_message, ts)
                VALUES (?, ?, ?, ?, ?, ?)`).run(
      genId('fover'),
      reqId,
      adapter.id,
      String((err && err.name) || 'Error'),
      String(err?.message || err).slice(0, 500),
      nowIso(),
    )
  } catch {}
}
