import type { ChatMessage } from './types'

// Rough char->token estimate (4 chars/token).
const CHARS_PER_TOKEN = 4

export interface TrimOptions {
  maxTokens?: number    // model context window in tokens
  reserveOutput?: number
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Trims oldest non-system messages until total tokens fit.
 * Always preserves system + last user message intact.
 */
export function trimMessagesToFit(
  messages: ChatMessage[],
  opts: TrimOptions = {},
): ChatMessage[] {
  const maxTokens = opts.maxTokens ?? 100_000
  const reserve = opts.reserveOutput ?? 4_000
  const budget = Math.max(1_000, maxTokens - reserve)

  let total = messages.reduce((acc, m) => acc + estimateTokens(m.content), 0)
  if (total <= budget) return messages

  const result = messages.slice()
  // Identify protected indexes: all system + final message
  const protectedIdx = new Set<number>()
  result.forEach((m, i) => { if (m.role === 'system') protectedIdx.add(i) })
  protectedIdx.add(result.length - 1)

  // Drop from oldest non-protected first.
  for (let i = 0; i < result.length && total > budget; i++) {
    if (protectedIdx.has(i)) continue
    total -= estimateTokens(result[i].content)
    result[i] = { ...result[i], content: '' }
  }
  return result.filter((m) => m.content.length > 0)
}
