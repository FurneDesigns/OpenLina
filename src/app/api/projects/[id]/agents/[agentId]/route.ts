import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; agentId: string } }
) {
  const db = getDb()
  const row = db.prepare('SELECT * FROM agents WHERE id = ? AND project_id = ?').get(params.agentId, params.id) as Record<string, unknown> | undefined
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(rowToAgent(row))
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; agentId: string } }
) {
  const body = (await req.json()) as Record<string, unknown>
  const db = getDb()

  const map: Record<string, string> = {
    name: 'name', role: 'role', responsibilities: 'responsibilities',
    systemPrompt: 'system_prompt', color: 'color',
    executionOrder: 'execution_order', maxIterations: 'max_iterations',
    canvasX: 'canvas_x', canvasY: 'canvas_y', status: 'status',
  }

  const sets: string[] = []
  const vals: unknown[] = []
  for (const [key, col] of Object.entries(map)) {
    if (body[key] !== undefined) { sets.push(`${col} = ?`); vals.push(body[key]) }
  }
  if (sets.length === 0) return NextResponse.json({ ok: true })
  sets.push("updated_at = datetime('now')")
  vals.push(params.agentId, params.id)
  db.prepare(`UPDATE agents SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`).run(...vals)

  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(params.agentId) as Record<string, unknown>
  return NextResponse.json(rowToAgent(row))
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; agentId: string } }
) {
  const db = getDb()
  db.prepare('DELETE FROM agents WHERE id = ? AND project_id = ?').run(params.agentId, params.id)
  return NextResponse.json({ ok: true })
}
