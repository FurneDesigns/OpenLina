'use client'
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ApiKeyInput } from '@/components/shared/ApiKeyInput'
import {
  Plus, Trash2, CheckCircle, XCircle, Loader2, RefreshCw,
  Terminal, Key, ChevronDown, ChevronUp, Eye, EyeOff, GripVertical,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CLIStatus {
  id: string; label: string; installed: boolean; version?: string
}

interface LLMConfig {
  id: string; label: string; platform_id: string; model_id: string
  priority: number; enabled: number; temperature: number; max_tokens: number | null
  provider_type: string | null; cli_command: string | null; cli_env_vars: string | null
}

// ─── CLI tool definitions ─────────────────────────────────────────────────────

const CLI_TOOLS = [
  {
    id: 'claude', label: 'Claude Code', icon: '🔮',
    desc: 'Anthropic\'s official CLI. Uses your Pro/Max subscription — no per-token billing.',
    installUrl: 'https://claude.ai/code',
    installCmd: 'npm install -g @anthropic-ai/claude-code',
    defaultModel: 'claude-sonnet-4-6',
    models: [],
    envKey: 'ANTHROPIC_API_KEY',
    envDesc: 'Only needed if you want to use an API key instead of the subscription login.',
  },
  {
    id: 'codex', label: 'Codex CLI', icon: '⚡',
    desc: 'OpenAI\'s CLI tool for agentic coding tasks. Uses your OpenAI subscription.',
    installUrl: 'https://github.com/openai/codex',
    installCmd: 'npm install -g @openai/codex',
    defaultModel: 'gpt-5.4',
    models: [],
    envKey: 'OPENAI_API_KEY',
    envDesc: 'Your OpenAI API key. Required for Codex CLI authentication.',
  },
  {
    id: 'llm', label: 'LLM CLI', icon: '🧠',
    desc: 'Simon Willison\'s multi-provider LLM CLI. Supports OpenAI, Anthropic, Gemini, local models.',
    installUrl: 'https://llm.datasette.io',
    installCmd: 'pip install llm',
    defaultModel: 'gpt-4o',
    models: [],
    envKey: '',
    envDesc: 'Configure keys with `llm keys set openai` etc.',
  },
  {
    id: 'aider', label: 'Aider', icon: '🤝',
    desc: 'AI pair programming in your terminal. Works with OpenAI, Anthropic, and local models.',
    installUrl: 'https://aider.chat',
    installCmd: 'pip install aider-chat',
    defaultModel: 'claude-sonnet-4-6',
    models: [],
    envKey: 'ANTHROPIC_API_KEY',
    envDesc: 'API key for the model you want to use with Aider.',
  },
]

const API_PROVIDERS = [
  {
    id: 'openai', label: 'OpenAI API', icon: '⚡',
    desc: 'Direct API access — billed per token.',
    apiKeyPlaceholder: 'sk-...',
    models: ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.2', 'o4-mini'],
    showOrgId: true,
  },
  {
    id: 'anthropic', label: 'Anthropic API', icon: '🔮',
    desc: 'Direct Claude API — billed per token.',
    apiKeyPlaceholder: 'sk-ant-...',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  },
  {
    id: 'google', label: 'Google Gemini API', icon: '🌐',
    desc: 'Gemini API — generous free tier.',
    apiKeyPlaceholder: 'AIza...',
    models: ['gemini-2.5-pro', 'gemini-2.0-flash'],
  },
  {
    id: 'ollama', label: 'Ollama (local)', icon: '🦙',
    desc: 'Run open-source models locally — completely free.',
    endpointPlaceholder: 'http://localhost:11434',
    models: [],
    isLocal: true,
  },
]

// ─── Component helpers ────────────────────────────────────────────────────────

function InstallBadge({ installed, version }: { installed: boolean; version?: string }) {
  if (installed) return (
    <Badge className="bg-green-500/15 text-green-400 border-green-500/20 gap-1">
      <CheckCircle className="h-3 w-3" /> {version ? `v${version}` : 'Installed'}
    </Badge>
  )
  return (
    <Badge className="bg-muted text-muted-foreground border-border gap-1">
      <XCircle className="h-3 w-3" /> Not installed
    </Badge>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<'cli' | 'api' | 'queue'>('cli')
  const [cliStatus, setCliStatus] = useState<CLIStatus[]>([])
  const [cliLoading, setCliLoading] = useState(true)
  const [configs, setConfigs] = useState<LLMConfig[]>([])
  const [platforms, setPlatforms] = useState<Record<string, { apiKey?: string; endpointUrl?: string; orgId?: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [expandedCLI, setExpandedCLI] = useState<string | null>(null)
  const [expandedAPI, setExpandedAPI] = useState<string | null>(null)
  const [cliApiKeys, setCliApiKeys] = useState<Record<string, string>>({})
  const [cliModels, setCliModels] = useState<Record<string, string>>({})
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [apiModels, setApiModels] = useState<Record<string, string>>({})
  const [apiEndpoints, setApiEndpoints] = useState<Record<string, string>>({})
  
  const [dynamicModels, setDynamicModels] = useState<Record<string, string[]>>({})
  const [fetchingModels, setFetchingModels] = useState<Record<string, boolean>>({})
  const [modelErrors, setModelErrors] = useState<Record<string, string>>({})
  const [logs, setLogs] = useState<{ time: string; level: 'info' | 'ok' | 'error'; msg: string }[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  function addLog(level: 'info' | 'ok' | 'error', msg: string) {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false })
    setLogs((p) => [...p.slice(-200), { time, level, msg }])
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }), 30)
  }

  async function fetchModels(type: 'api' | 'cli', id: string) {
    setFetchingModels((p) => ({ ...p, [id]: true }))
    setModelErrors((p) => ({ ...p, [id]: '' }))
    addLog('info', `Fetching models for ${type}:${id}…`)
    try {
      const res = await fetch(`/api/models?type=${type}&id=${id}`)
      const data = await res.json()
      if (data.models && data.models.length > 0) {
        setDynamicModels((p) => ({ ...p, [id]: data.models }))
        addLog('ok', `✓ ${data.models.length} models loaded for ${id}${data.fallback ? ' (curated fallback)' : ''}`)
        data.models.forEach((m: string) => addLog('info', `  · ${m}`))
      } else if (data.error) {
        setModelErrors((p) => ({ ...p, [id]: data.error }))
        addLog('error', `✗ ${data.error}`)
      } else {
        addLog('error', `No models returned for ${id}`)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Network error'
      setModelErrors((p) => ({ ...p, [id]: msg }))
      addLog('error', `✗ ${msg}`)
    } finally {
      setFetchingModels((p) => ({ ...p, [id]: false }))
    }
  }


  const loadStatus = useCallback(async () => {
    setCliLoading(true)
    const [statusRes, configRes] = await Promise.all([
      fetch('/api/cli/status').then((r) => r.json()),
      fetch('/api/llm').then((r) => r.json()),
    ])
    const statuses = statusRes as CLIStatus[]
    const cfgs     = configRes as LLMConfig[]
    setCliStatus(statuses)
    setConfigs(cfgs)
    setCliLoading(false)

    // Auto-activate any installed CLI that isn't configured yet
    const autoEnablePromises = statuses
      .filter((s) => s.installed && !cfgs.find((c) => c.provider_type === 'cli' && c.cli_command === s.id))
      .map((s) => {
        const tool = CLI_TOOLS.find((t) => t.id === s.id)
        if (!tool) return Promise.resolve()
        return fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: tool.label,
            modelId: tool.defaultModel,
            providerType: 'cli',
            cliCommand: tool.id,
            cliEnvVars: {},
          }),
        })
      })
    if (autoEnablePromises.length > 0) {
      await Promise.all(autoEnablePromises)
      // Reload configs to reflect newly created entries
      const updated = await fetch('/api/llm').then((r) => r.json())
      setConfigs(updated as LLMConfig[])
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  // Pre-fill CLI model pickers from existing configs
  useEffect(() => {
    const models: Record<string, string> = {}
    const keys: Record<string, string> = {}
    const aModels: Record<string, string> = {}
    const aKeys: Record<string, string> = {}
    const aEndpoints: Record<string, string> = {}
    for (const c of configs) {
      if (c.provider_type === 'cli' && c.cli_command) {
        models[c.cli_command] = c.model_id
        if (c.cli_env_vars) {
          try {
            const env = JSON.parse(c.cli_env_vars) as Record<string, string>
            const tool = CLI_TOOLS.find((t) => t.id === c.cli_command)
            if (tool?.envKey && env[tool.envKey]) keys[c.cli_command] = env[tool.envKey]
          } catch {}
        }
      }
      if (c.provider_type !== 'cli') {
        aModels[c.platform_id] = c.model_id
      }
    }
    setCliModels(models)
    setCliApiKeys(keys)
    setApiModels(aModels)
  }, [configs])

  const cliConfigFor = (toolId: string) =>
    configs.find((c) => c.provider_type === 'cli' && c.cli_command === toolId)

  const apiConfigFor = (platformId: string) =>
    configs.find((c) => c.provider_type !== 'cli' && c.platform_id === platformId)

  async function saveCLI(toolId: string) {
    const tool = CLI_TOOLS.find((t) => t.id === toolId)
    if (!tool) return
    setSaving(toolId)
    const existing = cliConfigFor(toolId)
    const envVars: Record<string, string> = {}
    if (tool.envKey && cliApiKeys[toolId]) envVars[tool.envKey] = cliApiKeys[toolId]

    try {
      if (existing) {
        await fetch(`/api/llm/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: cliModels[toolId] || tool.defaultModel,
            cliCommand: toolId,
            cliEnvVars: envVars,
            enabled: true,
          }),
        })
      } else {
        await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: tool.label,
            modelId: cliModels[toolId] || tool.defaultModel,
            providerType: 'cli',
            cliCommand: toolId,
            cliEnvVars: envVars,
          }),
        })
      }
      await loadStatus()
    } finally {
      setSaving(null)
    }
  }

  async function removeCLI(toolId: string) {
    const existing = cliConfigFor(toolId)
    if (!existing) return
    await fetch(`/api/llm/${existing.id}`, { method: 'DELETE' })
    await loadStatus()
  }

  async function saveAPI(providerId: string) {
    const provider = API_PROVIDERS.find((p) => p.id === providerId)
    if (!provider) return
    setSaving(providerId)
    const existing = apiConfigFor(providerId)

    try {
      // Upsert platform
      await fetch('/api/platforms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: providerId,
          label: provider.label,
          apiKey: apiKeys[providerId] || undefined,
          endpointUrl: provider.isLocal ? (apiEndpoints[providerId] || 'http://localhost:11434') : undefined,
          enabled: true,
        }),
      })

      if (existing) {
        await fetch(`/api/llm/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: apiModels[providerId] || provider.models[0],
            enabled: true,
          }),
        })
      } else {
        await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platformId: providerId,
            label: provider.label,
            modelId: apiModels[providerId] || provider.models[0],
            providerType: 'api',
          }),
        })
      }
      await loadStatus()
    } finally {
      setSaving(null)
    }
  }

  async function removeAPI(providerId: string) {
    const existing = apiConfigFor(providerId)
    if (!existing) return
    await fetch(`/api/llm/${existing.id}`, { method: 'DELETE' })
    await loadStatus()
  }

  async function toggleConfig(id: string, enabled: boolean) {
    await fetch(`/api/llm/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    await loadStatus()
  }

  return (
    <AppShell title="Settings">
      <div className="h-full flex flex-col">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border px-6 pt-4">
          {([
            ['cli',   <Terminal key="t" className="h-3.5 w-3.5" />, 'CLI Tools'],
            ['api',   <Key key="k" className="h-3.5 w-3.5" />,      'API Keys'],
            ['queue', <GripVertical key="g" className="h-3.5 w-3.5" />, 'Priority Queue'],
          ] as [typeof tab, React.ReactNode, string][]).map(([t, icon, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 pb-3 px-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 min-h-0">
          {/* Left: main content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 max-w-3xl">

          {/* ── CLI Tools tab ─────────────────────────────────────────────── */}
          {tab === 'cli' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-lg font-semibold">CLI Tools</h2>
                  <p className="text-sm text-muted-foreground">
                    Use subscription-based CLI tools instead of pay-per-token APIs. Recommended.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={loadStatus} disabled={cliLoading} className="gap-1.5">
                  <RefreshCw className={`h-3.5 w-3.5 ${cliLoading ? 'animate-spin' : ''}`} />
                  Check
                </Button>
              </div>

              {CLI_TOOLS.map((tool) => {
                const status = cliStatus.find((s) => s.id === tool.id)
                const config = cliConfigFor(tool.id)
                const isExpanded = expandedCLI === tool.id
                const isConfigured = !!config

                return (
                  <div key={tool.id} className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="text-xl shrink-0">{tool.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{tool.label}</span>
                          {cliLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          ) : (
                            <InstallBadge installed={status?.installed ?? false} version={status?.version} />
                          )}
                          {isConfigured && (
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{tool.desc}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* One-click enable when installed but not configured */}
                        {status?.installed && !isConfigured && (
                          <Button size="sm" className="h-7 text-xs gap-1.5"
                            disabled={saving === tool.id}
                            onClick={() => saveCLI(tool.id)}>
                            {saving === tool.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <CheckCircle className="h-3 w-3" />}
                            Enable
                          </Button>
                        )}
                        {isConfigured && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                            onClick={() => removeCLI(tool.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => setExpandedCLI(isExpanded ? null : tool.id)}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/10">
                        {!status?.installed && (
                          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-xs text-yellow-400">
                            <p className="font-medium mb-1">Not installed</p>
                            <p className="font-mono">{tool.installCmd}</p>
                            {tool.installUrl && (
                              <a href={tool.installUrl} target="_blank" rel="noreferrer"
                                className="underline mt-1 block opacity-70">
                                {tool.installUrl}
                              </a>
                            )}
                          </div>
                        )}

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-muted-foreground">Model</label>
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2"
                              disabled={fetchingModels[tool.id]}
                              onClick={() => fetchModels('cli', tool.id)}>
                              {fetchingModels[tool.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                              Fetch models
                            </Button>
                          </div>
                          <Input
                            className="h-7 text-xs mb-2 font-mono"
                            placeholder={`e.g. ${tool.defaultModel}`}
                            value={cliModels[tool.id] || ''}
                            onChange={(e) => setCliModels((p) => ({ ...p, [tool.id]: e.target.value }))}
                          />
                          {modelErrors[tool.id] && (
                            <p className="text-[10px] text-red-400 mb-2">{modelErrors[tool.id]}</p>
                          )}
                          {(dynamicModels[tool.id] || []).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {(dynamicModels[tool.id] || []).map((m) => (
                                <button key={m}
                                  onClick={() => setCliModels((p) => ({ ...p, [tool.id]: m }))}
                                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                                    cliModels[tool.id] === m
                                      ? 'border-primary bg-primary/20 text-primary'
                                      : 'border-border text-muted-foreground hover:border-primary/50'
                                  }`}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {tool.envKey && (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                              {tool.envKey} <span className="opacity-50">(optional)</span>
                            </label>
                            <ApiKeyInput
                              placeholder={`${tool.envKey}=...`}
                              value={cliApiKeys[tool.id] ?? ''}
                              onChange={(e) => setCliApiKeys((p) => ({ ...p, [tool.id]: e.target.value }))}
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">{tool.envDesc}</p>
                          </div>
                        )}

                        <Button size="sm" onClick={() => saveCLI(tool.id)}
                          disabled={saving === tool.id || (!status?.installed && !config)}
                          className="gap-1.5">
                          {saving === tool.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          {isConfigured ? 'Update' : 'Add to queue'}
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── API Keys tab ────────────────────────────────────────────────── */}
          {tab === 'api' && (
            <div className="space-y-4">
              <div className="mb-2">
                <h2 className="text-lg font-semibold">Direct API Access</h2>
                <p className="text-sm text-muted-foreground">
                  API keys for direct LLM access. Billed per token — use as fallback or if you don't use CLIs.
                </p>
              </div>

              {API_PROVIDERS.map((provider) => {
                const config = apiConfigFor(provider.id)
                const isExpanded = expandedAPI === provider.id
                const isConfigured = !!config

                function toggleExpand() {
                  const next = isExpanded ? null : provider.id
                  setExpandedAPI(next)
                  // Auto-fetch for Ollama since it needs no API key
                  if (next && provider.isLocal && !dynamicModels[provider.id]) {
                    fetchModels('api', provider.id)
                  }
                }

                return (
                  <div key={provider.id} className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="text-xl shrink-0">{provider.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{provider.label}</span>
                          {isConfigured && (
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{provider.desc}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isConfigured && (
                          <button
                            onClick={() => toggleConfig(config.id, !config.enabled)}
                            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                              config.enabled
                                ? 'border-green-500/30 text-green-400 bg-green-500/10'
                                : 'border-border text-muted-foreground'
                            }`}
                          >
                            {config.enabled ? 'On' : 'Off'}
                          </button>
                        )}
                        {isConfigured && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                            onClick={() => removeAPI(provider.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={toggleExpand}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/10">
                        {provider.isLocal ? (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Endpoint URL</label>
                            <Input
                              placeholder={provider.endpointPlaceholder}
                              value={apiEndpoints[provider.id] ?? ''}
                              onChange={(e) => setApiEndpoints((p) => ({ ...p, [provider.id]: e.target.value }))}
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">API Key</label>
                            <ApiKeyInput
                              placeholder={provider.apiKeyPlaceholder ?? 'sk-...'}
                              value={apiKeys[provider.id] ?? ''}
                              onChange={(e) => setApiKeys((p) => ({ ...p, [provider.id]: e.target.value }))}
                            />
                          </div>
                        )}

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-muted-foreground">Model</label>
                            {!provider.isLocal && (
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2"
                                disabled={fetchingModels[provider.id]}
                                onClick={() => fetchModels('api', provider.id)}>
                                {fetchingModels[provider.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                Fetch models
                              </Button>
                            )}
                          </div>
                          <Input
                            className="h-7 text-xs mb-2 font-mono"
                            placeholder={`e.g. ${provider.models[0]}`}
                            value={apiModels[provider.id] || ''}
                            onChange={(e) => setApiModels((p) => ({ ...p, [provider.id]: e.target.value }))}
                          />
                          {modelErrors[provider.id] && (
                            <p className="text-[10px] text-red-400 mb-2">{modelErrors[provider.id]}</p>
                          )}
                          {(dynamicModels[provider.id] || provider.models).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {(dynamicModels[provider.id] || provider.models).map((m) => (
                                <button key={m}
                                  onClick={() => setApiModels((p) => ({ ...p, [provider.id]: m }))}
                                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                                    apiModels[provider.id] === m
                                      ? 'border-primary bg-primary/20 text-primary'
                                      : 'border-border text-muted-foreground hover:border-primary/50'
                                  }`}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <Button size="sm" onClick={() => saveAPI(provider.id)}
                          disabled={saving === provider.id}
                          className="gap-1.5">
                          {saving === provider.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          {isConfigured ? 'Update' : 'Save & activate'}
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Priority Queue tab ──────────────────────────────────────────── */}
          {tab === 'queue' && (
            <div className="space-y-4">
              <div className="mb-2">
                <h2 className="text-lg font-semibold">Priority Queue</h2>
                <p className="text-sm text-muted-foreground">
                  Agents try these in order. If one fails (rate limit, auth error) the next is used automatically.
                </p>
              </div>

              {configs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No AI connections configured yet. Add a CLI tool or API key above.
                </div>
              ) : (
                <div className="space-y-2">
                  {configs
                    .sort((a, b) => a.priority - b.priority)
                    .map((c, i) => (
                      <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-xs font-bold shrink-0">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{c.label}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                              {c.provider_type === 'cli' ? `CLI · ${c.cli_command}` : c.platform_id}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{c.model_id}</p>
                        </div>
                        <button
                          onClick={() => toggleConfig(c.id, !c.enabled)}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors shrink-0 ${
                            c.enabled
                              ? 'border-green-500/30 text-green-400 bg-green-500/10'
                              : 'border-border text-muted-foreground'
                          }`}
                        >
                          {c.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400 shrink-0"
                          onClick={async () => {
                            await fetch(`/api/llm/${c.id}`, { method: 'DELETE' })
                            await loadStatus()
                          }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
          </div>{/* end left column */}

          {/* Right: fetch log terminal */}
          <div className="w-72 shrink-0 border-l border-border flex flex-col bg-[#0d1117]">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
              <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                <Terminal className="h-3.5 w-3.5" />
                model fetch log
              </div>
              <button onClick={() => setLogs([])} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">clear</button>
            </div>
            <div ref={logRef} className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-0.5">
              {logs.length === 0 ? (
                <p className="text-muted-foreground/40 italic">Click &quot;Fetch models&quot; on any CLI or API provider…</p>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className="flex gap-2 leading-5">
                    <span className="text-muted-foreground/40 shrink-0">{l.time}</span>
                    <span className={l.level === 'ok' ? 'text-green-400' : l.level === 'error' ? 'text-red-400' : 'text-muted-foreground'}>
                      {l.msg}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>{/* end two-column */}
      </div>
    </AppShell>
  )
}
