import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { PipelineRunner, pipelineRegistry } from '@/lib/pipeline/PipelineRunner'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  // Resolve slug → id
  const project = db.prepare('SELECT id FROM projects WHERE id = ? OR slug = ?').get(params.id, params.id) as { id: string } | undefined
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as { maxIterations?: number }
  const maxIterations = Math.max(1, Math.min(10, body.maxIterations ?? 3))

  const runner = new PipelineRunner()
  // Start async — don't await
  runner.run(project.id, maxIterations)

  // Wait briefly for runId to be assigned
  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (runner.runId) { clearInterval(check); resolve() }
    }, 10)
    setTimeout(() => { clearInterval(check); resolve() }, 500)
  })

  if (!runner.runId) return NextResponse.json({ error: 'Failed to start run' }, { status: 500 })

  pipelineRegistry.add(runner)

  return NextResponse.json({ runId: runner.runId })
}
