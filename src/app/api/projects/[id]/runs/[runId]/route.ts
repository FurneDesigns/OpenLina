import { getDb } from '@/lib/db'
import { ok, bad, fail } from '@/lib/api/json'

export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: { id: string; runId: string } }) {
  try {
    const db = getDb()
    const run = db.prepare(`SELECT * FROM project_runs WHERE id = ?`).get(ctx.params.runId)
    if (!run) return bad('run not found', 404)
    const steps = db.prepare(`SELECT * FROM run_steps WHERE run_id = ? ORDER BY created_at ASC`).all(ctx.params.runId)
    return ok({ run, steps })
  } catch (err) { return fail(err) }
}
