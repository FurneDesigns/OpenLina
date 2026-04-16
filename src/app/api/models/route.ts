import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/** Extract stored cli_env_vars for a given CLI command */
function getCLIEnvVars(command: string): Record<string, string> {
  try {
    const db = getDb()
    const row = db
      .prepare("SELECT cli_env_vars FROM llm_configs WHERE provider_type='cli' AND cli_command=? LIMIT 1")
      .get(command) as { cli_env_vars: string | null } | undefined
    if (row?.cli_env_vars) return JSON.parse(row.cli_env_vars) as Record<string, string>
  } catch {}
  return {}
}

async function fetchOpenAIModels(key: string): Promise<string[]> {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)
  const data = (await res.json()) as { data: { id: string }[] }
  return data.data.map((m) => m.id).sort()
}

async function fetchAnthropicModels(key: string): Promise<string[]> {
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
  })
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`)
  const data = (await res.json()) as { data: { id: string }[] }
  return data.data.map((m) => m.id).sort()
}

async function fetchGeminiModels(key: string): Promise<string[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
  )
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)
  const data = (await res.json()) as {
    models: { name: string; supportedGenerationMethods?: string[] }[]
  }
  return (data.models || [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace('models/', ''))
    .sort()
}

/** Try to run a CLI command non-interactively and parse its model output */
async function runCLIModels(command: string): Promise<string[] | null> {
  // Different CLIs expose their model list differently
  const strategies: Array<{ cmd: string; parse: (out: string) => string[] }> = []

  if (command === 'codex') {
    strategies.push({
      // codex exposes --list-models (non-interactive, exits immediately)
      cmd: 'codex --list-models 2>/dev/null || codex models 2>/dev/null',
      parse: (out) =>
        out
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => /^[a-z][a-z0-9.\-]+/.test(l))
          .map((l) => l.split(/\s+/)[0]),
    })
  }

  if (command === 'claude') {
    strategies.push({
      // claude code may list models with --list-models or similar
      cmd: 'claude --list-models 2>/dev/null || claude models 2>/dev/null',
      parse: (out) =>
        out
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => /^claude-/.test(l))
          .map((l) => l.split(/\s+/)[0]),
    })
  }

  if (command === 'llm') {
    strategies.push({
      cmd: 'llm models 2>/dev/null',
      parse: (out) =>
        out
          .split('\n')
          .flatMap((line) => {
            const match = line.match(/^\s*([a-zA-Z0-9][a-zA-Z0-9.\-:_/]+)/)
            return match ? [match[1]] : []
          })
          .filter((m) => !m.endsWith(':')),
    })
  }

  if (command === 'aider') {
    strategies.push({
      cmd: 'aider --list-models "" 2>/dev/null || aider --models 2>/dev/null',
      parse: (out) =>
        out
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => /^[a-z]/.test(l) && l.includes('/') || /^(gpt|claude|gemini|o[0-9])/.test(l))
          .map((l) => l.split(/\s+/)[0]),
    })
  }

  if (command === 'ollama') {
    strategies.push({
      cmd: 'ollama list 2>/dev/null',
      parse: (out) =>
        out
          .split('\n')
          .slice(1) // skip header
          .map((l) => l.split(/\s+/)[0])
          .filter(Boolean),
    })
  }

  if (command === 'opencode') {
    strategies.push({
      cmd: 'opencode models 2>/dev/null',
      parse: (out) =>
        out
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.includes('/') && !l.includes(' ') && !l.startsWith('Use '))
          .map(l => l.split(/\s+/)[0])
    })
  }

  if (command === 'openclaw') {
    strategies.push({
      cmd: 'openclaw models 2>/dev/null',
      parse: (out) =>
        out
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.includes('/') && !l.includes(' ') && !l.startsWith('Use '))
          .map(l => l.split(/\s+/)[0])
    })
  }

  for (const strategy of strategies) {
    try {
      const { stdout } = await execAsync(strategy.cmd, { timeout: 6000, shell: '/bin/bash' })
      const models = [...new Set(strategy.parse(stdout))].filter(Boolean).sort()
      if (models.length > 0) return models
    } catch {
      // try next strategy
    }
  }

  return null
}

/** Curated fallback lists for subscription CLIs that may not expose --list-models */
const CLI_FALLBACKS: Record<string, string[]> = {
  openclaw: [
    'opencode/big-pickle',
    'opencode/minimax-m2.5-free',
    'opencode/nemotron-3-super-free',
    'opencode/mimo-v2-pro-free',
    'opencode/llama-3.1-70b-instruct',
    'claude-3-5-sonnet-20241022',
  ],
  opencode: [
    'opencode/big-pickle',
    'opencode/minimax-m2.5-free',
    'opencode/nemotron-3-super-free',
    'opencode/mimo-v2-pro-free',
    'opencode/llama-3.1-70b-instruct',
    'claude-3-5-sonnet-20241022',
    'gpt-4o',
  ],
  codex: [
    'gpt-5.4',
    'gpt-5.4-mini',
    'gpt-5.3-codex',
    'gpt-5.2-codex',
    'gpt-5.2',
    'gpt-5.1-codex-max',
    'gpt-5.1-codex-mini',
  ],
  claude: [
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
  ],
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') // 'api' or 'cli'
  const id   = searchParams.get('id')   // providerId or cli command

  if (!type || !id) {
    return NextResponse.json({ error: 'Missing type or id' }, { status: 400 })
  }

  const db = getDb()

  try {
    // ── Direct API providers ──────────────────────────────────────────────────
    if (type === 'api') {
      const platform = db
        .prepare('SELECT api_key, endpoint_url FROM platforms WHERE id = ?')
        .get(id) as { api_key?: string; endpoint_url?: string } | undefined

      if (id === 'openai') {
        const key = platform?.api_key || process.env.OPENAI_API_KEY
        if (!key) return NextResponse.json({ error: 'No API key configured for OpenAI' }, { status: 401 })
        return NextResponse.json({ models: await fetchOpenAIModels(key) })
      }

      if (id === 'anthropic') {
        const key = platform?.api_key || process.env.ANTHROPIC_API_KEY
        if (!key) return NextResponse.json({ error: 'No API key configured for Anthropic' }, { status: 401 })
        return NextResponse.json({ models: await fetchAnthropicModels(key) })
      }

      if (id === 'google') {
        const key = platform?.api_key || process.env.GOOGLE_API_KEY
        if (!key) return NextResponse.json({ error: 'No API key configured for Google' }, { status: 401 })
        return NextResponse.json({ models: await fetchGeminiModels(key) })
      }

    }

    // ── CLI tools ─────────────────────────────────────────────────────────────
    if (type === 'cli') {
      // 1. Try running the CLI itself (no API key needed — uses subscription auth)
      const fromCLI = await runCLIModels(id)
      if (fromCLI && fromCLI.length > 0) {
        return NextResponse.json({ models: fromCLI })
      }

      // 2. If CLI doesn't expose models, try with stored API key (aider, opencode, llm with API keys)
      const envVars = getCLIEnvVars(id)
      if (id === 'aider' || id === 'opencode') {
        const anthropicKey = envVars['ANTHROPIC_API_KEY'] || process.env.ANTHROPIC_API_KEY
        const openaiKey    = envVars['OPENAI_API_KEY']    || process.env.OPENAI_API_KEY
        const models: string[] = []
        if (anthropicKey) {
          try { models.push(...await fetchAnthropicModels(anthropicKey)) } catch {}
        }
        if (openaiKey) {
          try { models.push(...await fetchOpenAIModels(openaiKey)) } catch {}
        }
        if (models.length > 0) return NextResponse.json({ models: [...new Set(models)].sort() })
      }

      // 3. Special fallback for Ollama via HTTP if CLI fails
      if (id === 'ollama') {
        try {
          const url = 'http://127.0.0.1:11434'
          const res = await fetch(`${url}/api/tags`)
          if (res.ok) {
            const data = (await res.json()) as { models: { name: string }[] }
            if (data.models && data.models.length > 0) {
              return NextResponse.json({ models: data.models.map((m) => m.name).sort() })
            }
          }
        } catch { /* ignore fallback error */ }
      }

      // 4. Return curated fallback list if we know the CLI
      const fallback = CLI_FALLBACKS[id]
      if (fallback) return NextResponse.json({ models: fallback, fallback: true })

      return NextResponse.json({ models: [] })
    }

    return NextResponse.json({ models: [] })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch models'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
