import { GoogleGenerativeAI } from '@google/generative-ai'
import type { LLMAdapter, LLMRequest, LLMResponse } from '../types'
import { LLMError } from '../types'
import { getContextWindow } from '../context-window'

export class GoogleAdapter implements LLMAdapter {
  readonly platformId = 'google'
  private genai: GoogleGenerativeAI
  private modelId: string
  private llmConfigId: string
  private maxTokens?: number
  private temperature: number

  constructor(opts: {
    llmConfigId: string
    apiKey: string
    modelId: string
    maxTokens?: number
    temperature: number
  }) {
    this.genai = new GoogleGenerativeAI(opts.apiKey)
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
    const model = this.genai.getGenerativeModel({
      model: this.modelId,
      generationConfig: {
        temperature: request.temperature ?? this.temperature,
        maxOutputTokens: request.maxTokens ?? this.maxTokens,
      },
    })

    const history = request.messages
      .filter((m) => m.role !== 'system')
      .slice(0, -1)
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }))

    const lastMsg = request.messages.filter((m) => m.role !== 'system').at(-1)
    if (!lastMsg) throw new LLMError('unknown', 'No user message provided')

    try {
      if (request.signal?.aborted) throw new LLMError('unknown', 'Aborted')
      const chat = model.startChat({ history })
      const sendPromise = chat.sendMessage(lastMsg.content)
      const result = request.signal
        ? await Promise.race([
            sendPromise,
            new Promise<never>((_, reject) => {
              request.signal!.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })
            }),
          ])
        : await sendPromise
      const content = result.response.text()
      const usage = result.response.usageMetadata
      return {
        content,
        llmConfigId: this.llmConfigId,
        platformId: this.platformId,
        modelId: this.modelId,
        usage: {
          inputTokens: usage?.promptTokenCount ?? 0,
          outputTokens: usage?.candidatesTokenCount ?? 0,
          totalTokens: usage?.totalTokenCount ?? 0,
        },
        latencyMs: Date.now() - start,
      }
    } catch (err: unknown) {
      const e = err as { message?: string }
      const msg = e.message ?? 'Google AI error'
      if (msg.includes('429')) throw new LLMError('rate_limit', msg)
      throw new LLMError('unknown', msg)
    }
  }
}
