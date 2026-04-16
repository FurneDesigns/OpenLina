import { NextRequest, NextResponse } from 'next/server'
import { OpenAIAdapter } from '@/lib/llm/adapters/openai'
import { AnthropicAdapter } from '@/lib/llm/adapters/anthropic'
import { GoogleAdapter } from '@/lib/llm/adapters/google'
import { OllamaAdapter } from '@/lib/llm/adapters/ollama'
import { v4 as uuid } from 'uuid'

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    platformId: string
    apiKey?: string
    endpointUrl?: string
    modelId: string
  }

  const testMessages = [{ role: 'user' as const, content: 'Reply with "ok" only.' }]
  const testRequest = { requestId: uuid(), messages: testMessages, maxTokens: 10 }

  try {
    let adapter
    switch (body.platformId) {
      case 'openai':
        adapter = new OpenAIAdapter({
          llmConfigId: 'test',
          apiKey: body.apiKey!,
          modelId: body.modelId || 'gpt-4o-mini',
          temperature: 0,
        })
        break
      case 'anthropic':
        adapter = new AnthropicAdapter({
          llmConfigId: 'test',
          apiKey: body.apiKey!,
          modelId: body.modelId || 'claude-haiku-4-5',
          temperature: 0,
        })
        break
      case 'google':
        adapter = new GoogleAdapter({
          llmConfigId: 'test',
          apiKey: body.apiKey!,
          modelId: body.modelId || 'gemini-2.0-flash',
          temperature: 0,
        })
        break
      case 'ollama':
        adapter = new OllamaAdapter({
          llmConfigId: 'test',
          endpointUrl: body.endpointUrl || 'http://localhost:11434',
          modelId: body.modelId || 'llama3.2',
          temperature: 0,
        })
        break
      default:
        return NextResponse.json({ ok: false, error: 'Unknown platform' }, { status: 400 })
    }

    await adapter.invoke(testRequest)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Connection failed' },
      { status: 400 },
    )
  }
}
