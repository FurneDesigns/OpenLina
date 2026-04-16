'use client'
import { useEffect, useRef } from 'react'
import { useSocket } from './useSocket'
import { useTerminalStore } from '@/store/useTerminalStore'
import { v4 as uuid } from 'uuid'
import type { Terminal } from 'xterm'

export function useTerminalSession(sessionId: string, terminalRef: React.RefObject<Terminal | null>) {
  const socket = useSocket('terminal')
  const { updateSession } = useTerminalStore()

  useEffect(() => {
    const term = terminalRef.current
    if (!term) return

    // Create the PTY session on server
    socket.emit('session:create', {
      sessionId,
      command: '',
      cwd: '',
      cols: term.cols,
      rows: term.rows,
    })

    socket.on('terminal:output', ({ sessionId: sid, data }: { sessionId: string; data: string }) => {
      if (sid === sessionId) term.write(data)
    })

    socket.on('terminal:exit', ({ sessionId: sid }: { sessionId: string }) => {
      if (sid === sessionId) {
        updateSession(sessionId, { status: 'dead' })
        term.write('\r\n\x1b[31m[Process exited]\x1b[0m\r\n')
      }
    })

    // Forward keystrokes to PTY
    const dataDisposable = term.onData((data) => {
      socket.emit('session:input', { sessionId, data })
    })

    // Forward resize events
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      socket.emit('session:resize', { sessionId, cols, rows })
    })

    return () => {
      socket.off('terminal:output')
      socket.off('terminal:exit')
      dataDisposable.dispose()
      resizeDisposable.dispose()
      socket.emit('session:kill', { sessionId })
    }
  }, [sessionId, socket, terminalRef, updateSession])
}
