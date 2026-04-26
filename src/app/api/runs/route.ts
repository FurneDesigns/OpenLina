import { getDb } from '@/lib/db'
import { ok, fail } from '@/lib/api/json'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const rows = getDb().prepare(`
      SELECT pr.id, pr.project_id, p.name AS project_name, pr.status, pr.iteration, pr.max_iterations, pr.started_at, pr.completed_at
      FROM project_runs pr
      LEFT JOIN projects p ON p.id = pr.project_id
      ORDER BY pr.started_at DESC
      LIMIT 200
    `).all()
    return ok(rows)
  } catch (err) { return fail(err) }
}
