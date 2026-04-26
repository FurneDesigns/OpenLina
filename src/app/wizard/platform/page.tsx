'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'

export default function PlatformWizard() {
  const router = useRouter()
  const [tab, setTab] = useState<'cli' | 'api'>('cli')
  const [cliCommand, setCliCommand] = useState('claude')
  const [cliModel, setCliModel] = useState('sonnet')
  const [apiProvider, setApiProvider] = useState<'anthropic' | 'openai' | 'google' | 'ollama'>('anthropic')
  const [apiKey, setApiKey] = useState('')
  const [apiModel, setApiModel] = useState('claude-sonnet-4-6')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true); setError(null)
    try {
      if (tab === 'cli') {
        const r = await fetch('/api/llm', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ provider_type: 'cli', cli_command: cliCommand, model_id: cliModel, label: `${cliCommand} (${cliModel})`, priority: 100 }),
        })
        const j = await r.json()
        if (!j.ok) throw new Error(j.error)
      } else {
        const p = await fetch('/api/platforms', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: apiProvider, label: apiProvider, api_key: apiKey }),
        }).then((r) => r.json())
        if (!p.ok) throw new Error(p.error)
        const r = await fetch('/api/llm', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ provider_type: 'api', platform_id: apiProvider, model_id: apiModel, label: `${apiProvider} ${apiModel}`, priority: 50 }),
        })
        const j = await r.json()
        if (!j.ok) throw new Error(j.error)
      }
      router.push('/wizard/project')
    } catch (err: any) { setError(err?.message || String(err)) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Add your first LLM</h1>
      <Card>
        <CardHeader>
          <div className="flex gap-2">
            <button className={`px-3 py-1 rounded ${tab === 'cli' ? 'bg-accent/10 text-accent' : 'text-muted'}`} onClick={() => setTab('cli')}>CLI tool</button>
            <button className={`px-3 py-1 rounded ${tab === 'api' ? 'bg-accent/10 text-accent' : 'text-muted'}`} onClick={() => setTab('api')}>API key</button>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={submit} className="space-y-4">
            {tab === 'cli' ? (
              <>
                <div>
                  <Label htmlFor="cmd">CLI command (must be installed in PATH)</Label>
                  <select id="cmd" value={cliCommand} onChange={(e) => setCliCommand(e.target.value)} className="h-9 w-full rounded-md border border-border bg-surfaceAlt px-3 text-sm">
                    {['claude', 'codex', 'gemini', 'aider', 'opencode', 'ollama', 'llm'].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="m">Model id (or family alias)</Label>
                  <Input id="m" value={cliModel} onChange={(e) => setCliModel(e.target.value)} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="prov">Provider</Label>
                  <select id="prov" value={apiProvider} onChange={(e) => setApiProvider(e.target.value as any)} className="h-9 w-full rounded-md border border-border bg-surfaceAlt px-3 text-sm">
                    <option value="anthropic">Anthropic</option>
                    <option value="openai">OpenAI</option>
                    <option value="google">Google (Gemini)</option>
                    <option value="ollama">Ollama (local)</option>
                  </select>
                </div>
                {apiProvider !== 'ollama' && (
                  <div>
                    <Label htmlFor="key">API key</Label>
                    <Input id="key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                  </div>
                )}
                <div>
                  <Label htmlFor="apim">Model id</Label>
                  <Input id="apim" value={apiModel} onChange={(e) => setApiModel(e.target.value)} />
                </div>
              </>
            )}
            {error && <div className="text-sm text-danger">{error}</div>}
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Continue'}</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
