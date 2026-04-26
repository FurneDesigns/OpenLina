'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Label } from '@/components/ui/input'
import { useToastStore } from '@/store/useToastStore'

export default function ProjectDetail() {
  const params = useParams() as { slug: string }
  const router = useRouter()
  const push = useToastStore((s) => s.push)
  const [project, setProject] = useState<any>(null)
  const [runs, setRuns] = useState<any[]>([])
  const [showDelete, setShowDelete] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/projects/${params.slug}`).then((r) => r.json()).then((j) => j.ok && setProject(j.data))
    fetch(`/api/projects/${params.slug}/runs`).then((r) => r.json()).then((j) => j.ok && setRuns(j.data))
  }, [params.slug])

  async function performDelete() {
    if (!project) return
    setDeleting(true)
    try {
      const r = await fetch(`/api/projects/${project.id}?confirm=${encodeURIComponent(project.name)}`, { method: 'DELETE' }).then((r) => r.json())
      if (!r.ok) throw new Error(r.error)
      push(`Project "${project.name}" deleted`, 'success')
      router.push('/')
    } catch (err: any) {
      push(`Delete failed: ${err?.message || err}`, 'danger')
      setDeleting(false)
    }
  }

  if (!project) return <div className="p-6 text-sm text-muted">Loading…</div>
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="text-sm text-muted">{project.workspace_path}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/projects/${project.slug}/agents`}><Button variant="secondary">Agents</Button></Link>
          <Link href={`/projects/${project.slug}/execute`}><Button>Execute</Button></Link>
          <Button variant="danger" onClick={() => { setConfirmName(''); setShowDelete(true) }}>
            <Trash2 className="size-4" /> Delete
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader><div className="font-medium">Overview</div></CardHeader>
        <CardBody>
          <p className="text-sm">{project.description || '— no description —'}</p>
          <div className="flex gap-2 mt-3">
            {project.framework && <Badge variant="accent">{project.framework}</Badge>}
            {project.deployment_target && <Badge>{project.deployment_target}</Badge>}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><div className="font-medium">Recent runs</div></CardHeader>
        <CardBody>
          {runs.length === 0 && <div className="text-sm text-muted">No runs yet.</div>}
          <div className="divide-y divide-border">
            {runs.map((r) => (
              <Link key={r.id} href={`/projects/${project.slug}/execute?run=${r.id}`} className="py-3 flex items-center gap-3 hover:bg-surfaceAlt rounded px-2">
                <Badge>{r.status}</Badge>
                <div className="flex-1 text-sm">{r.id}</div>
                <div className="text-xs text-muted">{new Date(r.started_at).toLocaleString()}</div>
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !deleting && setShowDelete(false)}>
          <div className="bg-surface border border-border rounded-lg w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Delete project</h3>
            <p className="text-sm text-muted mb-3">
              This will permanently delete <strong className="text-text">{project.name}</strong>, all its runs, agents, embeddings, and the workspace folder at <code className="text-xs">{project.workspace_path}</code>. This cannot be undone.
            </p>
            <Label>Type the project name to confirm</Label>
            <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={project.name} autoFocus />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setShowDelete(false)} disabled={deleting}>Cancel</Button>
              <Button variant="danger" onClick={performDelete} disabled={deleting || confirmName !== project.name}>
                {deleting ? 'Deleting…' : 'Delete forever'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
