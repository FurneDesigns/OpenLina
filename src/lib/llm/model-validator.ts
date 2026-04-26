import { spawn } from 'node:child_process'

const SAFE_FALLBACKS: Record<string, string> = {
  claude: 'sonnet',
  codex: 'gpt-5',
  gemini: 'gemini-1.5-pro',
  ollama: 'llama3.1:latest',
  aider: 'gpt-4o',
  opencode: 'sonnet',
  openclaw: 'sonnet',
  llm: 'gpt-4o',
}

const FAMILY_KEYWORDS: Record<string, string[]> = {
  sonnet: ['sonnet'],
  opus: ['opus'],
  haiku: ['haiku'],
  'gpt-5': ['gpt-5'],
  'gpt-4o': ['gpt-4o', 'gpt-4-o', '4o'],
  'gemini-1.5-pro': ['gemini', '1.5', 'pro'],
  llama: ['llama'],
}

const cache = new Map<string, string>()

async function getCliHelp(command: string): Promise<string> {
  return new Promise<string>((resolve) => {
    const child = spawn(command, ['--help'], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (d) => { out += d.toString() })
    child.stderr.on('data', (d) => { out += d.toString() })
    child.on('exit', () => resolve(out))
    child.on('error', () => resolve(''))
    setTimeout(() => { try { child.kill() } catch {}; resolve(out) }, 5_000)
  })
}

export async function detectModels(command: string): Promise<string[]> {
  const help = await getCliHelp(command)
  const matches = help.match(/[a-z][a-z0-9_.\-:]+/gi) || []
  return Array.from(new Set(matches.map((m) => m.toLowerCase())))
}

export async function validateAndFixModelId(command: string, requested?: string): Promise<string | undefined> {
  if (!requested) return SAFE_FALLBACKS[command]
  const cacheKey = `${command}::${requested}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)
  const tokens = await detectModels(command)
  const lower = requested.toLowerCase()
  if (tokens.includes(lower)) { cache.set(cacheKey, requested); return requested }
  // Try alias by family
  for (const [family, kws] of Object.entries(FAMILY_KEYWORDS)) {
    if (kws.some((kw) => lower.includes(kw))) {
      cache.set(cacheKey, family)
      return family
    }
  }
  const fallback = SAFE_FALLBACKS[command]
  cache.set(cacheKey, fallback || requested)
  return fallback || requested
}
