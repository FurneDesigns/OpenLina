import { getDb } from '../db'
import type { LLMAdapter, LLMConfigRow, PlatformRow } from './types'
import { createAnthropicAdapter } from './adapters/anthropic'
import { createOpenAIAdapter } from './adapters/openai'
import { createGeminiAdapter } from './adapters/gemini'
import { createOllamaAdapter } from './adapters/ollama'
import { createCliAdapter } from './adapters/cli'

function loadEnabledConfigs(): { config: LLMConfigRow; platform: PlatformRow | null }[] {
  const db = getDb()
  const configs = db.prepare(`SELECT * FROM llm_configs WHERE enabled = 1 ORDER BY priority DESC, created_at ASC`).all() as LLMConfigRow[]
  const platformIds = Array.from(new Set(configs.map((c) => c.platform_id).filter(Boolean))) as string[]
  const platforms = new Map<string, PlatformRow>()
  if (platformIds.length) {
    const placeholders = platformIds.map(() => '?').join(',')
    const rows = db.prepare(`SELECT * FROM platforms WHERE id IN (${placeholders})`).all(...platformIds) as PlatformRow[]
    rows.forEach((p) => platforms.set(p.id, p))
  }
  return configs.map((c) => ({ config: c, platform: c.platform_id ? platforms.get(c.platform_id) || null : null }))
}

export function buildAdaptersFromDb(): LLMAdapter[] {
  const adapters: LLMAdapter[] = []
  for (const { config, platform } of loadEnabledConfigs()) {
    const label = config.label || `${config.provider_type}:${config.model_id || config.cli_command || config.id}`
    if (config.provider_type === 'cli' && config.cli_command) {
      adapters.push(createCliAdapter({
        id: config.id,
        label,
        command: config.cli_command,
        modelId: config.model_id || undefined,
      }))
      continue
    }
    if (config.provider_type === 'api' && platform) {
      const apiKey = platform.api_key || ''
      const provider = (platform.id || '').toLowerCase()
      if (provider === 'anthropic') {
        adapters.push(createAnthropicAdapter({ id: config.id, label, apiKey, modelId: config.model_id || 'claude-sonnet-4-6' }))
      } else if (provider === 'openai') {
        adapters.push(createOpenAIAdapter({ id: config.id, label, apiKey, modelId: config.model_id || 'gpt-4o' }))
      } else if (provider === 'google') {
        adapters.push(createGeminiAdapter({ id: config.id, label, apiKey, modelId: config.model_id || 'gemini-1.5-pro' }))
      } else if (provider === 'ollama') {
        adapters.push(createOllamaAdapter({ id: config.id, label, modelId: config.model_id || 'llama3.1:latest', endpoint: platform.endpoint_url || undefined }))
      }
    }
  }
  return adapters
}

export function getAdapterById(id: string): LLMAdapter | null {
  return buildAdaptersFromDb().find((a) => a.id === id) || null
}
