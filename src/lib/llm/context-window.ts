import type { LLMMessage } from './types'

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // OpenAI
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
  'gpt-4-turbo': 128_000,
  'gpt-4': 8_192,
  'o3': 200_000,
  'o4-mini': 200_000,
  'codex-mini-latest': 200_000,
  // Anthropic
  'claude-opus-4-5': 200_000,
  'claude-sonnet-4-5': 200_000,
  'claude-haiku-4-5': 200_000,
  'claude-opus-4-6': 200_000,
  'claude-sonnet-4-6': 200_000,
  // Google
  'gemini-2.5-pro': 1_000_000,
  'gemini-2.0-flash': 1_000_000,
  'gemini-1.5-pro': 2_000_000,
  // Default for unknown models
  default: 8_192,
}

// Rough token estimate: 1 token ≈ 4 chars (conservative)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function getContextWindow(modelId: string, override?: number): number {
  if (override) return override
  return MODEL_CONTEXT_WINDOWS[modelId] ?? MODEL_CONTEXT_WINDOWS.default
}

/**
 * Trim messages to fit within a target context window.
 * Always preserves: system messages + last user message + as many recent messages as fit.
 */
export function trimMessagesToFit(
  messages: LLMMessage[],
  maxTokens: number,
  reserveForResponse = 2048,
): LLMMessage[] {
  const budget = maxTokens - reserveForResponse
  const systemMessages = messages.filter((m) => m.role === 'system')
  const nonSystem = messages.filter((m) => m.role !== 'system')

  let used = systemMessages.reduce((sum, m) => sum + estimateTokens(m.content), 0)

  // Always keep the last user message
  const lastUser = [...nonSystem].reverse().find((m) => m.role === 'user')
  if (lastUser) {
    used += estimateTokens(lastUser.content)
  }

  const kept: LLMMessage[] = []
  // Walk from most recent backward, excluding the last user message (already counted)
  for (let i = nonSystem.length - 1; i >= 0; i--) {
    const msg = nonSystem[i]
    if (msg === lastUser) continue
    const cost = estimateTokens(msg.content)
    if (used + cost > budget) break
    kept.unshift(msg)
    used += cost
  }

  if (lastUser) kept.push(lastUser)

  return [...systemMessages, ...kept]
}
