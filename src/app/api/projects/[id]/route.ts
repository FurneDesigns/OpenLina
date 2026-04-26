import fs from 'node:fs'
import path from 'node:path'
import { getDb, nowIso, safeJsonParse } from '@/lib/db'
import { ok, bad, fail, readJson } from '@/lib/api/json'
import { devServerManager } from '@/lib/devserver/DevServerManager'

export const runtime = 'nodejs'

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  try {
    const db = getDb()
    const row = db.prepare(`SELECT * FROM projects WHERE id = ? OR slug = ?`).get(ctx.params.id, ctx.params.id)
    if (!row) return bad('not found', 404)
    const r: any = row
    r.tech_stack = safeJsonParse(r.tech_stack, [])
    r.brand_colors = safeJsonParse(r.brand_colors, {})
    return ok(r)
  } catch (err) { return fail(err) }
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const body = await readJson<any>(req)
    const db = getDb()
    const fields: string[] = []
    const values: any[] = []
    const allowed = ['name', 'description', 'project_type', 'framework', 'target_audience', 'key_features', 'deployment_target', 'workspace_path', 'target_llm_config_id']
    for (const k of allowed) {
      if (k in body) { fields.push(`${k} = ?`); values.push(body[k]) }
    }
    if ('tech_stack' in body) { fields.push('tech_stack = ?'); values.push(JSON.stringify(body.tech_stack)) }
    if ('brand_colors' in body) { fields.push('brand_colors = ?'); values.push(JSON.stringify(body.brand_colors)) }
    if (!fields.length) return ok({ updated: 0 })
    fields.push('updated_at = ?'); values.push(nowIso())
    values.push(ctx.params.id, ctx.params.id)
    const res = db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ? OR slug = ?`).run(...values)
    return ok({ updated: res.changes })
  } catch (err) { return fail(err) }
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  try {
    const url = new URL(req.url)
    const confirmName = url.searchParams.get('confirm') || ''
    const db = getDb()
    const row: any = db.prepare(`SELECT id, name, workspace_path FROM projects WHERE id = ? OR slug = ?`).get(ctx.params.id, ctx.params.id)
    if (!row) return bad('not found', 404)
    if (confirmName !== row.name) {
      return bad(`confirmation name mismatch (expected "${row.name}")`, 400)
    }
    // Stop dev server if running
    try { await devServerManager.stop(row.id) } catch {}
    // Cascade DB rows in correct order (steps first, then runs, then agents, then embeddings, then project)
    db.prepare(`DELETE FROM run_steps WHERE run_id IN (SELECT id FROM project_runs WHERE project_id = ?)`).run(row.id)
    db.prepare(`DELETE FROM project_runs WHERE project_id = ?`).run(row.id)
    db.prepare(`DELETE FROM agents WHERE project_id = ?`).run(row.id)
    try { db.prepare(`DELETE FROM embeddings WHERE project_id = ?`).run(row.id) } catch {}
    db.prepare(`DELETE FROM projects WHERE id = ?`).run(row.id)
    // Delete workspace folder + any sibling stash dirs we created during scaffolding
    let workspaceDeleted = false
    if (row.workspace_path && isInsideProjectsRoot(row.workspace_path)) {
      try { fs.rmSync(row.workspace_path, { recursive: true, force: true }); workspaceDeleted = true } catch {}
      try {
        const parent = path.dirname(row.workspace_path)
        const base = path.basename(row.workspace_path)
        for (const entry of fs.readdirSync(parent)) {
          if (entry.startsWith(`.${base}.stash-`)) {
            try { fs.rmSync(path.join(parent, entry), { recursive: true, force: true }) } catch {}
          }
        }
      } catch {}
    }
    return ok({ deleted: true, workspaceDeleted })
  } catch (err) { return fail(err) }
}

function isInsideProjectsRoot(workspace: string): boolean {
  // Safety net: only delete folders that look like ours (contain "workspaces" segment).
  const norm = path.resolve(workspace)
  return norm.includes(`${path.sep}workspaces${path.sep}`) || norm.includes('/workspaces/')
}
