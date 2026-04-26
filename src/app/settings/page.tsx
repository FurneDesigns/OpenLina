'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Label } from '@/components/ui/input'
import { useToastStore } from '@/store/useToastStore'

interface Llm {
  id: string
  label: string
  model_id: string
  provider_type: 'cli' | 'api'
  cli_command: string | null
  platform_id: string | null
  enabled: number
  priority: number
}

export default function SettingsPage() {
  const [llms, setLlms] = useState<Llm[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const push = useToastStore((s) => s.push)

  async function load() {
    const r = await fetch('/api/llm').then((r) => r.json())
    if (r.ok) setLlms(r.data)
  }
  useEffect(() => { load() }, [])

  async function toggle(id: string, enabled: boolean) {
    await fetch(`/api/llm/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled }) })
    load()
  }
  async function remove(id: string) {
    if (!confirm('Remove this LLM?')) return
    await fetch(`/api/llm/${id}`, { method: 'DELETE' })
    load()
  }
  async function test(id: string) {
    setBusyId(id)
    try {
      const r = await fetch('/api/platforms/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ llm_config_id: id }) }).then((r) => r.json())
      push(r.ok && r.data.healthy ? 'Healthy ✔' : `Unhealthy: ${r.data?.error || ''}`, r.ok && r.data.healthy ? 'success' : 'danger')
    } finally { setBusyId(null) }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <Link href="/wizard/platform"><Button>Add LLM</Button></Link>
      </div>
      <Card>
        <CardHeader><div className="font-medium">Configured LLMs</div></CardHeader>
        <CardBody>
          {!llms && <div className="text-sm text-muted">Loading…</div>}
          {llms && llms.length === 0 && <div className="text-sm text-muted">No LLMs configured.</div>}
          <div className="divide-y divide-border">
            {llms?.map((l) => (
              <div key={l.id} className="py-3 flex items-center gap-3">
                <Badge variant={l.provider_type === 'cli' ? 'accent' : 'neutral'}>{l.provider_type}</Badge>
                <div className="flex-1">
                  <div className="font-medium">{l.label}</div>
                  <div className="text-xs text-muted">
                    {l.provider_type === 'cli' ? `${l.cli_command} • ${l.model_id}` : `${l.platform_id} • ${l.model_id}`} • priority {l.priority}
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => test(l.id)} disabled={busyId === l.id}>{busyId === l.id ? 'Testing…' : 'Test'}</Button>
                <Button size="sm" variant="secondary" onClick={() => toggle(l.id, !l.enabled)}>{l.enabled ? 'Disable' : 'Enable'}</Button>
                <Button size="sm" variant="danger" onClick={() => remove(l.id)}>Remove</Button>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
