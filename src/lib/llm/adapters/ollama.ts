import type { LLMAdapter, LLMRequest, LLMResponse } from '../types'
import { LLMError } from '../types'

export class OllamaAdapter implements LLMAdapter {
  readonly platformId = 'ollama'
  private endpointUrl: string
  private modelId: string
  private llmConfigId: string
  private temperature: number

  constructor(opts: {
    llmConfigId: string
    endpointUrl: string
    modelId: string
    temperature: number
  }) {
    this.endpointUrl = opts.endpointUrl.replace(/\/$/, '').replace('localhost', '127.0.0.1')
    this.modelId = opts.modelId
    this.llmConfigId = opts.llmConfigId
    this.temperature = opts.temperature
  }

  getContextWindow(): number {
    return 8192 // Ollama models vary; use a safe default
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    const start = Date.now()
    try {
      const resp = await fetch(`${this.endpointUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: request.signal,
        body: JSON.stringify({
          model: this.modelId,
          messages: request.messages,
          stream: false,
          options: { temperature: request.temperature ?? this.temperature },
        }),
      })
      if (!resp.ok) {
        throw new LLMError('unknown', `Ollama returned ${resp.status}: ${await resp.text()}`)
      }
      const data = (await resp.json()) as {
        message: { content: string }
        prompt_eval_count?: number
        eval_count?: number
      }
      const inputTokens = data.prompt_eval_count ?? 0
      const outputTokens = data.eval_count ?? 0
      return {
        content: data.message.content,
        llmConfigId: this.llmConfigId,
        platformId: this.platformId,
        modelId: this.modelId,
        usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
        latencyMs: Date.now() - start,
      }
    } catch (err) {
      if (err instanceof LLMError) throw err
      throw new LLMError('unknown', err instanceof Error ? err.message : 'Ollama error')
    }
  }
}
