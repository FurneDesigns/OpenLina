import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDb } from '@/lib/db'
import { broadcastLLMQueueUpdate } from '@/server/socket'

export async function GET() {
  const db = getDb()
  const configs = db.prepare(`
    SELECT lc.*, p.label as platform_label
    FROM llm_configs lc
    JOIN platforms p ON lc.platform_id = p.id
    ORDER BY lc.priority ASC
  `).all()
  return NextResponse.json(configs)
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    platformId?: string
    modelId: string
    label: string
    maxTokens?: number
    temperature?: number
    systemPrompt?: string
    enabled?: boolean
    // CLI fields
    providerType?: 'api' | 'cli'
    cliCommand?: string
    cliEnvVars?: Record<string, string>
  }

  const db = getDb()
  const maxPriority = (db.prepare('SELECT MAX(priority) as m FROM llm_configs').get() as { m: number | null }).m ?? 0
  const id = uuid()
  const providerType = body.providerType ?? 'api'
  // CLI configs use the reserved '_cli' platform
  const platformId = providerType === 'cli' ? '_cli' : (body.platformId ?? '_cli')

  db.prepare(`
    INSERT INTO llm_configs
      (id, platform_id, model_id, label, priority, max_tokens, temperature, system_prompt, enabled,
       provider_type, cli_command, cli_env_vars)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, platformId, body.modelId, body.label,
    maxPriority + 1,
    body.maxTokens ?? null,
    body.temperature ?? 0.7,
    body.systemPrompt ?? null,
    body.enabled !== false ? 1 : 0,
    providerType,
    body.cliCommand ?? null,
    body.cliEnvVars ? JSON.stringify(body.cliEnvVars) : null,
  )

  broadcastLLMQueueUpdate()
  return NextResponse.json({ id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  // Reorder: accepts [{id, priority}]
  const body = (await req.json()) as Array<{ id: string; priority: number }>
  const db = getDb()
  const update = db.prepare("UPDATE llm_configs SET priority = ?, updated_at = datetime('now') WHERE id = ?")
  db.exec('BEGIN')
  try {
    for (const item of body) {
      update.run(item.priority, item.id)
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  broadcastLLMQueueUpdate()
  return NextResponse.json({ ok: true })
}
