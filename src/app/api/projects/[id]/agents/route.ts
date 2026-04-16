import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDb } from '@/lib/db'

function rowToAgent(row: Record<string, unknown>) {
  return {
    id: row.id, projectId: row.project_id, name: row.name,
    description: row.description, llmConfigId: row.llm_config_id,
    systemPrompt: row.system_prompt ?? '',
    tools: row.tools ? JSON.parse(row.tools as string) : [],
    canvasX: Number(row.canvas_x ?? 100), canvasY: Number(row.canvas_y ?? 100),
    status: row.status ?? 'idle', color: row.color ?? '#6366f1',
    role: row.role ?? 'dev', responsibilities: row.responsibilities,
    executionOrder: Number(row.execution_order ?? 0),
    maxIterations: Number(row.max_iterations ?? 3),
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM agents WHERE project_id = ? ORDER BY execution_order ASC'
  ).all(params.id) as Record<string, unknown>[]
  return NextResponse.json(rows.map(rowToAgent))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json()) as {
    name: string; role?: string; responsibilities?: string
    systemPrompt?: string; color?: string; llmConfigId?: string
    executionOrder?: number; maxIterations?: number; canvasX?: number; canvasY?: number
  }
  const db = getDb()
  const id = uuid()

  // Auto-set execution_order to max+1
  const maxOrder = (db.prepare('SELECT MAX(execution_order) as m FROM agents WHERE project_id = ?').get(params.id) as { m: number | null }).m ?? -1

  db.prepare(`
    INSERT INTO agents (id, project_id, name, description, llm_config_id, system_prompt, tools,
      canvas_x, canvas_y, color, role, responsibilities, execution_order, max_iterations)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, params.id, body.name, null, body.llmConfigId ?? null,
    body.systemPrompt ?? '', '[]',
    body.canvasX ?? (100 + (maxOrder + 1) * 220), body.canvasY ?? 200,
    body.color ?? '#6366f1',
    body.role ?? 'dev', body.responsibilities ?? null,
    body.executionOrder ?? maxOrder + 1,
    body.maxIterations ?? 3,
  )

  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Record<string, unknown>
  return NextResponse.json(rowToAgent(row), { status: 201 })
}
