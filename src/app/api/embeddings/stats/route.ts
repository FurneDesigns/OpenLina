import { getDb } from '@/lib/db'
import { ok, fail } from '@/lib/api/json'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const db = getDb()
    const total = db.prepare(`SELECT COUNT(*) AS c FROM embeddings`).get() as any
    const byProject = db.prepare(`SELECT project_id, COUNT(*) AS c FROM embeddings GROUP BY project_id`).all()
    const bySource = db.prepare(`SELECT source_type, COUNT(*) AS c FROM embeddings GROUP BY source_type`).all()
    return ok({ total: total.c, byProject, bySource })
  } catch (err) { return fail(err) }
}
