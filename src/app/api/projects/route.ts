import path from 'node:path'
import fs from 'node:fs'
import { getDb, genId, nowIso } from '@/lib/db'
import { ok, bad, fail, readJson } from '@/lib/api/json'

export const runtime = 'nodejs'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `proj-${Date.now()}`
}

export async function GET() {
  try {
    const db = getDb()
    const rows = db.prepare(`SELECT id, name, slug, description, framework, workspace_path, created_at, updated_at FROM projects ORDER BY updated_at DESC`).all()
    return ok(rows)
  } catch (err) { return fail(err) }
}

export async function POST(req: Request) {
  try {
    const body = await readJson<any>(req)
    if (!body?.name) return bad('name required')
    const id = genId('proj')
    let slug = slugify(body.slug || body.name)
    const db = getDb()
    // ensure unique slug
    let attempt = 0
    while (db.prepare(`SELECT 1 FROM projects WHERE slug = ?`).get(slug)) {
      attempt++
      slug = `${slugify(body.name)}-${attempt}`
    }
    const workspacePath = body.workspace_path || path.resolve(process.cwd(), 'workspaces', slug)
    fs.mkdirSync(workspacePath, { recursive: true })
    db.prepare(`INSERT INTO projects (id, name, slug, description, project_type, framework, target_audience, key_features, tech_stack, brand_colors, deployment_target, workspace_path, target_llm_config_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, body.name, slug, body.description || null, body.project_type || null, body.framework || null,
      body.target_audience || null, body.key_features || null,
      body.tech_stack ? JSON.stringify(body.tech_stack) : null,
      body.brand_colors ? JSON.stringify(body.brand_colors) : null,
      body.deployment_target || null, workspacePath, body.target_llm_config_id || null,
      nowIso(), nowIso(),
    )
    return ok({ id, slug, workspace_path: workspacePath })
  } catch (err) { return fail(err) }
}
