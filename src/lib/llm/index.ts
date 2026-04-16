import { getDb } from '../db'
import { decrypt } from '../crypto'
import { OpenAIAdapter } from './adapters/openai'
import { AnthropicAdapter } from './adapters/anthropic'
import { GoogleAdapter } from './adapters/google'
import { OllamaAdapter } from './adapters/ollama'
import { CustomAdapter } from './adapters/custom'
import { CLIAdapter } from './adapters/cli'
import type { LLMAdapter } from './types'

interface PlatformRow {
  id: string
  api_key_enc: string | null
  endpoint_url: string | null
  org_id: string | null
}

interface LLMConfigRow {
  id: string
  platform_id: string
  model_id: string
  label: string
  priority: number
  max_tokens: number | null
  temperature: number
  system_prompt: string | null
  enabled: number
  provider_type: string | null
  cli_command: string | null
  cli_env_vars: string | null
}

export function buildAdapter(configId: string): LLMAdapter | null {
  const db = getDb()
  const config = db
    .prepare('SELECT * FROM llm_configs WHERE id = ? AND enabled = 1')
    .get(configId) as LLMConfigRow | undefined
  if (!config) return null

  // ── CLI provider ────────────────────────────────────────────────────────────
  if (config.provider_type === 'cli' && config.cli_command) {
    const envVars: Record<string, string> = config.cli_env_vars
      ? JSON.parse(config.cli_env_vars)
      : {}
    return new CLIAdapter({
      llmConfigId: config.id,
      platformId: config.platform_id,
      command: config.cli_command,
      modelId: config.model_id,
      envVars,
    })
  }

  // ── API provider ────────────────────────────────────────────────────────────
  const platform = db
    .prepare('SELECT * FROM platforms WHERE id = ? AND enabled = 1')
    .get(config.platform_id) as PlatformRow | undefined
  if (!platform) return null

  const apiKey = platform.api_key_enc ? decrypt(platform.api_key_enc) : ''

  switch (platform.id) {
    case 'openai':
      return new OpenAIAdapter({
        llmConfigId: config.id,
        apiKey,
        orgId: platform.org_id ?? undefined,
        modelId: config.model_id,
        maxTokens: config.max_tokens ?? undefined,
        temperature: config.temperature,
      })
    case 'anthropic':
      return new AnthropicAdapter({
        llmConfigId: config.id,
        apiKey,
        modelId: config.model_id,
        maxTokens: config.max_tokens ?? undefined,
        temperature: config.temperature,
      })
    case 'google':
      return new GoogleAdapter({
        llmConfigId: config.id,
        apiKey,
        modelId: config.model_id,
        maxTokens: config.max_tokens ?? undefined,
        temperature: config.temperature,
      })
    case 'ollama':
      return new OllamaAdapter({
        llmConfigId: config.id,
        endpointUrl: platform.endpoint_url ?? 'http://localhost:11434',
        modelId: config.model_id,
        temperature: config.temperature,
      })
    case 'custom':
      return new CustomAdapter({
        llmConfigId: config.id,
        endpointUrl: platform.endpoint_url ?? '',
        apiKey: apiKey || undefined,
        modelId: config.model_id,
        temperature: config.temperature,
      })
    default:
      return null
  }
}

/** Try to auto-register any installed CLIs that aren't in llm_configs yet */
function autoRegisterCLIs(): void {
  const { execSync } = require('child_process') as typeof import('child_process')
  const { v4: uuid } = require('uuid') as typeof import('uuid')
  const db = getDb()

  const CLI_DEFAULTS: Array<{ command: string; label: string; model: string }> = [
    { command: 'claude', label: 'Claude Code',  model: 'claude-sonnet-4-6' },
    { command: 'codex',  label: 'Codex CLI',    model: 'gpt-5.1-codex-mini' },
    { command: 'opencode', label: 'OpenCode',   model: 'claude-3-5-sonnet-20241022' },
    { command: 'openclaw', label: 'OpenClaw',   model: 'claude-3-5-sonnet-20241022' },
    { command: 'llm',    label: 'LLM CLI',      model: 'gpt-4o' },
    { command: 'aider',  label: 'Aider',        model: 'claude-sonnet-4-6' },
    { command: 'ollama', label: 'Ollama',       model: 'llama3.2' },
  ]

  for (const cli of CLI_DEFAULTS) {
    // Skip if already configured
    const existing = db
      .prepare("SELECT id FROM llm_configs WHERE provider_type='cli' AND cli_command=?")
      .get(cli.command)
    if (existing) continue

    // Check if installed
    try {
      execSync(`${cli.command} --version`, { stdio: 'pipe', timeout: 4000 })
    } catch {
      continue // not installed
    }

    // Ensure _cli platform exists
    const platform = db.prepare("SELECT id FROM platforms WHERE id='_cli'").get()
    if (!platform) {
      db.prepare("INSERT INTO platforms (id, label, enabled) VALUES ('_cli', 'CLI Tools', 1)").run()
    }

    // Get next priority
    const maxPriority = (db.prepare('SELECT MAX(priority) as m FROM llm_configs').get() as { m: number | null }).m ?? 0

    db.prepare(`
      INSERT INTO llm_configs (id, platform_id, model_id, label, priority, provider_type, cli_command, enabled)
      VALUES (?, '_cli', ?, ?, ?, 'cli', ?, 1)
    `).run(uuid(), cli.model, cli.label, maxPriority + 1, cli.command)
  }
}

export function getOrderedAdapters(targetId?: string): LLMAdapter[] {
  const db = getDb()
  let configs = db
    .prepare('SELECT id FROM llm_configs WHERE enabled = 1 ORDER BY priority ASC')
    .all() as { id: string }[]

  // If nothing configured, try to auto-detect installed CLIs
  if (configs.length === 0) {
    autoRegisterCLIs()
    configs = db
      .prepare('SELECT id FROM llm_configs WHERE enabled = 1 ORDER BY priority ASC')
      .all() as { id: string }[]
  }

  // If a targetId is provided, move it to the front of the list
  if (targetId) {
    const targetIdx = configs.findIndex(c => c.id === targetId)
    if (targetIdx !== -1) {
      const [target] = configs.splice(targetIdx, 1)
      configs.unshift(target)
    }
  }

  return configs.map((c) => buildAdapter(c.id)).filter(Boolean) as LLMAdapter[]
}
