'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Folder, Play, Clock, ChevronRight, Zap, Users, Trash2 } from 'lucide-react'

interface Project {
  id: string; name: string; slug: string
  description?: string; projectType: string; framework: string
  brandColors?: { primary: string; secondary: string; accent: string }
  keyFeatures?: string[]; techStack?: string[]
  createdAt: string; updatedAt: string
}

const TYPE_LABELS: Record<string, string> = {
  web: 'Web App', saas: 'SaaS', mobile: 'Mobile', api: 'API / Backend',
  monorepo: 'Monorepo', other: 'Other',
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

export default function DashboardPage() {
  const router = useRouter()
  const [hasLLMs, setHasLLMs] = useState<boolean | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/llm').then((r) => r.json()).then((data: unknown[]) => setHasLLMs(data.length > 0))
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data: Project[]) => setProjects(data))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (hasLLMs === false) router.push('/wizard/platform')
  }, [hasLLMs, router])

  async function deleteProject(id: string) {
    if (!confirm('Delete this project? This cannot be undone.')) return
    setDeletingId(id)
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    setProjects((prev) => prev.filter((p) => p.id !== id))
    setDeletingId(null)
  }

  if (hasLLMs === null) return null

  return (
    <AppShell title="Projects">
      <div className="h-full flex flex-col">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-border px-8 py-4">
          <div>
            <h1 className="text-xl font-semibold">Projects</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {projects.length === 0 ? 'No projects yet' : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Link href="/projects/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 rounded-xl border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 mb-6">
                <Zap className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Build something awesome</h2>
              <p className="text-muted-foreground max-w-sm mb-8">
                Create your first project and let your AI agent team bring it to life — from design to deployment.
              </p>
              <Link href="/projects/new">
                <Button size="lg" className="gap-2">
                  <Plus className="h-5 w-5" />
                  Create your first project
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* New project card */}
              <Link href="/projects/new">
                <div className="group flex h-full min-h-[180px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors mb-3">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-medium text-sm">New Project</p>
                  <p className="text-xs text-muted-foreground mt-1">Start with an AI team</p>
                </div>
              </Link>

              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group/card relative flex flex-col rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer overflow-hidden h-full min-h-[180px]"
                  onClick={() => router.push(`/projects/${project.slug}`)}
                >
                  {/* Delete button — stopPropagation prevents card navigation */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteProject(project.id) }}
                    disabled={deletingId === project.id}
                    className="absolute top-2 right-2 z-10 h-7 w-7 flex items-center justify-center rounded-lg border border-transparent opacity-0 group-hover/card:opacity-100 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-400 text-muted-foreground transition-all"
                    title="Delete project"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                    {/* Color accent bar */}
                    <div
                      className="h-1 w-full"
                      style={{ background: project.brandColors?.primary ?? 'hsl(var(--primary))' }}
                    />

                    <div className="flex flex-col flex-1 p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                            style={{ background: `${project.brandColors?.primary ?? 'hsl(var(--primary))'}22` }}
                          >
                            <Folder className="h-4 w-4" style={{ color: project.brandColors?.primary ?? 'hsl(var(--primary))' }} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm leading-tight">{project.name}</h3>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-0.5">
                              {TYPE_LABELS[project.projectType] ?? project.projectType}
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover/card:text-primary transition-colors shrink-0" />
                      </div>

                      {project.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">
                          {project.description}
                        </p>
                      )}

                      {project.keyFeatures && project.keyFeatures.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {project.keyFeatures.slice(0, 3).map((f) => (
                            <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {f}
                            </span>
                          ))}
                          {project.keyFeatures.length > 3 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              +{project.keyFeatures.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {timeAgo(project.updatedAt)}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>{project.framework}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 group-hover/card:opacity-100 transition-opacity">
                            <Play className="h-3 w-3" />
                            Open
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
