'use client'
import { Plus, X } from 'lucide-react'
import { useTerminalStore } from '@/store/useTerminalStore'
import { useSocket } from '@/hooks/useSocket'
import { v4 as uuid } from 'uuid'
import { cn } from '@/lib/utils'
import type { TerminalSession } from '@/types/terminal'

export function TerminalTabs() {
  const { sessions, activeSessionId, addSession, removeSession, setActiveSession } = useTerminalStore()
  const socket = useSocket('terminal')

  function newSession() {
    const id = uuid()
    const session: TerminalSession = {
      id,
      label: `Terminal ${sessions.length + 1}`,
      command: '',
      cwd: '',
      status: 'active',
      createdAt: new Date().toISOString(),
    }
    addSession(session)
  }

  function closeSession(id: string) {
    socket.emit('session:kill', { sessionId: id })
    removeSession(id)
  }

  return (
    <div className="flex items-center border-b border-border bg-card px-2 py-1.5 gap-1">
      {sessions.map((s) => (
        <button
          key={s.id}
          onClick={() => setActiveSession(s.id)}
          className={cn(
            'flex items-center gap-1.5 rounded px-3 py-1 text-xs transition-colors group',
            activeSessionId === s.id
              ? 'bg-primary/20 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', s.status === 'active' ? 'bg-green-400' : 'bg-red-400')} />
          {s.label}
          <span
            onClick={(e) => { e.stopPropagation(); closeSession(s.id) }}
            className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
          >
            <X className="h-3 w-3" />
          </span>
        </button>
      ))}
      <button
        onClick={newSession}
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        title="New terminal"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
