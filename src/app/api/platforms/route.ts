import { getDb, genId, nowIso } from '@/lib/db'
import { ok, bad, fail, readJson } from '@/lib/api/json'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const rows = getDb().prepare(`SELECT id, label, endpoint_url, enabled, created_at, CASE WHEN api_key IS NULL THEN 0 ELSE 1 END AS has_key FROM platforms ORDER BY id ASC`).all()
    return ok(rows)
  } catch (err) { return fail(err) }
}

export async function POST(req: Request) {
  try {
    const body = await readJson<any>(req)
    if (!body?.id) return bad('id required (e.g. anthropic, openai, google, ollama)')
    const db = getDb()
    const exists: any = db.prepare(`SELECT id FROM platforms WHERE id = ?`).get(body.id)
    if (exists) {
      db.prepare(`UPDATE platforms SET label = ?, api_key = ?, endpoint_url = ?, enabled = ? WHERE id = ?`).run(
        body.label || null, body.api_key || null, body.endpoint_url || null,
        body.enabled === false ? 0 : 1, body.id,
      )
      return ok({ id: body.id, updated: true })
    }
    db.prepare(`INSERT INTO platforms (id, label, api_key, endpoint_url, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      body.id, body.label || null, body.api_key || null, body.endpoint_url || null,
      body.enabled === false ? 0 : 1, nowIso(),
    )
    return ok({ id: body.id, created: true })
  } catch (err) { return fail(err) }
}
