import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

function rowToProject(r: Record<string, unknown>) {
  return {
    id: r.id, name: r.name, slug: r.slug,
    description: r.description, projectType: r.project_type,
    framework: r.framework, workspacePath: r.workspace_path,
    assetsDir: r.assets_dir, targetAudience: r.target_audience,
    brandColors:      r.brand_colors   ? JSON.parse(r.brand_colors as string)   : null,
    keyFeatures:      r.key_features   ? JSON.parse(r.key_features as string)   : [],
    techStack:        r.tech_stack     ? JSON.parse(r.tech_stack as string)     : [],
    deploymentTarget: r.deployment_target,
    targetLlmConfigId: r.target_llm_config_id,
    i18nStrategy:     r.i18n_strategy,
    i18nLocales:      r.i18n_locales   ? JSON.parse(r.i18n_locales as string)   : [],
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const row = db.prepare('SELECT * FROM projects WHERE id = ? OR slug = ?').get(params.id, params.id) as Record<string, unknown> | undefined
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(rowToProject(row))
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json()) as Record<string, unknown>
  const db = getDb()
  if (body.brandColors) body.brandColors = JSON.stringify(body.brandColors)
  if (body.keyFeatures) body.keyFeatures = JSON.stringify(body.keyFeatures)
  if (body.techStack)   body.techStack   = JSON.stringify(body.techStack)
  if (body.i18nLocales) body.i18nLocales = JSON.stringify(body.i18nLocales)

  const map: Record<string, string> = {
    name: 'name', description: 'description', targetAudience: 'target_audience',
    brandColors: 'brand_colors', keyFeatures: 'key_features', techStack: 'tech_stack',
    deploymentTarget: 'deployment_target', targetLlmConfigId: 'target_llm_config_id', i18nStrategy: 'i18n_strategy',
  }

  const sets: string[] = []
  const vals: unknown[] = []
  for (const [key, col] of Object.entries(map)) {
    if (body[key] !== undefined) { sets.push(`${col} = ?`); vals.push(body[key]) }
  }
  if (sets.length === 0) return NextResponse.json({ ok: true })
  sets.push("updated_at = datetime('now')")
  vals.push(params.id)
  db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...vals)

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  db.prepare('DELETE FROM projects WHERE id = ?').run(params.id)
  return NextResponse.json({ ok: true })
}
