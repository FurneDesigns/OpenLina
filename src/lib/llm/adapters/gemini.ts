import type { InvokeOptions, InvokeResult, LLMAdapter } from '../types'
import { trimMessagesToFit } from '../context-window'

export interface GeminiAdapterOpts {
  id: string
  label: string
  apiKey: string
  modelId: string
}

export function createGeminiAdapter(opts: GeminiAdapterOpts): LLMAdapter {
  return {
    id: opts.id,
    label: opts.label,
    providerType: 'api',
    modelId: opts.modelId,
    async invoke(invoke: InvokeOptions): Promise<InvokeResult> {
      const messages = trimMessagesToFit(invoke.messages, { maxTokens: 1_000_000, reserveOutput: 8_000 })
      const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
      const dialog = messages.filter((m) => m.role !== 'system')
      const contents = dialog.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))
      const model = invoke.modelOverride || opts.modelId
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(opts.apiKey)}`
      const body: any = {
        contents,
        systemInstruction: system ? { role: 'system', parts: [{ text: system }] } : undefined,
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: invoke.signal,
      })
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '')
        throw new Error(`gemini ${res.status}: ${text.slice(0, 300)}`)
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
          if (!line.startsWith('data:')) continue
          const data = line.slice(5).trim()
          if (!data) continue
          try {
            const evt = JSON.parse(data)
            const parts = evt.candidates?.[0]?.content?.parts || []
            for (const p of parts) {
              const delta: string = p.text || ''
              if (delta) {
                out += delta
                invoke.onChunk?.(delta)
              }
            }
          } catch {}
        }
      }
      return { text: out, modelLabel: opts.label, providerType: 'api' }
    },
  }
}
