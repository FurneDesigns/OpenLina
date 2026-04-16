import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDb } from '@/lib/db'
import { DATA_DIR } from '@/lib/db'
import fs from 'fs'
import path from 'path'

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
}

function rowToProject(r: Record<string, unknown>) {
  return {
    id:               r.id,
    name:             r.name,
    slug:             r.slug,
    description:      r.description,
    projectType:      r.project_type,
    framework:        r.framework,
    rootPath:         r.root_path,
    workspacePath:    r.workspace_path,
    assetsDir:        r.assets_dir,
    targetAudience:   r.target_audience,
    brandColors:      r.brand_colors      ? JSON.parse(r.brand_colors as string)      : null,
    keyFeatures:      r.key_features      ? JSON.parse(r.key_features as string)      : [],
    techStack:        r.tech_stack        ? JSON.parse(r.tech_stack as string)        : [],
    deploymentTarget: r.deployment_target,
    targetLlmConfigId: r.target_llm_config_id,
    i18nStrategy:     r.i18n_strategy,
    i18nLocales:      r.i18n_locales      ? JSON.parse(r.i18n_locales as string)      : [],
    defaultLocale:    r.default_locale,
    createdAt:        r.created_at,
    updatedAt:        r.updated_at,
  }
}

export async function GET() {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Record<string, unknown>[]
  return NextResponse.json(rows.map(rowToProject))
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name: string
    description?: string
    projectType: string
    framework: string
    targetAudience?: string
    brandColors?: Record<string, string>
    keyFeatures?: string[]
    techStack?: string[]
    deploymentTarget?: string
    i18nStrategy?: string
    i18nLocales?: string[]
    defaultLocale?: string
    targetLlmConfigId?: string
  }

  const db = getDb()
  const id = uuid()

  // Create unique slug
  let slug = slugify(body.name || 'project')
  const existing = db.prepare('SELECT id FROM projects WHERE slug = ?').get(slug)
  if (existing) slug = `${slug}-${id.slice(0, 6)}`

  // Create workspace and assets directories
  const workspacePath = path.join(DATA_DIR, 'projects', slug, 'workspace')
  const assetsDir     = path.join(DATA_DIR, 'projects', slug, 'assets')
  fs.mkdirSync(workspacePath, { recursive: true })
  fs.mkdirSync(assetsDir, { recursive: true })

  db.prepare(`
    INSERT INTO projects (
      id, name, slug, description, project_type, framework,
      root_path, workspace_path, assets_dir,
      target_audience, brand_colors, key_features, tech_stack,
      deployment_target, i18n_strategy, i18n_locales, default_locale,
      target_llm_config_id
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, body.name, slug, body.description ?? null,
    body.projectType, body.framework,
    workspacePath, workspacePath, assetsDir,
    body.targetAudience ?? null,
    body.brandColors  ? JSON.stringify(body.brandColors)  : null,
    body.keyFeatures  ? JSON.stringify(body.keyFeatures)  : null,
    body.techStack    ? JSON.stringify(body.techStack)    : null,
    body.deploymentTarget ?? null,
    body.i18nStrategy ?? 'none',
    body.i18nLocales  ? JSON.stringify(body.i18nLocales)  : null,
    body.defaultLocale ?? null,
    body.targetLlmConfigId ?? null,
  )

  db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('active_project_id',?)").run(id)

  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown>
  return NextResponse.json(rowToProject(row), { status: 201 })
}
