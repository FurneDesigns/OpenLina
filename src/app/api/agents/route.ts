import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDb } from '@/lib/db'

function rowToAgent(row: Record<string, unknown>) {
  return {
    id:           row.id,
    projectId:    row.project_id,
    name:         row.name,
    description:  row.description,
    llmConfigId:  row.llm_config_id,
    systemPrompt: row.system_prompt ?? '',
    tools:        row.tools ? JSON.parse(row.tools as string) : [],
    canvasX:      Number(row.canvas_x ?? 100),
    canvasY:      Number(row.canvas_y ?? 100),
    status:       row.status ?? 'idle',
    color:        row.color ?? '#6366f1',
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
  }
}

export async function GET() {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM agents ORDER BY created_at ASC').all() as Record<string, unknown>[]
  return NextResponse.json(rows.map(rowToAgent))
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name: string
    description?: string
    llmConfigId?: string
    systemPrompt?: string
    tools?: string[]
    canvasX?: number
    canvasY?: number
    color?: string
    projectId?: string
  }

  const db = getDb()
  const id = uuid()

  db.prepare(`
    INSERT INTO agents (id, project_id, name, description, llm_config_id, system_prompt, tools, canvas_x, canvas_y, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.projectId ?? null,
    body.name,
    body.description ?? null,
    body.llmConfigId ?? null,
    body.systemPrompt ?? '',
    JSON.stringify(body.tools ?? []),
    Number.isFinite(body.canvasX) ? body.canvasX : 100,
    Number.isFinite(body.canvasY) ? body.canvasY : 100,
    body.color ?? '#6366f1',
  )

  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Record<string, unknown>
  return NextResponse.json(rowToAgent(row), { status: 201 })
}
