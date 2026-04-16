'use client'
import { useEffect, useRef } from 'react'
import { useTerminalSession } from '@/hooks/useTerminalSession'

interface TerminalPaneProps {
  sessionId: string
}

export function TerminalPane({ sessionId }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<import('xterm').Terminal | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let term: import('xterm').Terminal
    let fitAddon: import('xterm-addon-fit').FitAddon

    async function init() {
      const { Terminal } = await import('xterm')
      const { FitAddon } = await import('xterm-addon-fit')
      // xterm CSS loaded via dynamic import string for bundler compatibility
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.min.css'
      document.head.appendChild(link)

      term = new Terminal({
        theme: {
          background: '#0a0d14',
          foreground: '#c9d1d9',
          cursor: '#c9d1d9',
          selectionBackground: '#264f78',
        },
        fontFamily: '"Fira Code", "Cascadia Code", monospace',
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
        allowTransparency: true,
      })

      fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(containerRef.current!)
      fitAddon.fit()
      termRef.current = term

      const observer = new ResizeObserver(() => fitAddon.fit())
      observer.observe(containerRef.current!)
      return () => observer.disconnect()
    }

    const cleanup = init()
    return () => {
      cleanup.then((fn) => fn?.())
      term?.dispose()
      termRef.current = null
    }
  }, [sessionId])

  useTerminalSession(sessionId, termRef)

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      style={{ backgroundColor: '#0a0d14' }}
    />
  )
}
