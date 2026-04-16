import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

function rowToRun(r: Record<string, unknown>) {
  return {
    id: r.id, projectId: r.project_id, status: r.status,
    iteration: Number(r.iteration), maxIterations: Number(r.max_iterations),
    startedAt: r.started_at, completedAt: r.completed_at,
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const runs = db.prepare(
    'SELECT * FROM project_runs WHERE project_id = ? ORDER BY started_at DESC LIMIT 20'
  ).all(params.id) as Record<string, unknown>[]
  return NextResponse.json(runs.map(rowToRun))
}
