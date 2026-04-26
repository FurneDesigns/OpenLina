import { getDb } from '@/lib/db'
import { ok, bad, fail, readJson } from '@/lib/api/json'

export const runtime = 'nodejs'

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const body = await readJson<any>(req)
    const fields: string[] = []
    const values: any[] = []
    for (const k of ['name','role','responsibilities','system_prompt','execution_order','max_iterations','status','role_kind','reviews_agent_id']) {
      if (k in body) { fields.push(`${k} = ?`); values.push(body[k]) }
    }
    if (!fields.length) return ok({ updated: 0 })
    values.push(ctx.params.id)
    const res = getDb().prepare(`UPDATE agents SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return ok({ updated: res.changes })
  } catch (err) { return fail(err) }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  try {
    const res = getDb().prepare(`DELETE FROM agents WHERE id = ?`).run(ctx.params.id)
    return ok({ deleted: res.changes })
  } catch (err) { return fail(err) }
}
