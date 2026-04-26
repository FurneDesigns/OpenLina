import fs from 'node:fs'
import path from 'node:path'
import { getDb } from '@/lib/db'
import { ok, bad, fail } from '@/lib/api/json'

export const runtime = 'nodejs'

export async function GET(req: Request, ctx: { params: { id: string } }) {
  try {
    const url = new URL(req.url)
    const rel = url.searchParams.get('path') || ''
    if (!rel) return bad('path required')
    if (rel.includes('..') || rel.startsWith('/')) return bad('invalid path')
    const project: any = getDb().prepare(`SELECT id, workspace_path FROM projects WHERE id = ? OR slug = ?`).get(ctx.params.id, ctx.params.id)
    if (!project) return bad('project not found', 404)
    const full = path.join(project.workspace_path, rel)
    const norm = path.resolve(full)
    if (!norm.startsWith(path.resolve(project.workspace_path))) return bad('escapes workspace')
    if (!fs.existsSync(norm)) return bad('not found', 404)
    const content = fs.readFileSync(norm, 'utf8')
    return ok({ path: rel, absolutePath: norm, content })
  } catch (err) { return fail(err) }
}
