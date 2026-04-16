import Anthropic from '@anthropic-ai/sdk'
import type { LLMAdapter, LLMRequest, LLMResponse, LLMMessage } from '../types'
import { LLMError } from '../types'
import { getContextWindow } from '../context-window'

export class AnthropicAdapter implements LLMAdapter {
  readonly platformId = 'anthropic'
  private client: Anthropic
  private modelId: string
  private llmConfigId: string
  private maxTokens: number
  private temperature: number

  constructor(opts: {
    llmConfigId: string
    apiKey: string
    modelId: string
    maxTokens?: number
    temperature: number
  }) {
    this.client = new Anthropic({ apiKey: opts.apiKey })
    this.modelId = opts.modelId
    this.llmConfigId = opts.llmConfigId
    this.maxTokens = opts.maxTokens ?? 4096
    this.temperature = opts.temperature
  }

  getContextWindow(): number {
    return getContextWindow(this.modelId, this.maxTokens)
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    const start = Date.now()
    const systemMessages = request.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')

    const userMessages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    try {
      const resp = await this.client.messages.create(
        {
          model: this.modelId,
          max_tokens: request.maxTokens ?? this.maxTokens,
          temperature: request.temperature ?? this.temperature,
          system: systemMessages || undefined,
          messages: userMessages,
        },
        { signal: request.signal },
      )
      const content = resp.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('')
      return {
        content,
        llmConfigId: this.llmConfigId,
        platformId: this.platformId,
        modelId: this.modelId,
        usage: {
          inputTokens: resp.usage.input_tokens,
          outputTokens: resp.usage.output_tokens,
          totalTokens: resp.usage.input_tokens + resp.usage.output_tokens,
        },
        latencyMs: Date.now() - start,
      }
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      if (e.status === 429) throw new LLMError('rate_limit', e.message ?? 'Rate limit exceeded')
      if (e.status === 401) throw new LLMError('auth', e.message ?? 'Auth error')
      if (e.message?.toLowerCase().includes('context')) throw new LLMError('context_length', e.message)
      throw new LLMError('unknown', e.message ?? 'Anthropic error')
    }
  }
}
