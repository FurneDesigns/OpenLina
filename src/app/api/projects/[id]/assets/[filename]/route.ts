import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import fs from 'fs'
import path from 'path'

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; filename: string } }
) {
  const db = getDb()
  const project = db.prepare('SELECT assets_dir FROM projects WHERE id = ? OR slug = ?').get(params.id, params.id) as { assets_dir: string } | undefined
  if (!project?.assets_dir) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const safeName = decodeURIComponent(params.filename).replace(/[^a-zA-Z0-9._\-]/g, '_')
  const filePath = path.join(project.assets_dir, safeName)

  if (!filePath.startsWith(project.assets_dir) || !fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const ext = path.extname(safeName).toLowerCase()
  const contentType = MIME[ext] ?? 'application/octet-stream'
  const buffer = fs.readFileSync(filePath)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; filename: string } }
) {
  const db = getDb()
  const project = db.prepare('SELECT assets_dir FROM projects WHERE id = ? OR slug = ?').get(params.id, params.id) as { assets_dir: string } | undefined
  if (!project?.assets_dir) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const safeName = decodeURIComponent(params.filename).replace(/[^a-zA-Z0-9._\-]/g, '_')
  const filePath = path.join(project.assets_dir, safeName)

  if (!filePath.startsWith(project.assets_dir) || !fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  fs.unlinkSync(filePath)
  return NextResponse.json({ ok: true })
}
