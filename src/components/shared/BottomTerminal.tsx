'use client'
import { useEffect, useRef, useState } from 'react'
import { getSocket } from '@/lib/socketClient'

interface Tab {
  stepId: string
  label: string
  buffer: string
}

const MAX_BUFFER = 400_000

export function BottomTerminal() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  // termReady is the trigger that re-runs the write effect once xterm has finished its async init.
  const [termReady, setTermReady] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const xtermRef = useRef<any>(null)
  const fitRef = useRef<any>(null)
  const writtenLenRef = useRef<Map<string, number>>(new Map())
  // Which tab is currently painted on the xterm. Lets us know when to clear+repaint vs. append.
  const displayedRef = useRef<string | null>(null)

  // Listen to ALL pipeline events so the terminal shows prompts, responses,
  // CLI output, npm install, errors — everything happening per agent step.
  useEffect(() => {
    const sock = getSocket('/pipeline')
    const onAgentStart = (p: any) => {
      if (!p?.stepId) return
      setTabs((prev) => prev.some((t) => t.stepId === p.stepId)
        ? prev
        : [...prev, { stepId: p.stepId, label: `${p.role || 'agent'}${p.name ? ' · ' + p.name : ''}`, buffer: '' }])
      setActiveId(p.stepId)
      setExpanded(true)
    }
    const onTerminalOutput = (p: any) => {
      if (!p?.stepId || !p?.data) return
      setTabs((prev) => {
        const existing = prev.find((t) => t.stepId === p.stepId)
        if (existing) {
          return prev.map((t) => {
            if (t.stepId !== p.stepId) return t
            const next = (t.buffer + p.data).slice(-MAX_BUFFER)
            return { ...t, buffer: next }
          })
        }
        // Lazy-create a tab if we got output for an unknown stepId (e.g. devserver logs).
        // Don't switch activeId so the user's current view isn't stolen.
        const label = p.stepLabel || (p.stepId.startsWith('devserver_') ? 'dev server' : p.stepId)
        return [...prev, { stepId: p.stepId, label, buffer: (p.data as string).slice(-MAX_BUFFER) }]
      })
    }
    const onIteration = (p: any) => {
      // Inject an iteration banner into the active tab if there is one
      const banner = `\r\n\x1b[35m═══ Iteration ${p.iteration} ═══\x1b[0m\r\n`
      setTabs((prev) => prev.map((t) => ({ ...t, buffer: (t.buffer + banner).slice(-MAX_BUFFER) })))
    }
    sock.on('pipeline:agent_start', onAgentStart)
    sock.on('pipeline:terminal_output', onTerminalOutput)
    sock.on('pipeline:iteration_start', onIteration)
    return () => {
      sock.off('pipeline:agent_start', onAgentStart)
      sock.off('pipeline:terminal_output', onTerminalOutput)
      sock.off('pipeline:iteration_start', onIteration)
    }
  }, [])

  useEffect(() => {
    if (!expanded || !containerRef.current || xtermRef.current) return
    let cancelled = false
    let resizeObs: ResizeObserver | null = null
    ;(async () => {
      // CRITICAL: import xterm.css — without it, char widths are wrong and the terminal
      // renders as a row of WWWWWW because the renderer falls back to a non-monospace font.
      await import('xterm/css/xterm.css')
      const { Terminal } = await import('xterm')
      const { FitAddon } = await import('xterm-addon-fit')
      if (cancelled || !containerRef.current) return
      // Wait for the container to actually have dimensions before opening
      // (the panel just animated from h-9 to h-80, so layout might not be settled yet).
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      if (cancelled || !containerRef.current) return
      const term = new Terminal({
        convertEol: true,
        scrollback: 10_000,
        fontFamily: '"SFMono-Regular", "Menlo", "Consolas", "DejaVu Sans Mono", monospace',
        fontSize: 12,
        lineHeight: 1.2,
        theme: { background: '#0b0d10', foreground: '#e6e8ec' },
      })
      const fit = new FitAddon()
      term.loadAddon(fit)
      term.open(containerRef.current)
      // Defer fit until the next paint so cell metrics are correct
      requestAnimationFrame(() => { try { fit.fit() } catch {} })
      xtermRef.current = term
      fitRef.current = fit
      // Force the write effect to run now that xterm is alive so any buffered
      // data accumulated during init becomes visible immediately.
      setTermReady(true)

      // Re-fit whenever the container size changes (panel collapse/expand, window resize)
      resizeObs = new ResizeObserver(() => {
        try { fit.fit() } catch {}
      })
      resizeObs.observe(containerRef.current)
    })()
    return () => {
      cancelled = true
      if (resizeObs) try { resizeObs.disconnect() } catch {}
    }
  }, [expanded])

  // Single source of truth: bring xterm to the latest state of the active tab.
  // Runs on every tabs change (new chunk arrived), every activeId change (tab clicked),
  // and once when xterm becomes ready (so any data buffered during init is flushed).
  useEffect(() => {
    const term = xtermRef.current
    if (!term || !activeId) return
    const tab = tabs.find((t) => t.stepId === activeId)
    const buf = tab?.buffer || ''

    // First time this tab is shown, OR user switched tabs → repaint from scratch
    if (displayedRef.current !== activeId) {
      term.clear()
      if (buf) term.write(buf)
      writtenLenRef.current.set(activeId, buf.length)
      displayedRef.current = activeId
      return
    }

    // Same tab, buffer changed → write the delta
    const written = writtenLenRef.current.get(activeId) || 0
    if (buf.length > written) {
      term.write(buf.slice(written))
      writtenLenRef.current.set(activeId, buf.length)
    } else if (buf.length < written) {
      // Buffer was rotated (hit MAX_BUFFER cap) — repaint
      term.clear()
      term.write(buf)
      writtenLenRef.current.set(activeId, buf.length)
    }
  }, [tabs, activeId, termReady])

  function clearAll() {
    setTabs([])
    setActiveId(null)
    writtenLenRef.current.clear()
    displayedRef.current = null
    try { xtermRef.current?.clear() } catch {}
  }

  return (
    <div className={`fixed bottom-0 left-0 right-0 border-t border-border bg-bg/95 backdrop-blur z-40 ${expanded ? 'h-80' : 'h-9'}`}>
      <div className="flex items-center justify-between px-3 h-9">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.length === 0 && <span className="text-xs text-muted">Terminal — sin actividad</span>}
          {tabs.map((t) => (
            <button key={t.stepId}
              onClick={() => { setActiveId(t.stepId); setExpanded(true) }}
              className={`px-2 py-1 text-xs rounded whitespace-nowrap ${t.stepId === activeId ? 'bg-accent/20 text-accent' : 'text-muted hover:text-text'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {tabs.length > 0 && (
            <button onClick={clearAll} className="text-xs text-muted hover:text-danger">clear</button>
          )}
          <button onClick={() => setExpanded((v) => !v)} className="text-xs text-muted hover:text-text">
            {expanded ? '▾ collapse' : '▸ expand'}
          </button>
        </div>
      </div>
      {expanded && <div ref={containerRef} className="h-[calc(100%-2.25rem)]" />}
    </div>
  )
}
