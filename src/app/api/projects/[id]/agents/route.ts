import { getDb, genId } from '@/lib/db'
import { ok, bad, fail, readJson } from '@/lib/api/json'

export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const db = getDb()
    const project: any = db.prepare(`SELECT id FROM projects WHERE id = ? OR slug = ?`).get(ctx.params.id, ctx.params.id)
    if (!project) return bad('project not found', 404)
    const rows = db.prepare(`SELECT * FROM agents WHERE project_id = ? ORDER BY execution_order ASC`).all(project.id)
    return ok(rows)
  } catch (err) { return fail(err) }
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    const body = await readJson<any>(req)
    if (!body?.name) return bad('name required')
    const db = getDb()
    const project: any = db.prepare(`SELECT id FROM projects WHERE id = ? OR slug = ?`).get(ctx.params.id, ctx.params.id)
    if (!project) return bad('project not found', 404)
    const id = genId('agent')
    const order = body.execution_order ?? ((db.prepare(`SELECT COUNT(*) as c FROM agents WHERE project_id = ?`).get(project.id) as any).c)
    db.prepare(`INSERT INTO agents (id, project_id, name, role, responsibilities, system_prompt, execution_order, max_iterations, status, role_kind, reviews_agent_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, project.id, body.name, body.role || 'dev', body.responsibilities || null,
      body.system_prompt || null, order, body.max_iterations ?? 3, 'idle',
      body.role_kind || 'worker', body.reviews_agent_id || null,
    )
    return ok({ id })
  } catch (err) { return fail(err) }
}
