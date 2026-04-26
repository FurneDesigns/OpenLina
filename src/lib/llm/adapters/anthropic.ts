import type { ChatMessage, InvokeOptions, InvokeResult, LLMAdapter } from '../types'
import { trimMessagesToFit } from '../context-window'

export interface AnthropicAdapterOpts {
  id: string
  label: string
  apiKey: string
  modelId: string
  endpoint?: string
}

const DEFAULT_ENDPOINT = 'https://api.anthropic.com/v1/messages'

export function createAnthropicAdapter(opts: AnthropicAdapterOpts): LLMAdapter {
  return {
    id: opts.id,
    label: opts.label,
    providerType: 'api',
    modelId: opts.modelId,
    async invoke(invoke: InvokeOptions): Promise<InvokeResult> {
      const messages = trimMessagesToFit(invoke.messages, { maxTokens: 200_000, reserveOutput: 8_000 })
      const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
      const dialog = messages.filter((m) => m.role !== 'system') as ChatMessage[]
      const body = {
        model: invoke.modelOverride || opts.modelId,
        max_tokens: 4096,
        system: system || undefined,
        messages: dialog.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      }
      const res = await fetch(opts.endpoint || DEFAULT_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': opts.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: invoke.signal,
      })
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '')
        throw new Error(`anthropic ${res.status}: ${text.slice(0, 300)}`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let out = ''
      let inTokens = 0
      let outTokens = 0
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
            if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
              const delta: string = evt.delta.text || ''
              out += delta
              invoke.onChunk?.(delta)
            } else if (evt.type === 'message_delta' && evt.usage) {
              outTokens = evt.usage.output_tokens ?? outTokens
            } else if (evt.type === 'message_start' && evt.message?.usage) {
              inTokens = evt.message.usage.input_tokens ?? 0
            }
          } catch {}
        }
      }
      return { text: out, tokens: inTokens + outTokens, modelLabel: opts.label, providerType: 'api' }
    },
  }
}
