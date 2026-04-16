'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, Plus, Trash2, GripVertical, Loader2, Save } from 'lucide-react'

interface Agent {
  id: string; name: string; role: string; color: string
  responsibilities?: string; systemPrompt?: string
  executionOrder: number; maxIterations: number
}

interface Project { id: string; name: string; slug: string }

const ROLE_OPTIONS = [
  { value: 'ceo',      label: 'CEO / Product Manager',  color: '#f59e0b' },
  { value: 'designer', label: 'UI/UX Designer',          color: '#8b5cf6' },
  { value: 'dev',      label: 'Full-Stack Developer',    color: '#3b82f6' },
  { value: 'qa',       label: 'QA Engineer',             color: '#10b981' },
  { value: 'devops',   label: 'DevOps Engineer',         color: '#ef4444' },
  { value: 'pm',       label: 'Project Manager',         color: '#6366f1' },
]

const DEFAULT_AGENTS = [
  { name: 'CEO', role: 'ceo' },
  { name: 'Designer', role: 'designer' },
  { name: 'Developer', role: 'dev' },
  { name: 'QA Engineer', role: 'qa' },
]

export default function AgentsPage() {
  const { slug } = useParams() as { slug: string }
  const [project, setProject] = useState<Project | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [editing, setEditing] = useState<Record<string, Partial<Agent>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetch(`/api/projects/${slug}`)
      .then((r) => r.json())
      .then((p: Project) => {
        setProject(p)
        return fetch(`/api/projects/${p.id}/agents`)
      })
      .then((r) => r.json())
      .then(setAgents)
  }, [slug])

  function editField(agentId: string, field: keyof Agent, value: unknown) {
    setEditing((e) => ({ ...e, [agentId]: { ...e[agentId], [field]: value } }))
  }

  function getField<K extends keyof Agent>(agent: Agent, field: K): Agent[K] {
    return (editing[agent.id]?.[field] ?? agent[field]) as Agent[K]
  }

  async function saveAgent(agent: Agent) {
    if (!project) return
    const patch = editing[agent.id]
    if (!patch || Object.keys(patch).length === 0) return
    setSaving(agent.id)
    try {
      await fetch(`/api/projects/${project.id}/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, ...patch } : a))
      setEditing((e) => { const n = { ...e }; delete n[agent.id]; return n })
    } finally {
      setSaving(null)
    }
  }

  async function deleteAgent(agentId: string) {
    if (!project) return
    await fetch(`/api/projects/${project.id}/agents/${agentId}`, { method: 'DELETE' })
    setAgents((prev) => prev.filter((a) => a.id !== agentId))
  }

  async function addDefaultTeam() {
    if (!project) return
    setAdding(true)
    try {
      const created: Agent[] = []
      for (const tmpl of DEFAULT_AGENTS) {
        const res = await fetch(`/api/projects/${project.id}/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: tmpl.name, role: tmpl.role }),
        })
        created.push(await res.json())
      }
      setAgents((prev) => [...prev, ...created])
    } finally {
      setAdding(false)
    }
  }

  async function addAgent() {
    if (!project) return
    const res = await fetch(`/api/projects/${project.id}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Agent', role: 'dev' }),
    })
    const agent = await res.json() as Agent
    setAgents((prev) => [...prev, agent])
    setEditing((e) => ({ ...e, [agent.id]: { name: 'New Agent', role: 'dev' } }))
  }

  return (
    <AppShell title="Agents">
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-3 border-b border-border px-8 py-4">
          <Link href={`/projects/${slug}`} className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Agent Pipeline</h1>
            {project && <p className="text-xs text-muted-foreground">{project.name}</p>}
          </div>
          <Button onClick={addAgent} size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Agent
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 max-w-3xl mx-auto w-full">
          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground mb-6">No agents configured yet.</p>
              <Button onClick={addDefaultTeam} disabled={adding} className="gap-2">
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Default Team (CEO, Designer, Dev, QA)
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground mb-4">
                Agents execute in order from top to bottom. Drag to reorder (coming soon).
              </p>
              {agents
                .sort((a, b) => a.executionOrder - b.executionOrder)
                .map((agent, i) => {
                  const role = ROLE_OPTIONS.find((r) => r.value === getField(agent, 'role'))
                  const isDirty = !!editing[agent.id] && Object.keys(editing[agent.id]).length > 0
                  return (
                    <div key={agent.id} className="rounded-xl border border-border bg-card overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20">
                        <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white shrink-0"
                          style={{ background: role?.color ?? agent.color }}
                        >
                          {i + 1}
                        </div>
                        <input
                          className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
                          value={getField(agent, 'name') as string}
                          onChange={(e) => editField(agent.id, 'name', e.target.value)}
                          placeholder="Agent name"
                        />
                        <Badge
                          variant="secondary"
                          className="text-[10px] shrink-0"
                          style={{ color: role?.color }}
                        >
                          {role?.label ?? agent.role}
                        </Badge>
                        <div className="flex items-center gap-1">
                          {isDirty && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 gap-1 text-xs text-primary"
                              onClick={() => saveAgent(agent)}
                              disabled={saving === agent.id}
                            >
                              {saving === agent.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                              Save
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                            onClick={() => deleteAgent(agent.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="p-4 grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Role</label>
                          <select
                            value={getField(agent, 'role') as string}
                            onChange={(e) => editField(agent.id, 'role', e.target.value)}
                            className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Iterations</label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={getField(agent, 'maxIterations') as number}
                            onChange={(e) => editField(agent.id, 'maxIterations', Number(e.target.value))}
                            className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Responsibilities</label>
                          <textarea
                            rows={2}
                            value={(getField(agent, 'responsibilities') as string) ?? ''}
                            onChange={(e) => editField(agent.id, 'responsibilities', e.target.value)}
                            placeholder="Describe what this agent is responsible for..."
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs resize-none outline-none focus:border-primary/50"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                            System Prompt <span className="text-muted-foreground/50">(optional — uses default if empty)</span>
                          </label>
                          <textarea
                            rows={3}
                            value={(getField(agent, 'systemPrompt') as string) ?? ''}
                            onChange={(e) => editField(agent.id, 'systemPrompt', e.target.value)}
                            placeholder="Leave empty to use the default role prompt..."
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs font-mono resize-none outline-none focus:border-primary/50"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
