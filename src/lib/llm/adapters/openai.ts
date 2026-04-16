import OpenAI from 'openai'
import type { LLMAdapter, LLMRequest, LLMResponse } from '../types'
import { LLMError } from '../types'
import { getContextWindow } from '../context-window'

export class OpenAIAdapter implements LLMAdapter {
  readonly platformId = 'openai'
  private client: OpenAI
  private modelId: string
  private llmConfigId: string
  private maxTokens?: number
  private temperature: number

  constructor(opts: {
    llmConfigId: string
    apiKey: string
    orgId?: string
    modelId: string
    maxTokens?: number
    temperature: number
  }) {
    this.client = new OpenAI({ apiKey: opts.apiKey, organization: opts.orgId })
    this.modelId = opts.modelId
    this.llmConfigId = opts.llmConfigId
    this.maxTokens = opts.maxTokens
    this.temperature = opts.temperature
  }

  getContextWindow(): number {
    return getContextWindow(this.modelId, this.maxTokens)
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    const start = Date.now()
    try {
      const resp = await this.client.chat.completions.create(
        {
          model: this.modelId,
          messages: request.messages as OpenAI.ChatCompletionMessageParam[],
          temperature: request.temperature ?? this.temperature,
          max_tokens: request.maxTokens ?? this.maxTokens,
        },
        { signal: request.signal },
      )
      const choice = resp.choices[0]
      const content = choice.message.content ?? ''
      const usage = resp.usage
      return {
        content,
        llmConfigId: this.llmConfigId,
        platformId: this.platformId,
        modelId: this.modelId,
        usage: {
          inputTokens: usage?.prompt_tokens ?? 0,
          outputTokens: usage?.completion_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
        },
        latencyMs: Date.now() - start,
      }
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string }
      if (e.status === 429) throw new LLMError('rate_limit', e.message ?? 'Rate limit exceeded')
      if (e.status === 401 || e.status === 403) throw new LLMError('auth', e.message ?? 'Auth error')
      if (e.status === 400 && e.message?.includes('context')) throw new LLMError('context_length', e.message)
      throw new LLMError('unknown', e.message ?? 'OpenAI error')
    }
  }
}
