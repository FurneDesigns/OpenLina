import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { devServerManager } from '@/lib/devserver/DevServerManager'

function getProject(id: string) {
  const db = getDb()
  return db.prepare('SELECT id, workspace_path FROM projects WHERE id = ? OR slug = ?').get(id, id) as
    { id: string; workspace_path: string } | undefined
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = getProject(params.id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const status = devServerManager.getStatus(project.id)
  return NextResponse.json(status ?? { status: 'stopped' })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project = getProject(params.id)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!project.workspace_path) return NextResponse.json({ error: 'No workspace path' }, { status: 400 })

  const body = await req.json().catch(() => ({})) as { action?: string }

  if (body.action === 'stop') {
    devServerManager.stop(project.id)
    return NextResponse.json({ status: 'stopped' })
  }

  // Start (non-blocking — client polls or uses socket for readiness)
  devServerManager.start(project.id, project.workspace_path).catch(() => {})
  return NextResponse.json({ status: 'starting' })
}
