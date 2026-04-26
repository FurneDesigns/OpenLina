import { getDb } from '@/lib/db'
import { ok, bad, fail, readJson } from '@/lib/api/json'
import { applyTemplate } from '@/lib/templates/index'

export const runtime = 'nodejs'

export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    const body = await readJson<{ template: string }>(req)
    if (!body?.template) return bad('template required')
    const project: any = getDb().prepare(`SELECT id, workspace_path FROM projects WHERE id = ? OR slug = ?`).get(ctx.params.id, ctx.params.id)
    if (!project) return bad('project not found', 404)
    const written = applyTemplate(project.workspace_path, body.template)
    return ok({ written })
  } catch (err) { return fail(err) }
}
