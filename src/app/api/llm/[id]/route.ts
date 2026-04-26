import { getDb } from '@/lib/db'
import { ok, fail, readJson } from '@/lib/api/json'

export const runtime = 'nodejs'

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const body = await readJson<any>(req)
    const fields: string[] = []
    const values: any[] = []
    for (const k of ['platform_id','label','model_id','provider_type','cli_command','enabled','priority']) {
      if (k in body) { fields.push(`${k} = ?`); values.push(k === 'enabled' ? (body[k] ? 1 : 0) : body[k]) }
    }
    if (!fields.length) return ok({ updated: 0 })
    values.push(ctx.params.id)
    const res = getDb().prepare(`UPDATE llm_configs SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return ok({ updated: res.changes })
  } catch (err) { return fail(err) }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  try {
    const res = getDb().prepare(`DELETE FROM llm_configs WHERE id = ?`).run(ctx.params.id)
    return ok({ deleted: res.changes })
  } catch (err) { return fail(err) }
}
