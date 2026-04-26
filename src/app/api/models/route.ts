import { ok, fail } from '@/lib/api/json'

export const runtime = 'nodejs'

const KNOWN: Record<string, string[]> = {
  anthropic: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-3-5-sonnet-latest'],
  openai: ['gpt-5', 'gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  google: ['gemini-2.0-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  ollama: ['llama3.1:latest', 'qwen2.5:latest', 'mistral:latest'],
  cli: ['sonnet', 'opus', 'haiku', 'gpt-5', 'gpt-4o', 'llama3.1:latest'],
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const platform = url.searchParams.get('platform') || ''
    const list = KNOWN[platform] || []
    return ok(list)
  } catch (err) { return fail(err) }
}
