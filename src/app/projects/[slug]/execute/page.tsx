'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { BottomTerminal } from '@/components/shared/BottomTerminal'
import { getSocket } from '@/lib/socketClient'

interface Step {
  stepId: string
  agentId: string
  name: string
  role: string
  iteration: number
  status: 'running' | 'completed' | 'failed'
  output: string
  verdict?: 'approve' | 'request_changes'
  sessionId?: string
  artifactPath?: string
  artifactContent?: string
  errorMessage?: string
}

const ROLE_COLOR: Record<string, string> = {
  ceo: 'bg-purple-500/20 text-purple-300',
  pm: 'bg-blue-500/20 text-blue-300',
  architect: 'bg-amber-500/20 text-amber-300',
  designer: 'bg-pink-500/20 text-pink-300',
  dev: 'bg-emerald-500/20 text-emerald-300',
  fullstack: 'bg-emerald-500/20 text-emerald-300',
  backend: 'bg-cyan-500/20 text-cyan-300',
  frontend: 'bg-indigo-500/20 text-indigo-300',
  devops: 'bg-orange-500/20 text-orange-300',
  qa: 'bg-rose-500/20 text-rose-300',
  reviewer: 'bg-yellow-500/20 text-yellow-300',
}

const PASS_OPTIONS: { label: string; value: number }[] = [
  { label: '1 pass', value: 1 },
  { label: '2 passes', value: 2 },
  { label: '3 passes', value: 3 },
  { label: '5 passes', value: 5 },
  { label: 'Unlimited (∞)', value: 0 },
]

