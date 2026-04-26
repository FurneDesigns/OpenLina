import type { InvokeOptions, InvokeResult, LLMAdapter } from '../types'
import { trimMessagesToFit } from '../context-window'

export interface OpenAIAdapterOpts {
  id: string
  label: string
  apiKey: string
  modelId: string
  endpoint?: string
}

const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions'

export function createOpenAIAdapter(opts: OpenAIAdapterOpts): LLMAdapter {
  return {
    id: opts.id,
    label: opts.label,
    providerType: 'api',
    modelId: opts.modelId,
    async invoke(invoke: InvokeOptions): Promise<InvokeResult> {
      const messages = trimMessagesToFit(invoke.messages, { maxTokens: 128_000, reserveOutput: 4_000 })
      const body = {
        model: invoke.modelOverride || opts.modelId,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      }
      const res = await fetch(opts.endpoint || DEFAULT_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: invoke.signal,
      })
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '')
        throw new Error(`openai ${res.status}: ${text.slice(0, 300)}`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let out = ''
      let tokens = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const data = line.slice(5).trim()
          if (!data || data === '[DONE]') continue
          try {
            const evt = JSON.parse(data)
            const delta: string = evt.choices?.[0]?.delta?.content || ''
            if (delta) {
              out += delta
              invoke.onChunk?.(delta)
            }
            if (evt.usage?.total_tokens) tokens = evt.usage.total_tokens
          } catch {}
        }
      }
      return { text: out, tokens, modelLabel: opts.label, providerType: 'api' }
    },
  }
}
