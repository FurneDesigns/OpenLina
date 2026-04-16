'use client'
import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { io, Socket } from 'socket.io-client'
import { v4 as uuid } from 'uuid'
import { TerminalSquare, ChevronDown, ChevronUp, X, Plus, Trash2 } from 'lucide-react'
import 'xterm/css/xterm.css'

export interface BottomTerminalHandle {
  /** Send a command to the active bash tab (retries until ready) */
  sendCommand: (cmd: string) => void
  /** Open a new bash tab, run a command in it, and expand the panel */
  openTabWithCommand: (cmd: string, label?: string) => Promise<void>
  expand: () => void
  /** Attach to a PTY session already running on the server */
  attachSession: (sessionId: string, label: string) => Promise<void>
  /** Write raw data to a session's terminal (buffered until terminal is ready) */
  writeToSession: (sessionId: string, data: string) => void
}

interface TerminalTab {
  id: string
  label: string
  sessionId: string
}

interface BottomTerminalProps {
  cwd?: string
  defaultHeight?: number
}

const MIN_HEIGHT = 80
const MAX_HEIGHT = 700
const DEFAULT_HEIGHT = 220
const COLLAPSED_HEIGHT = 32

const BottomTerminal = forwardRef<BottomTerminalHandle, BottomTerminalProps>(function BottomTerminal({ cwd, defaultHeight = DEFAULT_HEIGHT }, ref) {
  const [collapsed, setCollapsed] = useState(false)
  const [height, setHeight] = useState(defaultHeight)
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)

  const containerRef   = useRef<HTMLDivElement>(null)
  const dragRef        = useRef<{ startY: number; startH: number } | null>(null)
  const socketRef      = useRef<Socket | null>(null)
  const termInstances  = useRef<Map<string, import('xterm').Terminal>>(new Map())
  const fitAddons      = useRef<Map<string, import('xterm-addon-fit').FitAddon>>(new Map())
  const termDivRefs    = useRef<Map<string, HTMLDivElement | null>>(new Map())
  // Sessions confirmed created on server
  const readySessions  = useRef<Set<string>>(new Set())
  // Sessions that are interactive bash shells (not agent attach sessions)
  const bashSessions   = useRef<Set<string>>(new Set())
  // Tabs where term.open() has been called successfully
  const openedTabs     = useRef<Set<string>>(new Set())
  // Tabs waiting to be opened (created while collapsed / before div existed)
  const pendingOpen    = useRef<Set<string>>(new Set())
  // Data written before the xterm terminal instance existed (buffered)
  const pendingWrites  = useRef<Map<string, string[]>>(new Map())

  // ─── Socket setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io('/terminal', { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('terminal:output', ({ sessionId, data }: { sessionId: string; data: string }) => {
      termInstances.current.get(sessionId)?.write(data)
    })

    socket.on('terminal:exit', ({ sessionId }: { sessionId: string }) => {
      termInstances.current.get(sessionId)?.write('\r\n\x1b[31m[process exited]\x1b[0m\r\n')
    })

    return () => { socket.disconnect() }
  }, [])

  // ─── Mount a terminal into its div ───────────────────────────────────────────
  // Returns true if mounted successfully, false if div not ready yet (defer)
  const mountTab = useCallback((tabId: string, sessionId: string, isAttach = false) => {
    const el = termDivRefs.current.get(tabId)
    if (!el || el.offsetParent === null && !isAttach) {
      // div not in layout yet — keep in pending, will retry on expand
      pendingOpen.current.add(tabId)
      return false
    }

    const term = termInstances.current.get(sessionId)
    const fit  = fitAddons.current.get(sessionId)
    if (!term || !fit) return false
    if (openedTabs.current.has(tabId)) return true

    term.open(el)
    openedTabs.current.add(tabId)
    pendingOpen.current.delete(tabId)

    requestAnimationFrame(() => {
      try { fit.fit() } catch { return }
      const { cols, rows } = term
      if (cols > 0 && rows > 0 && !readySessions.current.has(sessionId)) {
        if (!isAttach) {
          // New bash session — create on server
          socketRef.current?.emit('session:create', {
            sessionId,
            command: '/bin/bash',
            cwd: cwd ?? '/',
            cols,
            rows,
          })
          bashSessions.current.add(sessionId)
        }
        readySessions.current.add(sessionId)
      }
    })
    return true
  }, [cwd])

  // ─── When panel expands or tabs change: flush pending mounts + refit ──────────
  useEffect(() => {
    if (collapsed) return

    // Mount any pending tabs
    for (const tabId of Array.from(pendingOpen.current)) {
      const tab = (tabs as TerminalTab[]).find((t) => t.id === tabId)
      if (tab) {
        // Small delay so the DOM has painted after un-collapse
        setTimeout(() => mountTab(tabId, tab.sessionId), 60)
      }
    }

    // Refit + refresh all opened terminals so text is visible after resize/expand
    const t = setTimeout(() => {
      for (const [sessionId, fit] of Array.from(fitAddons.current.entries())) {
        try {
          fit.fit()
          const term = termInstances.current.get(sessionId)
          if (term) {
            term.refresh(0, term.rows - 1)
            term.scrollToBottom()
          }
        } catch { /* ignore */ }
      }
    }, 40)
    return () => clearTimeout(t)
  }, [collapsed, height, tabs, mountTab])

  // ─── ResizeObserver: refit when container element is resized ─────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (collapsed) return
      for (const [sessionId, fit] of Array.from(fitAddons.current.entries())) {
        try {
          fit.fit()
          const term = termInstances.current.get(sessionId)
          if (term) {
            term.refresh(0, term.rows - 1)
            term.scrollToBottom()
          }
        } catch { /* ignore */ }
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [collapsed])

  // ─── Build an xterm Terminal + register socket callbacks ─────────────────────
  async function buildTerm(sessionId: string, guardInput: boolean) {
    const { Terminal }      = await import('xterm')
    const { FitAddon }      = await import('xterm-addon-fit')
    const { WebLinksAddon } = await import('xterm-addon-web-links')

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
      theme: {
        background: '#0d1117', foreground: '#c9d1d9', cursor: '#c9d1d9',
        black: '#484f58', red: '#ff7b72', green: '#3fb950', yellow: '#d29922',
        blue: '#58a6ff', magenta: '#bc8cff', cyan: '#39c5cf', white: '#b1bac4',
        brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364',
        brightYellow: '#e3b341', brightBlue: '#79c0ff', brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd', brightWhite: '#f0f6fc',
      },
      allowTransparency: true,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())

    let resizeTimeout: ReturnType<typeof setTimeout>
    const handleResize = (cols: number, rows: number) => {
      if (!readySessions.current.has(sessionId)) return
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        socketRef.current?.emit('session:resize', { sessionId, cols, rows })
      }, 200)
    }

    if (guardInput) {
      // For bash sessions: only allow input/resize AFTER PTY is confirmed created
      term.onData((data) => {
        if (!readySessions.current.has(sessionId)) return
        socketRef.current?.emit('session:input', { sessionId, data })
      })
      term.onResize(({ cols, rows }) => handleResize(cols, rows))
    } else {
      // For attached agent sessions: pass through directly (session already exists)
      term.onData((data) => {
        socketRef.current?.emit('session:input', { sessionId, data })
      })
      term.onResize(({ cols, rows }) => handleResize(cols, rows))
    }

    termInstances.current.set(sessionId, term)
    fitAddons.current.set(sessionId, fit)
    return { term, fit }
  }

  // ─── Create tab (new bash session) ───────────────────────────────────────────
  const createTab = useCallback(async () => {
    const sessionId = uuid()
    const tabId     = uuid()
    const label     = `bash ${tabs.length + 1}`

    await buildTerm(sessionId, true)

    const newTab: TerminalTab = { id: tabId, label, sessionId }
    setTabs((prev) => [...prev, newTab])
    setActiveTab(tabId)

    // Attempt mount after React has painted
    setTimeout(() => {
      const mounted = mountTab(tabId, sessionId, false)
      if (!mounted) pendingOpen.current.add(tabId)
    }, 80)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.length, mountTab])

  // ─── Imperative handle ────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    sendCommand(cmd: string) {
      // Prefer a bash tab over agent tabs (agent tabs may be running a CLI process)
      const bashTab = tabs.find((t) => bashSessions.current.has(t.sessionId))
      const target  = bashTab ?? tabs.find((t) => t.id === activeTab)
      if (!target) return

      const sendNow = (sessionId: string) => {
        socketRef.current?.emit('session:input', { sessionId, data: cmd + '\r' })
      }
      if (readySessions.current.has(target.sessionId)) {
        setActiveTab(target.id)
        sendNow(target.sessionId)
        return
      }
      const sessionId = target.sessionId
      let attempts = 0
      const retry = () => {
        if (readySessions.current.has(sessionId)) { setActiveTab(target.id); sendNow(sessionId) }
        else if (attempts++ < 20) setTimeout(retry, 250)
      }
      retry()
    },
    async openTabWithCommand(cmd: string, label?: string) {
      // Always create a fresh bash tab so the command is clearly visible
      const sessionId = uuid()
      const tabId     = uuid()
      const tabLabel  = label ?? 'bash'

      await buildTerm(sessionId, true)

      setTabs((prev) => [...prev, { id: tabId, label: tabLabel, sessionId }])
      setActiveTab(tabId)
      setCollapsed(false)

      // Mount and send command once session is ready
      setTimeout(() => {
        const mounted = mountTab(tabId, sessionId, false)
        if (!mounted) pendingOpen.current.add(tabId)

        // Send the command after session is confirmed on server
        let attempts = 0
        const retry = () => {
          if (readySessions.current.has(sessionId)) {
            socketRef.current?.emit('session:input', { sessionId, data: cmd + '\r' })
          } else if (attempts++ < 30) {
            setTimeout(retry, 250)
          }
        }
        retry()
      }, 80)
    },
    expand() {
      setCollapsed(false)
    },
    async attachSession(sessionId: string, label: string) {
      if (termInstances.current.has(sessionId)) return

      const tabId = uuid()
      const { term } = await buildTerm(sessionId, false)
      readySessions.current.add(sessionId)

      // Flush any data that arrived before the terminal was created
      const buffered = pendingWrites.current.get(sessionId)
      if (buffered) {
        for (const chunk of buffered) term.write(chunk)
        pendingWrites.current.delete(sessionId)
      }

      setTabs((prev) => [...prev, { id: tabId, label, sessionId }])
      setActiveTab(tabId)
      setCollapsed(false)

      setTimeout(() => {
        const mounted = mountTab(tabId, sessionId, true)
        if (!mounted) pendingOpen.current.add(tabId)
      }, 80)
    },
    writeToSession(sessionId: string, data: string) {
      const term = termInstances.current.get(sessionId)
      if (term) {
        term.write(data)
      } else {
        // Terminal not created yet — buffer until attachSession sets it up
        if (!pendingWrites.current.has(sessionId)) pendingWrites.current.set(sessionId, [])
        pendingWrites.current.get(sessionId)!.push(data)
      }
    },
  }), [tabs, activeTab, mountTab])

  // ─── Open first tab on mount ──────────────────────────────────────────────────
  const mountedRef = useRef(false)
  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    createTab()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Close tab ───────────────────────────────────────────────────────────────
  function closeTab(tabId: string) {
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return
    socketRef.current?.emit('session:kill', { sessionId: tab.sessionId })
    termInstances.current.get(tab.sessionId)?.dispose()
    termInstances.current.delete(tab.sessionId)
    fitAddons.current.delete(tab.sessionId)
    readySessions.current.delete(tab.sessionId)
    bashSessions.current.delete(tab.sessionId)
    pendingWrites.current.delete(tab.sessionId)
    openedTabs.current.delete(tabId)
    pendingOpen.current.delete(tabId)
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId)
      if (activeTab === tabId) setActiveTab(next[next.length - 1]?.id ?? null)
      return next
    })
  }

  // ─── Drag to resize ───────────────────────────────────────────────────────────
  function onDragStart(e: React.MouseEvent) {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startH: height }

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const delta = dragRef.current.startY - ev.clientY
      const next  = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragRef.current.startH + delta))
      setHeight(next)
      if (collapsed) setCollapsed(false)
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const activeSession = tabs.find((t) => t.id === activeTab)?.sessionId

  return (
    <div
      ref={containerRef}
      className="shrink-0 border-t border-border bg-[#0d1117] flex flex-col select-none"
      style={{ height: collapsed ? COLLAPSED_HEIGHT : height }}
    >
      {/* Drag handle — only when expanded */}
      {!collapsed && (
        <div
          onMouseDown={onDragStart}
          className="h-1 w-full cursor-row-resize bg-transparent hover:bg-primary/40 transition-colors shrink-0 group"
          title="Drag to resize"
        >
          <div className="mx-auto mt-0.5 w-10 h-0.5 rounded-full bg-border group-hover:bg-primary/60 transition-colors" />
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center gap-1 px-2 border-b border-border bg-[#161b22] shrink-0 h-8">
        <TerminalSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

        <div className="flex items-center gap-0.5 flex-1 overflow-x-auto min-w-0">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 h-6 rounded text-[11px] cursor-pointer shrink-0 transition-colors group ${
                tab.id === activeTab
                  ? 'bg-[#0d1117] text-foreground'
                  : 'text-muted-foreground hover:bg-white/5'
              }`}
            >
              <span>{tab.label}</span>
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
          <button
            onClick={createTab}
            className="flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors shrink-0"
            title="New terminal"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          {activeSession && (
            <button
              onClick={() => {
                socketRef.current?.emit('session:kill', { sessionId: activeSession })
                termInstances.current.get(activeSession)?.write('\r\n\x1b[31m[killed]\x1b[0m\r\n')
              }}
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Kill process"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            title={collapsed ? 'Expand terminal' : 'Collapse terminal'}
          >
            {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/*
        Terminal panes — ALWAYS in the DOM (display:none when collapsed).
        Never unmount with conditional rendering: xterm canvases would be
        detached and text would disappear on expand.
      */}
      <div
        className="flex-1 overflow-hidden relative"
        style={{ display: collapsed ? 'none' : 'block' }}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            ref={(el) => { termDivRefs.current.set(tab.id, el) }}
            className={`absolute inset-0 p-1 w-full h-full transition-opacity overflow-y-scroll ${tab.id === activeTab ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}`}
          />
        ))}
        {tabs.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground/40 text-xs">
            Click + to open a terminal
          </div>
        )}
      </div>
    </div>
  )
})

export default BottomTerminal
