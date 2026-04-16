'use client'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useAgentStore } from '@/store/useAgentStore'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Agent } from '@/types/agent'

const AGENT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
]

export function AgentSidebar() {
  const { agents, selectedAgentId, selectAgent, updateAgent } = useAgentStore()
  const agent = agents.find((a) => a.id === selectedAgentId)
  const [form, setForm] = useState<Partial<Agent>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (agent) setForm({ ...agent })
  }, [agent?.id])

  if (!selectedAgentId || !agent) return null

  async function save() {
    setSaving(true)
    await fetch(`/api/agents/${selectedAgentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        systemPrompt: form.systemPrompt,
        color: form.color,
      }),
    })
    updateAgent(selectedAgentId!, { ...form } as Agent)
    setSaving(false)
    selectAgent(null)
  }

  return (
    <div className="absolute right-0 top-0 z-10 h-full w-80 border-l border-border bg-card shadow-2xl flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Configure Agent</h3>
        <button onClick={() => selectAgent(null)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Name</label>
          <Input
            value={form.name ?? ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Description</label>
          <Input
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">System Prompt</label>
          <textarea
            value={form.systemPrompt ?? ''}
            onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            rows={6}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            placeholder="You are a helpful assistant specialized in..."
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">Color</label>
          <div className="flex gap-2">
            {AGENT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setForm({ ...form, color: c })}
                className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: form.color === c ? 'white' : 'transparent',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border p-4">
        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}
