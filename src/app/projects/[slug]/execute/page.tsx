'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import Link from 'next/link'
import {
  Play, Square, ChevronLeft, Loader2, CheckCircle, XCircle,
  StopCircle, Clock, TerminalSquare, Layout, Monitor,
  RefreshCw, AlertTriangle, Server, Wifi, WifiOff, FileCode,
  ChevronDown, ChevronRight, Cpu, Terminal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import BottomTerminal from '@/components/shared/BottomTerminal'
import type { BottomTerminalHandle } from '@/components/shared/BottomTerminal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string; name: string; slug: string
  workspacePath?: string; framework: string; projectType: string
  brandColors?: { primary: string }
}

interface Step {
  stepId: string; agentId: string; agentName: string; role: string
  iteration: number; status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped'
  output: string; tokensUsed?: number
}

interface RunState {
  runId: string | null
  status: 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'stopped'
  iteration: number; maxIterations: number
  steps: Step[]
}

type ViewMode = 'terminal' | 'split' | 'preview'

// ─── Structured log entries ──────────────────────────────────────────────────

type LogEntry =
  | { type: 'run_start';   runId: string; time: string }
  | { type: 'iteration';   n: number }
  | { type: 'agent_start'; stepId: string; name: string; role: string; iteration: number; time: string }
  | { type: 'chunk';       stepId: string; text: string }   // all chunks merged per stepId
  | { type: 'agent_end';   stepId: string; tokens: number; model: string; via: string }
  | { type: 'agent_err';   stepId: string; message: string }
  | { type: 'qa';          iteration: number; passed: boolean; issues?: string }
  | { type: 'files';       files: string[] }
  | { type: 'run_end';     status: string; iterations: number }
  | { type: 'devlog';      line: string }
  | { type: 'devstatus';   status: string; url?: string; error?: string }
  | { type: 'system';      text: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  ceo: '#f59e0b', designer: '#8b5cf6', dev: '#3b82f6',
  qa: '#10b981', devops: '#ef4444', pm: '#6366f1', fullstack: '#3b82f6',
}

const ROLE_BG: Record<string, string> = {
  ceo: 'rgba(245,158,11,0.1)', designer: 'rgba(139,92,246,0.1)', dev: 'rgba(59,130,246,0.1)',
  qa: 'rgba(16,185,129,0.1)', devops: 'rgba(239,68,68,0.1)', pm: 'rgba(99,102,241,0.1)', fullstack: 'rgba(59,130,246,0.1)',
}

// ─── Log entry renderers ──────────────────────────────────────────────────────

function IterationDivider({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-3 my-3 px-4">
      <div className="flex-1 h-px bg-border/60" />
      <span className="text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
        Iteration {n}
      </span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  )
}

