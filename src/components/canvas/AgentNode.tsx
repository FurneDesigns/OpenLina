'use client'
import { memo, useState } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Play, Square, Trash2, Settings2, MessageSquare } from 'lucide-react'
import { useAgentStore } from '@/store/useAgentStore'
import { useSocket } from '@/hooks/useSocket'
import { cn } from '@/lib/utils'
import type { Agent } from '@/types/agent'

const STATUS_COLORS = {
  idle: 'bg-slate-500',
  running: 'bg-green-400 animate-pulse',
  error: 'bg-red-500',
  waiting: 'bg-yellow-500 animate-pulse',
}

export const AgentNode = memo(function AgentNode({ data, selected }: NodeProps<Agent>) {
  const [prompt, setPrompt] = useState('')
  const [showPrompt, setShowPrompt] = useState(false)
  const { removeAgent, selectAgent } = useAgentStore()
  const socket = useSocket('agents')

  function runAgent() {
    if (!prompt.trim()) return
    socket.emit('agent:run', { agentId: data.id, prompt: prompt.trim() })
    setPrompt('')
    setShowPrompt(false)
  }

  function cancelAgent() {
    socket.emit('agent:cancel', { agentId: data.id })
  }

  async function deleteAgent() {
    await fetch(`/api/agents/${data.id}`, { method: 'DELETE' })
    removeAgent(data.id)
  }

  return (
    <div
      className={cn(
        'group relative min-w-[180px] rounded-xl border-2 bg-card shadow-lg transition-all',
        selected ? 'border-primary shadow-primary/20' : 'border-border',
      )}
      style={{ borderColor: selected ? data.color : undefined }}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-border !bg-card"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-border !bg-card"
      />

      {/* Header */}
      <div
        className="flex items-center gap-2 rounded-t-xl px-3 py-2"
        style={{ backgroundColor: data.color + '22' }}
      >
        <div className={cn('h-2 w-2 rounded-full', STATUS_COLORS[data.status ?? 'idle'])} />
        <span className="flex-1 truncate text-xs font-semibold" style={{ color: data.color }}>
          {data.name}
        </span>
        {/* Action buttons — visible on hover */}
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => selectAgent(data.id)}
            className="rounded p-0.5 hover:bg-white/10 text-muted-foreground hover:text-foreground"
            title="Configure"
          >
            <Settings2 className="h-3 w-3" />
          </button>
          <button
            onClick={() => setShowPrompt((v) => !v)}
            className="rounded p-0.5 hover:bg-white/10 text-muted-foreground hover:text-foreground"
            title="Send message"
          >
            <MessageSquare className="h-3 w-3" />
          </button>
          <button
            onClick={deleteAgent}
            className="rounded p-0.5 hover:bg-red-500/20 text-muted-foreground hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Description */}
      {data.description && (
        <div className="px-3 pb-1 pt-0.5 text-[10px] text-muted-foreground line-clamp-2">
          {data.description}
        </div>
      )}

      {/* Status footer */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] text-muted-foreground capitalize">{data.status}</span>
        {data.status === 'running' ? (
          <button
            onClick={cancelAgent}
            className="flex h-5 w-5 items-center justify-center rounded bg-red-500/20 text-red-400 hover:bg-red-500/40"
          >
            <Square className="h-2.5 w-2.5" />
          </button>
        ) : (
          <button
            onClick={() => setShowPrompt((v) => !v)}
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"
          >
            <Play className="h-2.5 w-2.5" />
          </button>
        )}
      </div>

      {/* Inline prompt input */}
      {showPrompt && (
        <div className="border-t border-border px-3 py-2">
          <div className="flex gap-1.5">
            <input
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runAgent()}
              placeholder="Send message..."
              className="flex-1 rounded bg-background px-2 py-1 text-xs outline-none ring-1 ring-border focus:ring-primary"
            />
            <button
              onClick={runAgent}
              disabled={!prompt.trim()}
              className="rounded bg-primary px-2 py-1 text-xs text-white disabled:opacity-40 hover:bg-primary/80"
            >
              Run
            </button>
          </div>
        </div>
      )}
    </div>
  )
})
