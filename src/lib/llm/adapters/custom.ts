import OpenAI from 'openai'
import type { LLMAdapter, LLMRequest, LLMResponse } from '../types'
import { LLMError } from '../types'

export class CustomAdapter implements LLMAdapter {
  readonly platformId = 'custom'
  private client: OpenAI
  private modelId: string
  private llmConfigId: string
  private temperature: number

  constructor(opts: {
    llmConfigId: string
    endpointUrl: string
    apiKey?: string
    modelId: string
    temperature: number
  }) {
    this.client = new OpenAI({
      baseURL: opts.endpointUrl,
      apiKey: opts.apiKey || 'local',
    })
    this.modelId = opts.modelId
    this.llmConfigId = opts.llmConfigId
    this.temperature = opts.temperature
  }

  getContextWindow(): number {
    return 8192
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    const start = Date.now()
    try {
      const resp = await this.client.chat.completions.create(
        {
          model: this.modelId,
          messages: request.messages as OpenAI.ChatCompletionMessageParam[],
          temperature: request.temperature ?? this.temperature,
        },
        { signal: request.signal },
      )
      const content = resp.choices[0].message.content ?? ''
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
      throw new LLMError('unknown', err instanceof Error ? err.message : 'Custom adapter error')
    }
  }
}
