import { getDb } from '@/lib/db'
import { ok, bad, fail } from '@/lib/api/json'

export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const db = getDb()
    const project: any = db.prepare(`SELECT id FROM projects WHERE id = ? OR slug = ?`).get(ctx.params.id, ctx.params.id)
    if (!project) return bad('project not found', 404)
    const runs = db.prepare(`SELECT * FROM project_runs WHERE project_id = ? ORDER BY started_at DESC`).all(project.id)
    return ok(runs)
  } catch (err) { return fail(err) }
}
