'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Textarea, Label } from '@/components/ui/input'

const ROLES = ['ceo', 'pm', 'architect', 'designer', 'dev', 'fullstack', 'backend', 'frontend', 'devops', 'qa']

interface Agent {
  id: string
  name: string
  role: string
  responsibilities: string | null
  system_prompt: string | null
  execution_order: number
  max_iterations: number
  role_kind: 'worker' | 'reviewer'
  reviews_agent_id: string | null
}

export default function AgentsPage() {
  const params = useParams() as { slug: string }
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [project, setProject] = useState<any>(null)

  async function load() {
    const p = await fetch(`/api/projects/${params.slug}`).then((r) => r.json())
    if (p.ok) setProject(p.data)
    const a = await fetch(`/api/projects/${params.slug}/agents`).then((r) => r.json())
    if (a.ok) setAgents(a.data)
  }
  useEffect(() => { load() }, [params.slug])

  async function add(role: string) {
    await fetch(`/api/projects/${params.slug}/agents`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: `${role} agent`, role, role_kind: role === 'qa' ? 'worker' : 'worker' }),
    })
    load()
  }
  async function update(id: string, patch: any) {
    await fetch(`/api/agents/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
    load()
  }
  async function remove(id: string) {
    if (!confirm('Remove agent?')) return
    await fetch(`/api/agents/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{project?.name} — Agents</h1>
        <Button onClick={() => router.push(`/projects/${params.slug}/execute`)}>Go to Execute</Button>
      </div>
      <Card className="mb-4">
        <CardHeader><div className="font-medium">Quick add</div></CardHeader>
        <CardBody className="flex flex-wrap gap-2">
          {ROLES.map((r) => <Button key={r} size="sm" variant="secondary" onClick={() => add(r)}>+ {r}</Button>)}
        </CardBody>
      </Card>
      <div className="grid gap-3">
        {agents.map((a) => (
          <Card key={a.id}>
            <CardBody className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={a.role_kind === 'reviewer' ? 'warn' : 'accent'}>{a.role_kind}</Badge>
                <Input value={a.name} onChange={(e) => update(a.id, { name: e.target.value })} className="max-w-xs" />
                <select value={a.role} onChange={(e) => update(a.id, { role: e.target.value })} className="h-9 rounded-md border border-border bg-surfaceAlt px-2 text-sm">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <select value={a.role_kind} onChange={(e) => update(a.id, { role_kind: e.target.value })} className="h-9 rounded-md border border-border bg-surfaceAlt px-2 text-sm">
                  <option value="worker">Worker</option>
                  <option value="reviewer">Reviewer</option>
                </select>
                {a.role_kind === 'reviewer' && (
                  <select value={a.reviews_agent_id || ''} onChange={(e) => update(a.id, { reviews_agent_id: e.target.value || null })} className="h-9 rounded-md border border-border bg-surfaceAlt px-2 text-sm">
                    <option value="">(unassigned)</option>
                    {agents.filter((w) => w.role_kind === 'worker' && w.id !== a.id).map((w) => <option key={w.id} value={w.id}>reviews {w.name}</option>)}
                  </select>
                )}
                <Input type="number" min={1} max={10} value={a.max_iterations} onChange={(e) => update(a.id, { max_iterations: Number(e.target.value) })} className="w-20" />
                <Button size="sm" variant="danger" onClick={() => remove(a.id)}>Remove</Button>
              </div>
              <div>
                <Label>Responsibilities</Label>
                <Textarea defaultValue={a.responsibilities || ''} onBlur={(e) => update(a.id, { responsibilities: e.target.value })} />
              </div>
              <div>
                <Label>System prompt (optional)</Label>
                <Textarea defaultValue={a.system_prompt || ''} onBlur={(e) => update(a.id, { system_prompt: e.target.value })} />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
