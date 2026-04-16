'use client'
import { useState } from 'react'
import { Plus, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAgentStore } from '@/store/useAgentStore'
import { Input } from '@/components/ui/input'
import type { Agent } from '@/types/agent'

export function AgentToolbar() {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const { addAgent } = useAgentStore()

  async function createAgent() {
    if (!name.trim()) return
    setCreating(true)
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), canvasX: 200, canvasY: 200 }),
    })
    const agent = await res.json() as Agent
    addAgent(agent)
    setName('')
    setShowForm(false)
    setCreating(false)
  }

  return (
    <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
      {showForm ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
          <Input
            autoFocus
            placeholder="Agent name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createAgent()}
            className="h-7 w-44 text-xs"
          />
          <Button size="sm" onClick={createAgent} disabled={creating || !name.trim()}>
            {creating ? '...' : 'Create'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
        </div>
      ) : (
        <Button size="sm" onClick={() => setShowForm(true)} className="shadow-lg gap-1.5">
          <Plus className="h-4 w-4" />
          Add Agent
        </Button>
      )}
    </div>
  )
}
