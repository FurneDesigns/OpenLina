import { spawn } from 'node:child_process'
import type { LLMAdapter } from './types'

interface HealthEntry {
  ok: boolean
  ts: number
}

const CACHE = new Map<string, HealthEntry>()
const TTL = 10 * 60_000

export function clearHealthCache(): void {
  CACHE.clear()
}

function cacheKey(adapter: LLMAdapter): string {
  return `${adapter.providerType}:${adapter.cliCommand || adapter.id}:${adapter.modelId || ''}`
}

export async function checkAdapterHealth(adapter: LLMAdapter): Promise<boolean> {
  const key = cacheKey(adapter)
  const cached = CACHE.get(key)
  if (cached && Date.now() - cached.ts < TTL) return cached.ok

  let ok = false
  try {
    if (adapter.providerType === 'cli' && adapter.cliCommand) {
      ok = await checkCliHealth(adapter.cliCommand)
    } else {
      // For API adapters do a tiny ping (just construct + small request)
      const text = await Promise.race([
        adapter.invoke({
          messages: [
            { role: 'system', content: 'Reply with the single word OK.' },
            { role: 'user', content: 'ping' },
          ],
        }).then((r) => r.text || ''),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('health-timeout')), 30_000)),
      ])
      ok = /\bok\b/i.test(text)
    }
  } catch {
    ok = false
  }
  CACHE.set(key, { ok, ts: Date.now() })
  return ok
}

export async function checkCliHealth(command: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const child = spawn(command, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] })
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      try { child.kill('SIGKILL') } catch {}
      resolve(ok)
    }
    let buf = ''
    child.stdout.on('data', (d) => { buf += d.toString() })
    child.stderr.on('data', (d) => { buf += d.toString() })
    child.on('exit', (code) => finish(code === 0 || /\d+\.\d+/.test(buf)))
    child.on('error', () => finish(false))
    setTimeout(() => finish(false), 30_000)
  })
}

export async function pickFirstHealthyAdapter(adapters: LLMAdapter[]): Promise<LLMAdapter | null> {
  for (const a of adapters) {
    const ok = await checkAdapterHealth(a)
    if (ok) return a
  }
  return null
}
