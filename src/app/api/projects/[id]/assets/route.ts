import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import fs from 'fs'
import path from 'path'

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/svg+xml', 'image/ico', 'image/x-icon',
])
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const project = db.prepare('SELECT assets_dir FROM projects WHERE id = ? OR slug = ?').get(params.id, params.id) as { assets_dir: string } | undefined
  if (!project?.assets_dir) return NextResponse.json([])

  if (!fs.existsSync(project.assets_dir)) return NextResponse.json([])

  const files = fs.readdirSync(project.assets_dir)
    .filter((f) => !f.startsWith('.'))
    .map((f) => {
      const fullPath = path.join(project.assets_dir, f)
      const stat = fs.statSync(fullPath)
      return {
        name: f,
        size: stat.size,
        url: `/api/projects/${params.id}/assets/${encodeURIComponent(f)}`,
        modifiedAt: stat.mtime.toISOString(),
      }
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))

  return NextResponse.json(files)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const project = db.prepare('SELECT assets_dir FROM projects WHERE id = ? OR slug = ?').get(params.id, params.id) as { assets_dir: string } | undefined
  if (!project?.assets_dir) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  fs.mkdirSync(project.assets_dir, { recursive: true })

  const formData = await req.formData()
  const uploaded: { name: string; size: number; url: string }[] = []
  const errors: string[] = []

  const entries = Array.from(formData.entries())
  for (const [, value] of entries) {
    if (!(value instanceof File)) continue

    if (!ALLOWED_TYPES.has(value.type)) {
      errors.push(`${value.name}: unsupported type (${value.type})`)
      continue
    }
    if (value.size > MAX_SIZE_BYTES) {
      errors.push(`${value.name}: too large (max 10 MB)`)
      continue
    }

    // Sanitize filename
    const safeName = value.name.replace(/[^a-zA-Z0-9._\-]/g, '_')
    const destPath = path.join(project.assets_dir, safeName)

    const buffer = Buffer.from(await value.arrayBuffer())
    fs.writeFileSync(destPath, buffer)

    uploaded.push({
      name: safeName,
      size: value.size,
      url: `/api/projects/${params.id}/assets/${encodeURIComponent(safeName)}`,
    })
  }

  return NextResponse.json({ uploaded, errors }, { status: uploaded.length > 0 ? 201 : 400 })
}
