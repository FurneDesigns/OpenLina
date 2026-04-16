import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(params.id) as Record<string, unknown> | undefined
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(rowToAgent(row))
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json()) as {
    name?: string
    description?: string
    llmConfigId?: string
    systemPrompt?: string
    tools?: string[]
    canvasX?: number
    canvasY?: number
    color?: string
    status?: string
  }

  const db = getDb()
  const existing = db.prepare('SELECT id FROM agents WHERE id = ?').get(params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  db.prepare(`
    UPDATE agents SET
      name          = COALESCE(?, name),
      description   = COALESCE(?, description),
      llm_config_id = COALESCE(?, llm_config_id),
      system_prompt = COALESCE(?, system_prompt),
      tools         = COALESCE(?, tools),
      canvas_x      = COALESCE(?, canvas_x),
      canvas_y      = COALESCE(?, canvas_y),
      color         = COALESCE(?, color),
      status        = COALESCE(?, status),
      updated_at    = datetime('now')
    WHERE id = ?
  `).run(
    body.name         ?? null,
    body.description  ?? null,
    body.llmConfigId  ?? null,
    body.systemPrompt ?? null,
    body.tools        ? JSON.stringify(body.tools) : null,
    Number.isFinite(body.canvasX) ? body.canvasX : null,
    Number.isFinite(body.canvasY) ? body.canvasY : null,
    body.color  ?? null,
    body.status ?? null,
    params.id,
  )

  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(params.id) as Record<string, unknown>
  return NextResponse.json(rowToAgent(row))
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  db.prepare('DELETE FROM agents WHERE id = ?').run(params.id)
  return NextResponse.json({ ok: true })
}
