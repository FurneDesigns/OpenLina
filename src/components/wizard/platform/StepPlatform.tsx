'use client'
import { useState } from 'react'
import { ApiKeyInput } from '@/components/shared/ApiKeyInput'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModelOption { id: string; label: string }

interface StepPlatformProps {
  platformId: string
  platformLabel: string
  platformIcon: React.ReactNode
  models: ModelOption[]
  showOrgId?: boolean
  showEndpointUrl?: boolean
  apiKeyPlaceholder?: string
  value: {
    apiKey?: string
    orgId?: string
    endpointUrl?: string
    modelId?: string
    enabled?: boolean
  }
  onChange: (v: { apiKey?: string; orgId?: string; endpointUrl?: string; modelId?: string; enabled?: boolean }) => void
}

type TestState = 'idle' | 'loading' | 'ok' | 'error'

export function StepPlatform({
  platformId,
  platformLabel,
  platformIcon,
  models,
  showOrgId,
  showEndpointUrl,
  apiKeyPlaceholder = 'sk-...',
  value,
  onChange,
}: StepPlatformProps) {
  const [testState, setTestState] = useState<TestState>('idle')
  const [testError, setTestError] = useState('')

  async function testConnection() {
    setTestState('loading')
    setTestError('')
    try {
      const res = await fetch('/api/platforms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformId,
          apiKey: value.apiKey,
          endpointUrl: value.endpointUrl,
          modelId: value.modelId,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setTestState('ok')
      } else {
        setTestState('error')
        setTestError(data.error)
      }
    } catch {
      setTestState('error')
      setTestError('Network error')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          {platformIcon}
        </div>
        <div>
          <h2 className="text-xl font-bold">{platformLabel}</h2>
          <p className="text-sm text-muted-foreground">Configure your {platformLabel} connection</p>
        </div>
        <div className="ml-auto">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <span className="text-muted-foreground">Enable</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={value.enabled !== false}
              onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
            />
          </label>
        </div>
      </div>

      {showEndpointUrl && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Endpoint URL</label>
          <Input
            placeholder="http://localhost:11434"
            value={value.endpointUrl ?? ''}
            onChange={(e) => onChange({ ...value, endpointUrl: e.target.value })}
          />
        </div>
      )}

      {!showEndpointUrl && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">API Key</label>
          <ApiKeyInput
            placeholder={apiKeyPlaceholder}
            value={value.apiKey ?? ''}
            onChange={(e) => onChange({ ...value, apiKey: e.target.value })}
          />
        </div>
      )}

      {showOrgId && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Organization ID <span className="text-muted-foreground/50">(optional)</span>
          </label>
          <Input
            placeholder="org-..."
            value={value.orgId ?? ''}
            onChange={(e) => onChange({ ...value, orgId: e.target.value })}
          />
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Default Model</label>
        <div className="flex flex-wrap gap-2">
          {models.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange({ ...value, modelId: m.id })}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                value.modelId === m.id
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={testConnection}
          disabled={testState === 'loading' || (!value.apiKey && !value.endpointUrl)}
        >
          {testState === 'loading' && <Loader2 className="h-3 w-3 animate-spin" />}
          Test connection
        </Button>
        {testState === 'ok' && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Connected
          </span>
        )}
        {testState === 'error' && (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <XCircle className="h-3.5 w-3.5" /> {testError}
          </span>
        )}
      </div>
    </div>
  )
}
