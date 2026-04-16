'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AssetUploader } from '@/components/shared/AssetUploader'
import {
  Play, Clock, CheckCircle, XCircle, StopCircle,
  Loader2, ChevronLeft, Users, Folder, Cpu, ArrowRight, Plus, Trash2,
} from 'lucide-react'

interface Project {
  id: string; name: string; slug: string; description?: string
  projectType: string; framework: string; targetAudience?: string
  brandColors?: { primary: string; secondary: string; accent: string }
  keyFeatures?: string[]; techStack?: string[]
  deploymentTarget?: string; workspacePath?: string; targetLlmConfigId?: string
  createdAt: string; updatedAt: string
}

interface LLMConfig {
  id: string; label: string; model_id: string; platform_label: string; enabled: number; provider_type: string
}

interface Agent {
  id: string; name: string; role: string; color: string
  responsibilities?: string; executionOrder: number; maxIterations: number; status: string
}

interface Run {
  id: string; status: string; iteration: number; maxIterations: number
  startedAt: string; completedAt?: string
}

const ROLE_COLORS: Record<string, string> = {
  ceo: '#f59e0b', designer: '#8b5cf6', dev: '#3b82f6',
  qa: '#10b981', devops: '#ef4444', pm: '#6366f1',
}
const ROLE_LABELS: Record<string, string> = {
  ceo: 'CEO / PM', designer: 'Designer', dev: 'Developer',
  qa: 'QA Engineer', devops: 'DevOps', pm: 'Project Manager',
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
  if (status === 'completed') return <CheckCircle className="h-4 w-4 text-green-400" />
  if (status === 'failed') return <XCircle className="h-4 w-4 text-red-400" />
  if (status === 'stopped') return <StopCircle className="h-4 w-4 text-yellow-400" />
  return <Clock className="h-4 w-4 text-muted-foreground" />
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ProjectDetailPage() {
  const { slug } = useParams() as { slug: string }
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [configs, setConfigs] = useState<LLMConfig[]>([])
  const [starting, setStarting] = useState(false)
  const [maxIter, setMaxIter] = useState(3)
  const [targetModel, setTargetModel] = useState<string>('')

  useEffect(() => {
    fetch(`/api/projects/${slug}`)
      .then((r) => r.json())
      .then((data: Project) => {
        setProject(data)
        return Promise.all([
          fetch(`/api/projects/${data.id}/agents`).then((r) => r.json()),
          fetch(`/api/projects/${data.id}/runs`).then((r) => r.json()),
          fetch('/api/llm').then((r) => r.json()),
        ])
      })
      .then(([agentData, runData, llmData]) => {
        setAgents(agentData as Agent[])
        setRuns(runData as Run[])
        const activeConfigs = (llmData as LLMConfig[]).filter(c => c.enabled === 1)
        setConfigs(activeConfigs)
      })
  }, [slug])

  useEffect(() => {
    if (project) {
      setTargetModel(project.targetLlmConfigId || '')
    }
  }, [project])

  const updateTargetModel = async (id: string) => {
    if (!project) return
    setTargetModel(id)
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetLlmConfigId: id || null })
    })
  }

  async function deleteProject() {
    if (!project) return
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    router.push('/')
  }

  async function startRun() {
    if (!project) return
    setStarting(true)
    router.push(`/projects/${slug}/execute?autoStart=${maxIter}`)
  }

  if (!project) {
    return (
      <AppShell title="Loading...">
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    )
  }

  const primaryColor = project.brandColors?.primary ?? 'hsl(var(--primary))'

  return (
    <AppShell title={project.name}>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Top accent + header */}
        <div className="border-b border-border">
          <div className="h-1" style={{ background: primaryColor }} />
          <div className="flex items-center gap-4 px-8 py-4">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
              style={{ background: `${primaryColor}22` }}
            >
              <Folder className="h-5 w-5" style={{ color: primaryColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold truncate">{project.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="text-[10px]">{project.projectType}</Badge>
                <span className="text-xs text-muted-foreground">{project.framework}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={deleteProject}
                className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs text-muted-foreground hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition-colors"
                title="Delete project"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
              <Link href={`/projects/${slug}/agents`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Manage Agents
                </Button>
              </Link>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Iterations:</span>
                <select
                  value={maxIter}
                  onChange={(e) => setMaxIter(Number(e.target.value))}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                >
                  {[1, 2, 3, 5, 7, 10].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 border border-border rounded-md px-2 bg-background/50">
                <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                <select
                  value={targetModel}
                  onChange={(e) => updateTargetModel(e.target.value)}
                  className="h-8 bg-transparent border-none text-xs focus:ring-0 pr-6"
                >
                  <option value="">Auto (Priority Queue)</option>
                  {configs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.model_id})
                    </option>
                  ))}
                </select>
              </div>

              <Button
                onClick={startRun}
                disabled={starting || agents.length === 0}
                className="gap-2"
                style={{ background: primaryColor, borderColor: primaryColor }}
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {starting ? 'Starting...' : 'Execute'}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-0 divide-x divide-border h-full">
            {/* Left: Project info */}
            <div className="col-span-1 p-6 space-y-6 overflow-y-auto">
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Overview</h2>
                {project.description && (
                  <p className="text-sm text-muted-foreground mb-4">{project.description}</p>
                )}
                {project.targetAudience && (
                  <div className="text-xs mb-3">
                    <span className="text-muted-foreground">Target: </span>
                    <span>{project.targetAudience}</span>
                  </div>
                )}
                {project.workspacePath && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5 font-mono">
                    <Folder className="h-3 w-3 shrink-0" />
                    <span className="truncate">{project.workspacePath}</span>
                  </div>
                )}
              </section>

              {project.keyFeatures && project.keyFeatures.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Key Features</h2>
                  <ul className="space-y-1">
                    {project.keyFeatures.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: primaryColor }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {project.techStack && project.techStack.length > 0 && (
                <section>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Tech Stack</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {project.techStack.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                </section>
              )}

              {project.brandColors && (
                <section>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Brand Colors</h2>
                  <div className="flex gap-2">
                    {Object.entries(project.brandColors).map(([k, v]) => (
                      <div key={k} className="flex flex-col items-center gap-1">
                        <div className="h-8 w-8 rounded-lg border border-border" style={{ background: v }} />
                        <span className="text-[10px] text-muted-foreground capitalize">{k}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Brand Assets</h2>
                <AssetUploader projectId={project.id} label="" />
              </section>
            </div>

            {/* Middle: Agent pipeline */}
            <div className="col-span-1 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agent Pipeline</h2>
                <Link href={`/projects/${slug}/agents`}>
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </Link>
              </div>

              {agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Cpu className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">No agents yet</p>
                  <Link href={`/projects/${slug}/agents`}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      Add Agents
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="relative">
                  {agents.map((agent, i) => (
                    <div key={agent.id} className="relative">
                      <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors mb-1">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 text-xs font-bold text-white"
                          style={{ background: ROLE_COLORS[agent.role] ?? agent.color }}
                        >
                          {agent.executionOrder + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm truncate">{agent.name}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {ROLE_LABELS[agent.role] ?? agent.role}
                          </p>
                          {agent.responsibilities && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {agent.responsibilities}
                            </p>
                          )}
                        </div>
                      </div>
                      {i < agents.length - 1 && (
                        <div className="flex justify-center my-1">
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 rotate-90" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Run history */}
            <div className="col-span-1 p-6 overflow-y-auto">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Run History</h2>

              {runs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No runs yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Hit Execute to start your first run</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {runs.map((run) => (
                    <Link key={run.id} href={`/projects/${slug}/execute?runId=${run.id}`}>
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors cursor-pointer">
                        <StatusIcon status={run.status} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-muted-foreground">{run.id.slice(0, 8)}</span>
                            <Badge
                              variant="secondary"
                              className={`text-[10px] px-1.5 py-0 ${
                                run.status === 'completed' ? 'text-green-400' :
                                run.status === 'failed' ? 'text-red-400' :
                                run.status === 'running' ? 'text-blue-400' :
                                run.status === 'stopped' ? 'text-yellow-400' : ''
                              }`}
                            >
                              {run.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Iter {run.iteration}/{run.maxIterations} · {timeAgo(run.startedAt)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
