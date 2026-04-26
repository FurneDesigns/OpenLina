import type { InvokeOptions, InvokeResult, LLMAdapter } from '../types'
import { trimMessagesToFit } from '../context-window'

export interface OllamaAdapterOpts {
  id: string
  label: string
  modelId: string
  endpoint?: string
}

export function createOllamaAdapter(opts: OllamaAdapterOpts): LLMAdapter {
  const endpoint = opts.endpoint || 'http://127.0.0.1:11434'
  return {
    id: opts.id,
    label: opts.label,
    providerType: 'api',
    modelId: opts.modelId,
    async invoke(invoke: InvokeOptions): Promise<InvokeResult> {
      const messages = trimMessagesToFit(invoke.messages, { maxTokens: 16_000, reserveOutput: 2_000 })
      const body = {
        model: invoke.modelOverride || opts.modelId,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      }
      const res = await fetch(`${endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: invoke.signal,
      })
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '')
        throw new Error(`ollama ${res.status}: ${text.slice(0, 300)}`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let out = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const evt = JSON.parse(trimmed)
            const delta: string = evt.message?.content || ''
            if (delta) {
              out += delta
              invoke.onChunk?.(delta)
            }
          } catch {}
        }
      }
      return { text: out, modelLabel: opts.label, providerType: 'api' }
    },
  }
}
