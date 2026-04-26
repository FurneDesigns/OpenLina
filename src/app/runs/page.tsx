'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Run {
  id: string
  project_id: string
  project_name: string | null
  status: string
  iteration: number
  max_iterations: number
  started_at: string
  completed_at: string | null
}

const VARIANT_BY_STATUS: Record<string, 'success' | 'warn' | 'danger' | 'accent' | 'neutral'> = {
  running: 'accent', completed: 'success', failed: 'danger', stopped: 'warn',
}

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([])
  useEffect(() => {
    let active = true
    const load = () => fetch('/api/runs').then((r) => r.json()).then((j) => { if (j.ok && active) setRuns(j.data) })
    load()
    const t = setInterval(load, 5000)
    return () => { active = false; clearInterval(t) }
  }, [])
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Runs</h1>
      <Card>
        <CardHeader><div className="text-sm text-muted">Auto-refresh every 5s</div></CardHeader>
        <CardBody>
          {runs.length === 0 && <div className="text-sm text-muted">No runs yet.</div>}
          <div className="divide-y divide-border">
            {runs.map((r) => (
              <Link key={r.id} href={`/projects/${r.project_id}/execute?run=${r.id}`} className="py-3 flex items-center gap-3 hover:bg-surfaceAlt rounded px-2">
                <Badge variant={VARIANT_BY_STATUS[r.status] || 'neutral'}>{r.status}</Badge>
                <div className="flex-1">
                  <div className="font-medium">{r.project_name || r.project_id}</div>
                  <div className="text-xs text-muted">iter {r.iteration}/{r.max_iterations} • started {new Date(r.started_at).toLocaleString()}</div>
                </div>
                <div className="text-xs text-muted">{r.completed_at ? new Date(r.completed_at).toLocaleString() : '—'}</div>
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