export default function ExecutePage() {
  const params = useParams() as { slug: string }
  const search = useSearchParams()
  const initialRunId = search.get('run')
  const [project, setProject] = useState<any>(null)
  const [runId, setRunId] = useState<string | null>(initialRunId)
  const [maxIterations, setMaxIterations] = useState(3)
  const [iteration, setIteration] = useState(0)
  const [steps, setSteps] = useState<Step[]>([])
  const [filesWritten, setFilesWritten] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [stoppedFlag, setStoppedFlag] = useState(false)
  const [view, setView] = useState<'terminal' | 'split' | 'preview'>('split')
  const sockRef = useRef<ReturnType<typeof getSocket> | null>(null)
  const projectRef = useRef<any>(null)
  const [devUrl, setDevUrl] = useState<string | null>(null)
  const [devPort, setDevPort] = useState<number | null>(null)
  const [devStatus, setDevStatus] = useState<'stopped' | 'starting' | 'ready' | 'failed'>('stopped')
  const [devBusy, setDevBusy] = useState(false)

  // Build the URL the iframe will load using the SAME hostname the browser used
  // to reach OpenLina. EXCEPT 'localhost' — many systems (Windows, some Linux configs)
  // resolve localhost to ::1 (IPv6) but Node's default bind is IPv4 only, so the iframe
  // would get "refused to connect". Force 127.0.0.1 in that case.
  function urlFor(port: number | null): string | null {
    if (!port) return null
    if (typeof window === 'undefined') return `http://127.0.0.1:${port}`
    const host = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname
    return `${window.location.protocol}//${host}:${port}`
  }
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Keep the ref in sync so socket handlers (registered once with empty deps)
  // can read the current project at event time.
  useEffect(() => { projectRef.current = project }, [project])

  function stripFrontmatter(md: string): string {
    return md.replace(/^<!--[\s\S]*?-->\n/, '').trimStart()
  }

  function collapseAll() { setCollapsed(new Set(steps.map((s) => s.stepId))) }
  function expandAll() { setCollapsed(new Set()) }
  const allCollapsed = steps.length > 0 && steps.every((s) => collapsed.has(s.stepId))

  // Load project + (optionally) hydrate from latest or specified run on the server
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const projRes = await fetch(`/api/projects/${params.slug}`).then((r) => r.json())
      if (cancelled || !projRes.ok) return
      setProject(projRes.data)
      const projectId = projRes.data.id

      // Decide which run to hydrate: explicit ?run=, else latest
      let targetRunId = initialRunId
      if (!targetRunId) {
        const runsRes = await fetch(`/api/projects/${params.slug}/runs`).then((r) => r.json())
        if (cancelled || !runsRes.ok) return
        const latest = runsRes.data?.[0]
        if (latest) targetRunId = latest.id
      }
      if (!targetRunId) return

      const detail = await fetch(`/api/projects/${projectId}/runs/${targetRunId}`).then((r) => r.json())
      if (cancelled || !detail.ok) return
      const { run, steps: dbSteps } = detail.data
      setRunId(run.id)
      setIteration(run.iteration || 0)
      setMaxIterations(run.max_iterations || 3)
      setRunning(run.status === 'running')
      setStoppedFlag(run.status === 'stopped')
      const hydrated = (dbSteps || []).map((s: any) => {
        const safeRole = (s.role || 'agent').replace(/[^a-z0-9_-]/gi, '-')
        const safeName = (s.agent_name || '').replace(/[^a-z0-9_-]/gi, '-').slice(0, 40)
        const guessPath = `.openlina/agents/iter${s.iteration}/${safeRole}${safeName ? '-' + safeName : ''}.md`
        return {
          stepId: s.id,
          agentId: s.agent_id,
          name: s.agent_name,
          role: s.role,
          iteration: s.iteration,
          status: (s.status === 'completed' || s.status === 'failed' || s.status === 'running') ? s.status : 'completed',
          output: s.output || '',
          verdict: s.verdict || undefined,
          artifactPath: guessPath,
          errorMessage: s.status === 'failed' ? (s.output || '') : undefined,
        } as Step
      })
      setSteps(hydrated)
      // Fetch artifact contents for completed steps in parallel
      hydrated.filter((s) => s.status === 'completed' && s.artifactPath).forEach(async (s) => {
        try {
          const r = await fetch(`/api/projects/${projectId}/artifact?path=${encodeURIComponent(s.artifactPath!)}`).then((r) => r.json())
          if (r.ok && !cancelled) {
            setSteps((prev) => prev.map((p) => p.stepId === s.stepId ? { ...p, artifactContent: r.data.content } : p))
          }
        } catch {}
      })
    })()
    return () => { cancelled = true }
  }, [params.slug, initialRunId])

  useEffect(() => {
    const sock = getSocket('/pipeline')
    sockRef.current = sock
    const onCreated = (p: any) => { setRunId(p.runId); setSteps([]); setIteration(0); setRunning(true); setStoppedFlag(false) }
    const onIter = (p: any) => setIteration(p.iteration)
    const onStart = (p: any) => setSteps((prev) => [...prev, { stepId: p.stepId, agentId: p.agentId, name: p.name, role: p.role, iteration: p.iteration, status: 'running', output: '', sessionId: p.sessionId }])
    const onChunk = (p: any) => setSteps((prev) => prev.map((s) => s.stepId === p.stepId ? { ...s, output: s.output + (p.delta || '') } : s))
    const onComplete = (p: any) => setSteps((prev) => prev.map((s) => s.stepId === p.stepId ? { ...s, status: 'completed', output: p.output || s.output } : s))
    const onError = (p: any) => setSteps((prev) => prev.map((s) => s.stepId === p.stepId ? { ...s, status: 'failed', errorMessage: p.message } : s))
    const onReview = (p: any) => setSteps((prev) => prev.map((s) => s.stepId === p.reviewerStepId ? { ...s, verdict: p.verdict } : s))
    const onArtifact = async (p: any) => {
      setSteps((prev) => prev.map((s) => s.stepId === p.stepId ? { ...s, artifactPath: p.relativePath } : s))
      const proj = projectRef.current
      if (!proj) return
      try {
        const r = await fetch(`/api/projects/${proj.id}/artifact?path=${encodeURIComponent(p.relativePath)}`).then((r) => r.json())
        if (r.ok) setSteps((prev) => prev.map((s) => s.stepId === p.stepId ? { ...s, artifactContent: r.data.content } : s))
      } catch {}
    }
    const onFiles = (p: any) => setFilesWritten((prev) => Array.from(new Set([...prev, ...(p.files || [])])))
    const onRunComplete = (p: any) => { setRunning(false); setStoppedFlag(p.status === 'stopped') }
    const onDev = (info: any) => {
      if (!info) return
      setDevStatus(info.status || 'stopped')
      if (info.port) {
        setDevPort(info.port)
        setDevUrl(urlFor(info.port))
      }
      if (info.status === 'stopped' || info.status === 'failed') {
        setDevUrl(null); setDevPort(null)
      }
    }

    sock.on('pipeline:run_created', onCreated)
    sock.on('pipeline:iteration_start', onIter)
    sock.on('pipeline:agent_start', onStart)
    sock.on('pipeline:agent_chunk', onChunk)
    sock.on('pipeline:agent_complete', onComplete)
    sock.on('pipeline:agent_error', onError)
    sock.on('pipeline:review_verdict', onReview)
    sock.on('pipeline:agent_artifact', onArtifact)
    sock.on('pipeline:files_written', onFiles)
    sock.on('pipeline:run_complete', onRunComplete)
    sock.on('devserver:status', onDev)
    return () => {
      sock.off('pipeline:run_created', onCreated)
      sock.off('pipeline:iteration_start', onIter)
      sock.off('pipeline:agent_start', onStart)
      sock.off('pipeline:agent_chunk', onChunk)
      sock.off('pipeline:agent_complete', onComplete)
      sock.off('pipeline:agent_error', onError)
      sock.off('pipeline:review_verdict', onReview)
      sock.off('pipeline:agent_artifact', onArtifact)
      sock.off('pipeline:files_written', onFiles)
      sock.off('pipeline:run_complete', onRunComplete)
      sock.off('devserver:status', onDev)
    }
  }, [])

  function start() {
    if (!project) return
    sockRef.current?.emit('pipeline:start', { projectId: project.id, maxIterations }, (res: any) => {
      if (!res?.ok) alert('start failed: ' + (res?.error || 'unknown'))
    })
  }
  function stop() {
    if (!runId) return
    sockRef.current?.emit('pipeline:stop', { runId })
  }
  function resume() {
    if (!runId) return
    sockRef.current?.emit('pipeline:resume', { runId })
  }

  function startPreview() {
    if (!project) return
    setDevBusy(true)
    setDevStatus('starting')
    sockRef.current?.emit('devserver:start', { projectId: project.id, workspacePath: project.workspace_path }, (res: any) => {
      setDevBusy(false)
      if (!res?.ok) {
        setDevStatus('failed')
        alert('preview failed to start: ' + (res?.error || 'unknown'))
      } else if (res.info) {
        setDevStatus(res.info.status || 'ready')
        if (res.info.port) { setDevPort(res.info.port); setDevUrl(urlFor(res.info.port)) }
      }
    })
  }
  function stopPreview() {
    if (!project) return
    setDevBusy(true)
    sockRef.current?.emit('devserver:stop', { projectId: project.id }, () => {
      setDevBusy(false)
      setDevStatus('stopped')
      setDevUrl(null)
    })
  }

  // Query devserver status on mount so the iframe shows up if it's already running
  useEffect(() => {
    if (!project) return
    const sock = sockRef.current
    if (!sock) return
    sock.emit('devserver:status', { projectId: project.id }, (res: any) => {
      if (res?.ok && res.info) {
        setDevStatus(res.info.status || 'stopped')
        if (res.info.port) { setDevPort(res.info.port); setDevUrl(urlFor(res.info.port)) }
      }
    })
  }, [project])

  const grouped = useMemo(() => {
    const map = new Map<number, Step[]>()
    for (const s of steps) {
      const list = map.get(s.iteration) || []
      list.push(s); map.set(s.iteration, list)
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [steps])

  return (
    <div className="flex flex-col h-screen pb-9">
      <div className="px-6 py-3 border-b border-border flex items-center gap-3">
        <Link href={`/projects/${params.slug}`} className="text-muted hover:text-text" title="Back to project">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <div className="text-lg font-semibold">
            <Link href={`/projects/${params.slug}`} className="hover:text-accent">{project?.name || '...'}</Link>
            <span className="text-muted"> — Execute</span>
          </div>
          <div className="text-xs text-muted">iteration {iteration} • {steps.length} steps {runId ? `• run ${runId}` : ''}</div>
        </div>
        <select className="h-9 rounded-md border border-border bg-surfaceAlt px-2 text-sm" value={maxIterations} onChange={(e) => setMaxIterations(Number(e.target.value))} title="How many auto-fix passes the QA can request before giving up">
          {PASS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          {(['terminal','split','preview'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 ${view === v ? 'bg-accent/20 text-accent' : 'text-muted'}`}>{v}</button>
          ))}
        </div>
        {/* Preview controls */}
        {devStatus === 'ready' && devUrl ? (
          <Button size="sm" variant="secondary" onClick={stopPreview} disabled={devBusy} title={devUrl}>
            ◼ Stop preview
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={startPreview} disabled={devBusy || devStatus === 'starting'}>
            {devStatus === 'starting' ? 'Starting…' : '▶ Preview'}
          </Button>
        )}
        {!running && (
          <>
            <Button onClick={start}>Run</Button>
            {stoppedFlag && runId && <Button variant="warn" onClick={resume}>Resume</Button>}
          </>
        )}
        {running && <Button variant="danger" onClick={stop}>Stop</Button>}
      </div>

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* Preview takes the main area when view==='preview' */}
        {view === 'preview' ? (
          <div className="col-span-12 flex flex-col overflow-hidden">
            {devStatus !== 'ready' || !devUrl ? (
              <div className="flex-1 flex items-center justify-center flex-col gap-3 text-sm text-muted">
                {devStatus === 'starting' && <div>⏳ Starting dev server…</div>}
                {devStatus === 'failed' && <div className="text-danger">Dev server failed to start. Check terminal logs.</div>}
                {devStatus === 'stopped' && (
                  <>
                    <div>No preview running.</div>
                    <Button onClick={startPreview} disabled={devBusy}>▶ Start preview</Button>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="px-4 py-2 border-b border-border flex items-center gap-2 text-xs">
                  <Badge variant="success">live</Badge>
                  <a href={devUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">{devUrl}</a>
                  <button onClick={() => { setDevUrl(urlFor(devPort) + '?t=' + Date.now()) }} className="ml-auto text-muted hover:text-text">↻ refresh</button>
                </div>
                <iframe src={devUrl} className="flex-1 w-full bg-white" />
              </>
            )}
          </div>
        ) : (
          <>
            <div className="col-span-12 md:col-span-8 lg:col-span-9 overflow-auto p-4 space-y-6">
              {steps.length > 0 && (
                <div className="flex items-center justify-between -mb-2">
                  <span className="text-xs uppercase tracking-wide text-muted">Iterations</span>
                  <button
                    onClick={allCollapsed ? expandAll : collapseAll}
                    className="text-xs text-accent hover:underline">
                    {allCollapsed ? '▸ Expand all' : '▾ Collapse all'}
                  </button>
                </div>
              )}
              {grouped.length === 0 && <div className="text-sm text-muted">No steps yet. Press Run to start.</div>}
              {grouped.map(([iter, list]) => (
                <div key={iter}>
                  <div className="text-xs uppercase tracking-wide text-muted mb-2">Iteration {iter}</div>
                  <div className="space-y-2">
                    {list.map((s) => (
                      <details
                        key={s.stepId}
                        open={!collapsed.has(s.stepId)}
                        onToggle={(e) => {
                          const isOpen = (e.target as HTMLDetailsElement).open
                          setCollapsed((prev) => {
                            const next = new Set(prev)
                            if (isOpen) next.delete(s.stepId); else next.add(s.stepId)
                            return next
                          })
                        }}
                        className="rounded-lg border border-border bg-surface">
                        <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${ROLE_COLOR[s.role] || 'bg-surfaceAlt text-muted'}`}>{s.role}</span>
                          <span className="font-medium">{s.name}</span>
                          <span className="ml-auto flex items-center gap-2">
                            {s.artifactPath && (
                              <span className="text-xs text-muted truncate max-w-[200px]" title={s.artifactPath}>{s.artifactPath}</span>
                            )}
                            {s.verdict === 'approve' && <Badge variant="success">approved</Badge>}
                            {s.verdict === 'request_changes' && <Badge variant="danger">changes</Badge>}
                            <Badge variant={s.status === 'completed' ? 'success' : s.status === 'failed' ? 'danger' : 'accent'}>{s.status}</Badge>
                          </span>
                        </summary>
                        <div className="px-3 pb-3 max-h-[500px] overflow-auto">
                          {s.status === 'failed' && (
                            <div className="text-sm text-danger whitespace-pre-wrap font-mono">{s.errorMessage || 'Failed (see terminal below for details).'}</div>
                          )}
                          {s.status === 'running' && !s.artifactContent && (
                            <div className="text-xs text-muted italic py-3">Running… ver el feed en vivo en la terminal de abajo.</div>
                          )}
                          {s.artifactContent && (
                            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-text">{stripFrontmatter(s.artifactContent)}</pre>
                          )}
                          {s.status === 'completed' && !s.artifactContent && !s.artifactPath && (
                            <div className="text-xs text-muted italic py-3">Sin artifact (.md no generado).</div>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {view !== 'terminal' && (
              <aside className="col-span-12 md:col-span-4 lg:col-span-3 border-l border-border overflow-auto">
                <Card className="m-3">
                  <CardHeader><div className="font-medium text-sm">Files written</div></CardHeader>
                  <CardBody>
                    {filesWritten.length === 0 && <div className="text-xs text-muted">None yet.</div>}
                    <ul className="space-y-1 text-xs">
                      {filesWritten.slice().reverse().map((f) => (
                        <li key={f} className="truncate" title={f}>{f}</li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              </aside>
            )}
          </>
        )}
      </div>
      <BottomTerminal />
    </div>
  )
}
