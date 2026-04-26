'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, FolderKanban } from 'lucide-react'

interface Project {
  id: string
  name: string
  slug: string
  description?: string
  framework?: string
  workspace_path: string
  updated_at: string
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/projects').then(async (r) => {
      const j = await r.json()
      if (j.ok) setProjects(j.data)
      else setError(j.error)
    }).catch((e) => setError(String(e)))
  }, [])
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted">Local-first AI dev workspaces.</p>
        </div>
        <Link href="/projects/new">
          <Button><Plus className="size-4" /> New project</Button>
        </Link>
      </div>
      {error && <div className="text-sm text-danger mb-4">{error}</div>}
      {!projects && <div className="text-sm text-muted">Loading…</div>}
      {projects && projects.length === 0 && (
        <Card>
          <CardBody className="text-center py-10">
            <FolderKanban className="size-8 mx-auto text-muted mb-2" />
            <p className="text-sm text-muted mb-4">No projects yet.</p>
            <Link href="/wizard/platform">
              <Button>Set up your first LLM</Button>
            </Link>
          </CardBody>
        </Card>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects?.map((p) => (
          <Link key={p.id} href={`/projects/${p.slug}`}>
            <Card className="hover:border-accent/40 transition">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="font-medium">{p.name}</div>
                  {p.framework && <Badge variant="accent">{p.framework}</Badge>}
                </div>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-muted line-clamp-3">{p.description || '— no description —'}</p>
                <p className="text-xs text-muted mt-3 truncate">{p.workspace_path}</p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
