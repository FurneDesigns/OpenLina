import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import fs from 'fs'
import path from 'path'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const project = db.prepare('SELECT workspace_path FROM projects WHERE id = ?').get(params.id) as
    { workspace_path: string } | undefined

  if (!project?.workspace_path) {
    return new NextResponse('Not found', { status: 404 })
  }

  const taskPath = path.join(project.workspace_path, 'task.md')
  if (!fs.existsSync(taskPath)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const content = fs.readFileSync(taskPath, 'utf-8')
  return new NextResponse(content, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
