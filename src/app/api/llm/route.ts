import { getDb, genId, nowIso } from '@/lib/db'
import { ok, bad, fail, readJson } from '@/lib/api/json'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const rows = getDb().prepare(`SELECT * FROM llm_configs ORDER BY priority DESC, created_at ASC`).all()
    return ok(rows)
  } catch (err) { return fail(err) }
}

export async function POST(req: Request) {
  try {
    const body = await readJson<any>(req)
    if (!body?.provider_type) return bad('provider_type required')
    const id = genId('llm')
    getDb().prepare(`INSERT INTO llm_configs (id, platform_id, label, model_id, provider_type, cli_command, enabled, priority, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, body.platform_id || null, body.label || null, body.model_id || null,
      body.provider_type, body.cli_command || null,
      body.enabled === false ? 0 : 1, body.priority ?? 0, nowIso(),
    )
    return ok({ id })
  } catch (err) { return fail(err) }
}
