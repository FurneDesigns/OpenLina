import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { pipelineRegistry } from '@/lib/pipeline/PipelineRunner'

function rowToRun(r: Record<string, unknown>) {
  return {
    id: r.id, projectId: r.project_id, status: r.status,
    iteration: Number(r.iteration), max_iterations: Number(r.max_iterations),
    started_at: r.started_at, completed_at: r.completed_at,
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string; runId: string } }) {
  const db = getDb()
  const run = db.prepare('SELECT * FROM project_runs WHERE id = ?').get(params.runId) as Record<string, unknown> | undefined
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // agent_name and role are stored at insertion time (migration 16); JOIN as fallback
  const steps = db.prepare(`
    SELECT rs.id, rs.run_id, rs.agent_id, rs.iteration, rs.status,
           rs.output, rs.tokens_used, rs.started_at, rs.completed_at,
           COALESCE(rs.agent_name, a.name) AS agent_name,
           COALESCE(rs.role, a.role, 'dev') AS role
    FROM run_steps rs
    LEFT JOIN agents a ON a.id = rs.agent_id
    WHERE rs.run_id = ?
    ORDER BY rs.iteration ASC, rs.started_at ASC
  `).all(params.runId)
  return NextResponse.json({ run: rowToRun(run), steps })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; runId: string } }) {
  pipelineRegistry.get(params.runId)?.stop()
  return NextResponse.json({ ok: true })
}