function AgentBlock({ entry, chunks, endEntry, errorEntry }: {
  entry: Extract<LogEntry, { type: 'agent_start' }>
  chunks: string
  endEntry?: Extract<LogEntry, { type: 'agent_end' }>
  errorEntry?: Extract<LogEntry, { type: 'agent_err' }>
}) {
  const [expanded, setExpanded] = useState(true)
  const color = ROLE_COLORS[entry.role] ?? '#6366f1'
  const bg    = ROLE_BG[entry.role]    ?? 'rgba(99,102,241,0.08)'
  const isRunning = !endEntry && !errorEntry

  return (
    <div className="mx-4 mb-2 rounded-lg border overflow-hidden" style={{ borderColor: `${color}30` }}>
      {/* Agent header */}
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:brightness-110 transition-all"
        style={{ background: bg }}
      >
        <span className="flex items-center gap-1.5">
          {expanded
            ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
            : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          {isRunning && <Loader2 className="h-3 w-3 animate-spin" style={{ color }} />}
          {endEntry && <CheckCircle className="h-3 w-3 text-green-400" />}
          {errorEntry && <XCircle className="h-3 w-3 text-red-400" />}
        </span>

        <span className="font-semibold text-xs" style={{ color }}>{entry.name}</span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide font-medium"
          style={{ background: `${color}20`, color }}
        >
          {entry.role}
        </span>

        <span className="text-[10px] text-muted-foreground/50 ml-1">iter {entry.iteration}</span>

        <div className="flex-1" />

        {/* Model badge */}
        {endEntry && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70 font-mono">
            <Cpu className="h-2.5 w-2.5" />
            <span className={endEntry.via === 'cli' ? 'text-purple-400' : 'text-blue-400'}>
              {endEntry.model || (endEntry.via === 'cli' ? 'CLI' : 'API')}
            </span>
            {endEntry.via && (
              <span className="opacity-40 text-[9px]">({endEntry.via.toUpperCase()})</span>
            )}
          </span>
        )}
        {endEntry && (
          <span className="text-[10px] text-muted-foreground/50 ml-2 font-mono">
            {endEntry.tokens.toLocaleString()} tok
          </span>
        )}
        <span className="text-[10px] text-muted-foreground/30 ml-2">{entry.time}</span>
      </button>

      {/* Agent output */}
      {expanded && (
        <div className="bg-[#0a0e14] px-4 py-3 font-mono text-[11px] leading-relaxed text-[#adbac7] whitespace-pre-wrap max-h-[400px] overflow-y-auto">
          {chunks || <span className="text-muted-foreground/30 italic">waiting for output…</span>}
          {isRunning && <span className="inline-block w-2 h-3 bg-current animate-pulse ml-0.5 align-middle" />}
          {errorEntry && (
            <div className="mt-2 text-red-400 border-t border-red-500/20 pt-2">
              ✗ {errorEntry.message}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function QaBlock({ passed, issues, iteration }: { passed: boolean; issues?: string; iteration: number }) {
  return (
    <div className={`mx-4 mb-2 rounded-lg border px-4 py-3 ${
      passed
        ? 'border-green-500/30 bg-green-500/5'
        : 'border-red-500/30 bg-red-500/5'
    }`}>
      <div className="flex items-center gap-2">
        {passed
          ? <CheckCircle className="h-4 w-4 text-green-400" />
          : <AlertTriangle className="h-4 w-4 text-red-400" />}
        <span className={`font-semibold text-sm ${passed ? 'text-green-400' : 'text-red-400'}`}>
          QA {passed ? 'PASS' : 'FAIL'} — iteration {iteration}
        </span>
      </div>
      {issues && (
        <div className="mt-2 text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed">
          {issues}
        </div>
      )}
    </div>
  )
}

function FilesBlock({ files }: { files: string[] }) {
  return (
    <div className="mx-4 mb-2 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <FileCode className="h-3.5 w-3.5 text-green-400" />
        <span className="text-xs font-semibold text-green-400">{files.length} file{files.length !== 1 ? 's' : ''} written</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {files.map((f) => (
          <span key={f} className="text-[10px] font-mono text-green-300/80 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
            {f}
          </span>
        ))}
      </div>
    </div>
  )
}

function RunEndBlock({ status, iterations }: { status: string; iterations: number }) {
  const ok = status === 'completed'
  const stopped = status === 'stopped'
  return (
    <div className={`mx-4 mb-2 rounded-lg border px-4 py-3 flex items-center gap-3 ${
      ok      ? 'border-green-500/30 bg-green-500/5' :
      stopped ? 'border-yellow-500/30 bg-yellow-500/5' :
                'border-red-500/30 bg-red-500/5'
    }`}>
      {ok      && <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />}
      {stopped && <StopCircle  className="h-5 w-5 text-yellow-400 shrink-0" />}
      {!ok && !stopped && <XCircle className="h-5 w-5 text-red-400 shrink-0" />}
      <div>
        <div className={`font-semibold text-sm ${ok ? 'text-green-400' : stopped ? 'text-yellow-400' : 'text-red-400'}`}>
          Pipeline {status.toUpperCase()}
        </div>
        <div className="text-xs text-muted-foreground">{iterations} iteration{iterations !== 1 ? 's' : ''} completed</div>
      </div>
    </div>
  )
}

function DevLogLine({ line }: { line: string }) {
  const isError = /error|fail/i.test(line)
  const isWarn  = /warn/i.test(line)
  return (
    <div className={`font-mono text-[10px] px-4 py-0.5 leading-relaxed ${
      isError ? 'text-red-400/80' : isWarn ? 'text-yellow-400/80' : 'text-muted-foreground/40'
    }`}>
      {line}
    </div>
  )
}

// ─── Log viewer ───────────────────────────────────────────────────────────────

function PipelineLogViewer({ entries }: { entries: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries.length])

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground/30 select-none">
        <Terminal className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm">Press Start to run the agent pipeline</p>
      </div>
    )
  }

  // Build a map of stepId → chunks (merged), agent_end, agent_err
  const chunkMap   = new Map<string, string>()
  const endMap     = new Map<string, Extract<LogEntry, { type: 'agent_end' }>>()
  const errMap     = new Map<string, Extract<LogEntry, { type: 'agent_err' }>>()
  for (const e of entries) {
    if (e.type === 'chunk')     chunkMap.set(e.stepId, (chunkMap.get(e.stepId) ?? '') + e.text)
    if (e.type === 'agent_end') endMap.set(e.stepId, e)
    if (e.type === 'agent_err') errMap.set(e.stepId, e)
  }

  // Deduplicate agent_start by stepId (keep first)
  const seenSteps = new Set<string>()

  return (
    <div className="flex-1 overflow-y-auto py-3">
      {entries.map((entry, i) => {
        switch (entry.type) {
          case 'run_start':
            return (
              <div key={i} className="px-4 mb-3 flex items-center gap-2">
                <Play className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs font-mono text-blue-400">Run started</span>
                <span className="text-[10px] text-muted-foreground/40 font-mono">{entry.runId.slice(0, 8)}</span>
                <span className="text-[10px] text-muted-foreground/30 ml-auto">{entry.time}</span>
              </div>
            )

          case 'iteration':
            return <IterationDivider key={i} n={entry.n} />

          case 'agent_start': {
            if (seenSteps.has(entry.stepId)) return null
            seenSteps.add(entry.stepId)
            return (
              <AgentBlock
                key={entry.stepId}
                entry={entry}
                chunks={chunkMap.get(entry.stepId) ?? ''}
                endEntry={endMap.get(entry.stepId)}
                errorEntry={errMap.get(entry.stepId)}
              />
            )
          }

          // chunks and ends are rendered inside AgentBlock — skip standalone
          case 'chunk':
          case 'agent_end':
          case 'agent_err':
            return null

          case 'qa':
            return <QaBlock key={i} passed={entry.passed} issues={entry.issues} iteration={entry.iteration} />

          case 'files':
            return <FilesBlock key={i} files={entry.files} />

          case 'run_end':
            return <RunEndBlock key={i} status={entry.status} iterations={entry.iterations} />

          case 'devlog':
            return <DevLogLine key={i} line={entry.line} />

          case 'devstatus':
            return (
              <div key={i} className="px-4 py-1">
                <span className={`text-[10px] font-mono ${
                  entry.status === 'ready'   ? 'text-green-400' :
                  entry.status === 'error'   ? 'text-red-400' :
                  entry.status === 'stopped' ? 'text-yellow-400' :
                                               'text-blue-400'
                }`}>
                  [devserver] {entry.status}{entry.url ? ` → ${entry.url}` : ''}{entry.error ? `: ${entry.error}` : ''}
                </span>
              </div>
            )

          case 'system':
            return (
              <div key={i} className="px-4 py-0.5">
                <span className="text-[10px] font-mono text-muted-foreground/40">{entry.text}</span>
              </div>
            )

          default:
            return null
        }
      })}
      <div ref={bottomRef} />
    </div>
  )
}

// ─── Task markdown viewer ─────────────────────────────────────────────────────

function TaskMdViewer({ markdown }: { markdown: string }) {
  // Minimal markdown → HTML: headers, bold, code, lists
  const lines = markdown.split('\n')
  return (
    <div className="prose prose-invert prose-sm max-w-none font-sans">
      {lines.map((line, i) => {
        if (/^### /.test(line)) return <h3 key={i} className="text-sm font-semibold text-foreground mt-4 mb-1">{line.slice(4)}</h3>
        if (/^## /.test(line))  return <h2 key={i} className="text-base font-bold text-foreground mt-5 mb-2 border-b border-border pb-1">{line.slice(3)}</h2>
        if (/^# /.test(line))   return <h1 key={i} className="text-lg font-bold text-foreground mt-0 mb-3">{line.slice(2)}</h1>
        if (/^[-*] /.test(line)) return <div key={i} className="flex gap-2 text-xs text-muted-foreground my-0.5"><span className="text-primary/60 shrink-0">•</span><span>{line.slice(2)}</span></div>
        if (/^\d+\. /.test(line)) return <div key={i} className="flex gap-2 text-xs text-muted-foreground my-0.5"><span className="text-primary/60 shrink-0 font-mono">{line.match(/^\d+/)?.[0]}.</span><span>{line.replace(/^\d+\. /, '')}</span></div>
        if (line.startsWith('```')) return null
        if (!line.trim()) return <div key={i} className="h-2" />
        return <p key={i} className="text-xs text-muted-foreground/80 my-0.5 leading-relaxed">{line}</p>
      })}
    </div>
  )
}

// ─── Minor UI components ──────────────────────────────────────────────────────

function StepStatusDot({ status }: { status: Step['status'] }) {
  if (status === 'running') return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
    </span>
  )
  if (status === 'completed') return <span className="h-2.5 w-2.5 rounded-full bg-green-500 inline-flex" />
  if (status === 'failed')    return <span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-flex" />
  if (status === 'stopped')   return <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 inline-flex" />
  return <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30 inline-flex" />
}

function RunStatusBadge({ status }: { status: RunState['status'] }) {
  const cfg: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    idle:      { label: 'Ready',     color: 'text-muted-foreground', icon: <Clock className="h-3.5 w-3.5" /> },
    starting:  { label: 'Starting',  color: 'text-blue-400',         icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
    running:   { label: 'Running',   color: 'text-blue-400',         icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
    completed: { label: 'Completed', color: 'text-green-400',        icon: <CheckCircle className="h-3.5 w-3.5" /> },
    failed:    { label: 'Failed',    color: 'text-red-400',          icon: <XCircle className="h-3.5 w-3.5" /> },
    stopped:   { label: 'Stopped',   color: 'text-yellow-400',       icon: <StopCircle className="h-3.5 w-3.5" /> },
  }
  const c = cfg[status] ?? cfg.idle
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${c.color}`}>
      {c.icon} {c.label}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExecutePage() {
  const { slug } = useParams() as { slug: string }
  const searchParams = useSearchParams()
  const router = useRouter()
  const existingRunId = searchParams.get('runId')

  const [project,    setProject]    = useState<Project | null>(null)
  const [runState,   setRunState]   = useState<RunState>({ runId: null, status: 'idle', iteration: 0, maxIterations: 3, steps: [] })
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [viewMode,   setViewMode]   = useState<ViewMode>('terminal')
  const [previewUrl, setPreviewUrl] = useState('')
  const [maxIter,    setMaxIter]    = useState(3)
  const [writtenFiles, setWrittenFiles] = useState<string[]>([])
  const [devServerStatus, setDevServerStatus] = useState<'idle' | 'starting' | 'ready' | 'error' | 'stopped'>('idle')
  const [devServerError,  setDevServerError]  = useState<string | undefined>()
  const [taskMd,          setTaskMd]          = useState<string | null>(null)
  const [expandedSteps,   setExpandedSteps]   = useState<Set<string>>(new Set())

  function toggleStep(id: string) {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const socketRef     = useRef<Socket | null>(null)
  const runIdRef      = useRef<string | null>(existingRunId)
  const bottomTermRef = useRef<BottomTerminalHandle>(null)
  const projectIdRef  = useRef<string | null>(null)
  // Maps stepId → PTY sessionId for CLI-based agent runs
  const stepSessionRef = useRef<Map<string, string>>(new Map())

  const pushEntry = useCallback((e: LogEntry) => {
    setLogEntries((prev) => {
      // For chunks: merge into existing chunk entry for same stepId
      if (e.type === 'chunk') {
        const idx = [...prev].reverse().findIndex((p) => p.type === 'chunk' && p.stepId === e.stepId)
        if (idx !== -1) {
          const realIdx = prev.length - 1 - idx
          const next = [...prev]
          const existing = next[realIdx] as Extract<LogEntry, { type: 'chunk' }>
          next[realIdx] = { ...existing, text: existing.text + e.text }
          return next.slice(-2000)
        }
      }
      return [...prev, e].slice(-2000)
    })
  }, [])

  // Load project
  useEffect(() => {
    fetch(`/api/projects/${slug}`).then((r) => r.json()).then((p) => {
      setProject(p)
      projectIdRef.current = p.id
    })
  }, [slug])

  // Load existing run
  useEffect(() => {
    if (!existingRunId || !project) return
    fetch(`/api/projects/${project.id}/runs/${existingRunId}`)
      .then((r) => r.json())
      .then(({ run, steps }: { run: Record<string, unknown>; steps: Record<string, unknown>[] }) => {
        setRunState({
          runId: existingRunId,
          status: run.status as RunState['status'],
          iteration: Number(run.iteration),
          maxIterations: Number(run.max_iterations),
          steps: steps.map((s) => ({
            stepId: s.id as string,
            agentId: s.agent_id as string,
            agentName: (s.agent_name as string) ?? 'Agent',
            role: (s.role as string) ?? 'dev',
            iteration: Number(s.iteration),
            status: s.status as Step['status'],
            output: (s.output as string) ?? '',
            tokensUsed: s.tokens_used ? Number(s.tokens_used) : undefined,
          })),
        })
        // Reconstruct log from steps
        const entries: LogEntry[] = []
        let lastIter = 0
        for (const s of steps) {
          if (Number(s.iteration) !== lastIter) {
            lastIter = Number(s.iteration)
            entries.push({ type: 'iteration', n: lastIter })
          }
          const sid = s.id as string
          entries.push({ type: 'agent_start', stepId: sid, name: (s.agent_name as string) ?? 'Agent', role: (s.role as string) ?? 'dev', iteration: lastIter, time: '' })
          if (s.output) entries.push({ type: 'chunk', stepId: sid, text: s.output as string })
          if (s.status === 'completed') entries.push({ type: 'agent_end', stepId: sid, tokens: Number(s.tokens_used ?? 0), model: '', via: '' })
        }
        setLogEntries(entries)
        runIdRef.current = existingRunId
      })
  }, [existingRunId, project])

  // Socket setup
  useEffect(() => {
    const socket = io('/pipeline', { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('pipeline:run_created', ({ runId, maxIterations }: { runId: string; maxIterations: number }) => {
      runIdRef.current = runId
      setRunState((s) => ({ ...s, runId, maxIterations, status: 'running' }))
      router.replace(`/projects/${slug}/execute?runId=${runId}`)
      socket.emit('pipeline:subscribe', { runId })
      pushEntry({ type: 'run_start', runId, time: new Date().toLocaleTimeString() })
    })

    socket.on('pipeline:iteration_start', ({ iteration }: { iteration: number }) => {
      setRunState((s) => ({ ...s, iteration }))
      pushEntry({ type: 'iteration', n: iteration })
    })

    socket.on('pipeline:agent_start', ({ stepId, agentName, role, iteration, sessionId }: { stepId: string; agentId: string; agentName: string; role: string; iteration: number; sessionId?: string }) => {
      pushEntry({ type: 'agent_start', stepId, name: agentName, role, iteration, time: new Date().toLocaleTimeString() })
      setRunState((s) => {
        if (s.steps.find((st) => st.stepId === stepId)) return s
        return { ...s, steps: [...s.steps, { stepId, agentId: '', agentName, role, iteration, status: 'running', output: '' }] }
      })
      // Open a terminal tab for this agent when running via PTY (CLI mode)
      if (sessionId) {
        stepSessionRef.current.set(stepId, sessionId)
        bottomTermRef.current?.attachSession(sessionId, `${agentName} · iter ${iteration}`)
      }
    })

    socket.on('pipeline:agent_chunk', ({ stepId, delta }: { stepId: string; delta: string }) => {
      pushEntry({ type: 'chunk', stepId, text: delta })
      setRunState((s) => ({
        ...s,
        steps: s.steps.map((st) => st.stepId === stepId ? { ...st, output: st.output + delta } : st),
      }))
      // Route chunk to the agent's terminal tab (handles race with attachSession via buffer)
      const sessionId = stepSessionRef.current.get(stepId)
      if (sessionId) bottomTermRef.current?.writeToSession(sessionId, delta)
    })

    socket.on('pipeline:agent_complete', ({ stepId, tokensUsed, modelLabel, providerType }: {
      stepId: string; output: string; tokensUsed: number; modelLabel: string; providerType: string
    }) => {
      pushEntry({ type: 'agent_end', stepId, tokens: tokensUsed, model: modelLabel ?? '', via: providerType ?? '' })
      setRunState((s) => {
        const updated = s.steps.map((st) => st.stepId === stepId ? { ...st, status: 'completed' as const, tokensUsed } : st)
        // When PM agent completes, fetch task.md from workspace
        const step = updated.find((st) => st.stepId === stepId)
        if (step?.role === 'pm' && projectIdRef.current) {
          fetch(`/api/projects/${projectIdRef.current}/task-md`)
            .then((r) => r.ok ? r.text() : null)
            .then((md) => { if (md) setTaskMd(md) })
            .catch(() => {})
        }
        return { ...s, steps: updated }
      })
    })

    socket.on('pipeline:agent_error', ({ stepId, message }: { stepId: string; message: string }) => {
      pushEntry({ type: 'agent_err', stepId, message })
      setRunState((s) => ({
        ...s,
        steps: s.steps.map((st) => st.stepId === stepId ? {
          ...st,
          status: message === 'Aborted' ? 'stopped' : 'failed',
        } : st),
      }))
    })

    socket.on('pipeline:files_written', ({ files }: { files: string[] }) => {
      pushEntry({ type: 'files', files })
      setWrittenFiles((prev) => {
        const merged = [...prev]
        for (const f of files) if (!merged.includes(f)) merged.push(f)
        return merged
      })
    })

    socket.on('pipeline:qa_verdict', ({ iteration, passed, issues }: { iteration: number; passed: boolean; issues?: string }) => {
      pushEntry({ type: 'qa', iteration, passed, issues })
    })

    socket.on('pipeline:run_complete', ({ status, iterations }: { runId: string; status: string; iterations: number }) => {
      setRunState((s) => ({
        ...s,
        status: status as RunState['status'],
        steps: s.steps.map((st) => {
          if (st.status !== 'running') return st
          if (status === 'stopped') return { ...st, status: 'stopped' as const }
          if (status === 'failed') return { ...st, status: 'failed' as const }
          return { ...st, status: 'completed' as const }
        }),
      }))
      pushEntry({ type: 'run_end', status, iterations })
      if (status === 'completed' && projectIdRef.current) {
        setDevServerStatus('starting')
        socket.emit('devserver:prepare', { projectId: projectIdRef.current })
      }
    })

    socket.on('devserver:log', ({ line }: { projectId: string; line: string }) => {
      pushEntry({ type: 'devlog', line })
    })

    socket.on('devserver:status', ({ status, url, error }: { projectId: string; status: string; url?: string; error?: string }) => {
      const s = status as typeof devServerStatus
      setDevServerStatus(s)
      setDevServerError(error)
      pushEntry({ type: 'devstatus', status, url, error })
      if (s === 'ready' && url) {
        setPreviewUrl(url)
        setViewMode('split')
      }
    })

    socket.on('devserver:prepared', ({ port, command, workspacePath, error }: {
      port?: number; command?: string; workspacePath?: string; error?: string
    }) => {
      if (error || !port || !command) {
        setDevServerStatus('error')
        setDevServerError(error ?? 'Could not prepare dev server')
        return
      }
      const fullCmd = `cd "${workspacePath}" && PORT=${port} ${command}`
      bottomTermRef.current?.openTabWithCommand(fullCmd, 'dev server')
    })

    if (existingRunId) socket.emit('pipeline:subscribe', { runId: existingRunId })

    return () => { socket.disconnect() }
  }, [slug, router, pushEntry, existingRunId])

  // Check devserver on mount for existing run
  useEffect(() => {
    if (!project || !existingRunId) return
    const t = setTimeout(() => socketRef.current?.emit('devserver:status', { projectId: project.id }), 800)
    return () => clearTimeout(t)
  }, [project, existingRunId])

  function startDevServer() {
    if (!project || !socketRef.current) return
    setDevServerStatus('starting')
    setDevServerError(undefined)

    // Expand terminal so user can see what's happening
    bottomTermRef.current?.expand()

    // Ask backend to allocate a port + detect the dev command
    socketRef.current.emit('devserver:prepare', { projectId: project.id })
  }

  function stopDevServer() {
    if (!project || !socketRef.current) return
    socketRef.current.emit('devserver:stop', { projectId: project.id })
  }

  function startRun(overrideMaxIter?: number) {
    if (!project || !socketRef.current) return
    const iterToUse = overrideMaxIter ?? maxIter
    setRunState({ runId: null, status: 'starting', iteration: 0, maxIterations: iterToUse, steps: [] })
    setLogEntries([])
    setWrittenFiles([])
    setDevServerStatus('idle')
    setTaskMd(null)
    setExpandedSteps(new Set())
    stepSessionRef.current.clear()
    socketRef.current.emit('pipeline:start', { projectId: project.id, maxIterations: iterToUse })
  }

  const autoStartHandled = useRef(false)
  useEffect(() => {
    const autoStart = searchParams.get('autoStart')
    if (autoStart && project && socketRef.current && !autoStartHandled.current) {
      autoStartHandled.current = true
      const mIter = Number(autoStart) || 3
      setMaxIter(mIter)
      startRun(mIter)
      router.replace(`/projects/${project.slug}/execute`)
    }
  }, [searchParams, project, router])

  function stopRun() {
    const runId = runIdRef.current
    if (!runId) return
    socketRef.current?.emit('pipeline:stop', { runId })
    if (project) fetch(`/api/projects/${project.id}/runs/${runId}`, { method: 'DELETE' }).catch(() => {})
    setRunState((s) => ({
      ...s,
      status: 'stopped',
      steps: s.steps.map((st) => st.status === 'running' ? { ...st, status: 'stopped' as const } : st),
    }))
    pushEntry({ type: 'run_end', status: 'stopped', iterations: runState.iteration })
  }

  const isRunning = runState.status === 'running' || runState.status === 'starting'
  const primaryColor = project?.brandColors?.primary ?? 'hsl(var(--primary))'

  const stepsByIter = runState.steps.reduce<Record<number, Step[]>>((acc, s) => {
    acc[s.iteration] = [...(acc[s.iteration] ?? []), s]
    return acc
  }, {})

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">

      {/* Top accent line */}
      <div className="h-0.5 shrink-0 absolute top-0 left-0 right-0 z-10" style={{ background: primaryColor }} />

      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 shrink-0">
        <Link href={`/projects/${slug}`} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="font-medium text-sm truncate">{project?.name ?? 'Loading…'}</div>

        {/* Iteration selector */}
        {!isRunning && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Max iterations:</span>
            {[1, 2, 3, 5].map((n) => (
              <button
                key={n}
                onClick={() => setMaxIter(n)}
                className={`w-6 h-6 rounded text-xs transition-colors ${
                  maxIter === n ? 'bg-primary/20 text-primary' : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
          {([
            ['terminal', <TerminalSquare className="h-3.5 w-3.5" key="t" />, 'Terminal'],
            ['split',    <Layout className="h-3.5 w-3.5" key="s" />,         'Split'],
            ['preview',  <Monitor className="h-3.5 w-3.5" key="p" />,        'Preview'],
          ] as [ViewMode, React.ReactNode, string][]).map(([mode, icon, label]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
                viewMode === mode ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        <RunStatusBadge status={runState.status} />

        {/* Preview server button */}
        {project?.workspacePath && (
          devServerStatus === 'starting' ? (
            <span className="flex items-center gap-1.5 text-xs text-blue-400 font-mono px-2">
              <Loader2 className="h-3 w-3 animate-spin" /> starting…
            </span>
          ) : devServerStatus === 'ready' ? (
            <button
              onClick={() => setViewMode('split')}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded text-xs bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 transition-colors"
            >
              <Wifi className="h-3 w-3" /> Preview
            </button>
          ) : (
            <button
              onClick={() => { startDevServer(); setViewMode('split') }}
              disabled={isRunning}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded text-xs bg-muted text-muted-foreground border border-border hover:text-foreground hover:bg-muted/80 transition-colors disabled:opacity-40"
            >
              <Server className="h-3 w-3" /> Preview
            </button>
          )
        )}

        {isRunning ? (
          <Button size="sm" variant="destructive" onClick={stopRun} className="gap-1.5 h-7 text-xs">
            <Square className="h-3 w-3" /> Stop
          </Button>
        ) : (
          <Button size="sm" onClick={() => startRun()} disabled={!project} className="gap-1.5 h-7 text-xs" style={{ background: primaryColor }}>
            <Play className="h-3 w-3" />
            {runState.status === 'idle' ? 'Start' : 'Re-run'}
          </Button>
        )}
      </div>

      {/* Agent timeline */}
      {runState.steps.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card overflow-x-auto shrink-0">
          {Object.entries(stepsByIter).map(([iter, steps]) => (
            <div key={iter} className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-muted-foreground font-mono">i{iter}</span>
              {steps.map((step) => (
                <div
                  key={step.stepId}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-muted/20 text-xs"
                  title={`${step.agentName} (${step.role}) — ${step.status}`}
                >
                  <StepStatusDot status={step.status} />
                  <span className="font-medium" style={{ color: ROLE_COLORS[step.role] }}>{step.agentName}</span>
                  {step.tokensUsed != null && (
                    <span className="text-muted-foreground text-[10px]">{step.tokensUsed.toLocaleString()}t</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-hidden flex min-h-0">

        {/* Task / pipeline status pane */}
        {(viewMode === 'terminal' || viewMode === 'split') && (
          <div className={`flex flex-col min-h-0 ${viewMode === 'split' ? 'w-1/2 border-r border-border' : 'w-full'}`}>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50 shrink-0">
              <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Task</span>
              {writtenFiles.length > 0 && (
                <span className="flex items-center gap-1 ml-2 text-[10px] text-green-400 font-mono">
                  <FileCode className="h-3 w-3" /> {writtenFiles.length} files written
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto bg-[#0d1117] p-4">
              {runState.steps.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground/30 text-sm gap-2">
                  <TerminalSquare className="h-8 w-8 opacity-30" />
                  <span>Start a run — agents will open terminal tabs below</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {taskMd && (
                    <div className="mb-6">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Global Task Specification</h3>
                      <div className="p-4 rounded-lg bg-[#0a0e14] border border-border/40">
                        <TaskMdViewer markdown={taskMd} />
                      </div>
                    </div>
                  )}
                  {taskMd && <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Agent Execution Logs</h3>}
                  {runState.steps.map((step) => {
                    const isExpanded = expandedSteps.has(step.stepId)
                    return (
                    <div key={step.stepId} className="rounded-lg border border-border/40 bg-[#161b22] overflow-hidden flex flex-col">
                      <button 
                        onClick={() => toggleStep(step.stepId)}
                        className="flex items-center gap-3 px-3 py-2 w-full text-left hover:bg-white/5 transition-colors cursor-pointer select-none outline-none"
                      >
                        <StepStatusDot status={step.status} />
                        <span className="font-semibold text-xs" style={{ color: ROLE_COLORS[step.role] }}>{step.agentName}</span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/50">{step.role}</span>
                        <span className="text-[10px] text-muted-foreground/30 ml-auto flex items-center gap-2">
                          <span>iter {step.iteration}</span>
                          {step.tokensUsed != null && (
                            <span className="font-mono text-muted-foreground/40">{step.tokensUsed.toLocaleString()} tok</span>
                          )}
                          <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </span>
                      </button>
                      {isExpanded && step.output && (
                        <div className="p-3 bg-[#0a0e14] border-t border-border/40 text-[11px] font-mono text-[#adbac7] whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                           {step.output.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')}
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview pane */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`flex flex-col min-h-0 ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/50 shrink-0">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Preview</span>
              {devServerStatus === 'starting' && (
                <span className="flex items-center gap-1 text-[10px] text-blue-400 font-mono">
                  <Loader2 className="h-3 w-3 animate-spin" /> starting…
                </span>
              )}
              {devServerStatus === 'ready' && (
                <span className="flex items-center gap-1 text-[10px] text-green-400">
                  <Wifi className="h-3 w-3" /> ready
                </span>
              )}
              {devServerStatus === 'error' && (
                <span className="flex items-center gap-1 text-[10px] text-red-400" title={devServerError}>
                  <WifiOff className="h-3 w-3" /> error
                </span>
              )}
              <div className="flex-1" />
              <input
                type="text"
                value={previewUrl}
                onChange={(e) => setPreviewUrl(e.target.value)}
                placeholder="http://localhost:4000"
                className="h-6 rounded border border-border bg-background px-2 text-[11px] font-mono w-48 outline-none focus:border-primary/50"
              />
              <button
                onClick={() => {
                  const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement
                  if (iframe && previewUrl) iframe.src = previewUrl
                }}
                title="Reload"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex-1 bg-white relative overflow-hidden">
              {previewUrl ? (
                <iframe id="preview-iframe" src={previewUrl} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-forms" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full bg-[#0d1117] text-muted-foreground">
                  {devServerStatus === 'starting' ? (
                    <>
                      <Loader2 className="h-10 w-10 mb-3 animate-spin opacity-40" />
                      <p className="text-sm mb-1">Starting preview server…</p>
                      <p className="text-xs opacity-40">Watch the Pipeline Output for details</p>
                    </>
                  ) : devServerStatus === 'error' ? (
                    <>
                      <WifiOff className="h-10 w-10 mb-3 opacity-30" />
                      <p className="text-sm mb-1 text-red-400">Server failed to start</p>
                      <p className="text-xs opacity-50 mb-3 max-w-xs text-center">{devServerError}</p>
                      <button onClick={startDevServer} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary/20 text-primary text-xs hover:bg-primary/30 transition-colors">
                        <Server className="h-3.5 w-3.5" /> Retry
                      </button>
                    </>
                  ) : (
                    <>
                      <Monitor className="h-10 w-10 mb-3 opacity-20" />
                      <p className="text-sm mb-1">No preview running</p>
                      {project?.workspacePath && (
                        <button onClick={startDevServer} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary/20 text-primary text-xs hover:bg-primary/30 transition-colors">
                          <Server className="h-3.5 w-3.5" /> Start preview server
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
              {previewUrl && devServerStatus === 'ready' && (
                <button onClick={stopDevServer} title="Stop dev server" className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-black/60 text-white/70 hover:bg-black/80 transition-colors">
                  <Square className="h-3 w-3" /> stop
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom terminal panel */}
      <BottomTerminal ref={bottomTermRef} cwd={project?.workspacePath} />
    </div>
  )
}
