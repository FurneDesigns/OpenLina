'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { WizardShell } from '@/components/wizard/WizardShell'
import { StepWelcome } from '@/components/wizard/platform/StepWelcome'
import { Badge } from '@/components/ui/badge'
import { ApiKeyInput } from '@/components/shared/ApiKeyInput'
import { CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = ['Welcome', 'CLI Tools', 'API Keys (optional)', 'Done']

const CLI_TOOLS = [
  {
    id: 'claude', label: 'Claude Code', icon: '🔮',
    desc: 'Uses your Anthropic Pro/Max subscription. Recommended for Claude models.',
    installCmd: 'npm install -g @anthropic-ai/claude-code',
    defaultModel: 'claude-sonnet-4-6',
    envKey: 'ANTHROPIC_API_KEY',
    envKeyLabel: 'API Key (optional)',
  },
  {
    id: 'codex', label: 'Codex CLI', icon: '⚡',
    desc: 'OpenAI\'s agentic coding CLI. Uses your OpenAI subscription.',
    installCmd: 'npm install -g @openai/codex',
    defaultModel: 'gpt-5.4',
    envKey: 'OPENAI_API_KEY',
    envKeyLabel: 'OpenAI API Key',
  },
  {
    id: 'opencode', label: 'OpenCode', icon: '💻',
    desc: 'Anomaly\'s open-source coding agent. Highly customizable.',
    installCmd: 'npm install -g opencode-ai',
    defaultModel: 'claude-3-5-sonnet-20241022',
    envKey: 'ANTHROPIC_API_KEY',
    envKeyLabel: 'API Key (optional)',
  },
  {
    id: 'openclaw', label: 'OpenClaw', icon: '🦞',
    desc: 'Anomaly\'s personal AI with 100+ skills. Built for agentic tasks.',
    installCmd: 'npm install -g openclaw-ai',
    defaultModel: 'claude-3-5-sonnet-20241022',
    envKey: 'ANTHROPIC_API_KEY',
    envKeyLabel: 'API Key (optional)',
  },
  {
    id: 'llm', label: 'LLM CLI', icon: '🧠',
    desc: 'Multi-provider CLI by Simon Willison. Supports many models.',
    installCmd: 'pip install llm',
    defaultModel: 'gpt-4o',
    envKey: '',
    envKeyLabel: '',
  },
  {
    id: 'ollama', label: 'Ollama (local)', icon: '🦙',
    desc: 'Run open-source models locally — completely free.',
    installCmd: 'curl -fsSL https://ollama.com/install.sh | sh',
    defaultModel: 'llama3.2',
    envKey: '',
    envKeyLabel: '',
  },
]

const API_PROVIDERS = [
  {
    id: 'openai', label: 'OpenAI API', icon: '⚡',
    placeholder: 'sk-...', defaultModel: 'gpt-5.4',
    models: ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.2', 'o4-mini'],
    note: 'Pay-per-token, no subscription needed',
  },
  {
    id: 'anthropic', label: 'Anthropic API', icon: '🔮',
    placeholder: 'sk-ant-...', defaultModel: 'claude-sonnet-4-6',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
    note: 'Pay-per-token direct API access',
  },
  {
    id: 'google', label: 'Google Gemini', icon: '🌐',
    placeholder: 'AIza...', defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.5-pro', 'gemini-2.0-flash'],
    note: 'Generous free tier available',
  },
]

interface CLIStatus { id: string; installed: boolean; version?: string }

export default function PlatformWizardPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // CLI state
  const [cliStatus, setCliStatus] = useState<CLIStatus[]>([])
  const [cliLoading, setCliLoading] = useState(false)
  const [selectedCLIs, setSelectedCLIs] = useState<Set<string>>(new Set())
  const [cliModels, setCliModels] = useState<Record<string, string>>({})
  const [cliKeys, setCliKeys] = useState<Record<string, string>>({})

  // API state
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [apiModels, setApiModels] = useState<Record<string, string>>({})
  const [apiEndpoints, setApiEndpoints] = useState<Record<string, string>>({ ollama: 'http://localhost:11434' })

  const [dynamicModels, setDynamicModels] = useState<Record<string, string[]>>({})
  const [fetchingModels, setFetchingModels] = useState<Record<string, boolean>>({})

  async function fetchModels(type: 'api' | 'cli', id: string) {
    setFetchingModels((p) => ({ ...p, [id]: true }))
    try {
      const res = await fetch(`/api/models?type=${type}&id=${id}`)
      const data = await res.json()
      if (data.models && data.models.length > 0) {
        setDynamicModels((p) => ({ ...p, [id]: data.models }))
      }
    } catch {}
    finally {
      setFetchingModels((p) => ({ ...p, [id]: false }))
    }
  }

  async function checkCLIs() {
    setCliLoading(true)
    const data = await fetch('/api/cli/status').then((r) => r.json()) as CLIStatus[]
    setCliStatus(data)
    // Auto-select installed CLIs
    const installed = new Set(data.filter((d) => d.installed).map((d) => d.id))
    setSelectedCLIs(installed)
    setCliLoading(false)
  }

  useEffect(() => {
    if (step === 1) checkCLIs()
  }, [step])

  async function save() {
    setSaving(true)
    try {
      let priority = 1

      // Save CLI tools
      for (const toolId of Array.from(selectedCLIs)) {
        const tool = CLI_TOOLS.find((t) => t.id === toolId)
        if (!tool) continue
        const envVars: Record<string, string> = {}
        if (tool.envKey && cliKeys[toolId]) envVars[tool.envKey] = cliKeys[toolId]
        await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: tool.label,
            modelId: cliModels[toolId] || tool.defaultModel,
            providerType: 'cli',
            cliCommand: toolId,
            cliEnvVars: Object.keys(envVars).length > 0 ? envVars : undefined,
            priority: priority++,
          }),
        })
      }

      // Save API providers
      for (const p of API_PROVIDERS) {
        const key = apiKeys[p.id]
        const endpoint = apiEndpoints[p.id]
        if (!key && !p.isEndpoint) continue
        if (p.isEndpoint && !endpoint) continue

        await fetch('/api/platforms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: p.id, label: p.label, enabled: true,
            apiKey: key || undefined,
            endpointUrl: p.isEndpoint ? endpoint : undefined,
          }),
        })
        await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platformId: p.id, label: p.label,
            modelId: apiModels[p.id] || p.defaultModel,
            providerType: 'api',
            priority: priority++,
          }),
        })
      }

      router.push('/')
    } finally {
      setSaving(false)
    }
  }

  const canSaveCLI = selectedCLIs.size > 0
  const canNext: Record<number, boolean> = {
    0: true,
    1: true, // can skip CLI if nothing installed
    2: true,
    3: true,
  }

  return (
    <WizardShell
      steps={STEPS}
      currentStep={step}
      onBack={step > 0 ? () => setStep((s) => s - 1) : undefined}
      onNext={step === STEPS.length - 1 ? save : () => setStep((s) => s + 1)}
      nextLabel={step === STEPS.length - 1 ? (saving ? 'Saving...' : 'Save & start') : 'Continue'}
      isLoading={saving}
    >
      {/* Step 0 — Welcome */}
      {step === 0 && <StepWelcome />}

      {/* Step 1 — CLI Tools */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold">Connect your AI CLIs</h2>
            <p className="text-muted-foreground mt-1">
              CLI tools use your subscription account — no per-token billing. This is the recommended way to use OpenLina.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={checkCLIs} disabled={cliLoading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${cliLoading ? 'animate-spin' : ''}`} />
              {cliLoading ? 'Checking...' : 'Check installations'}
            </button>
          </div>

          <div className="space-y-3">
            {CLI_TOOLS.map((tool) => {
              const status = cliStatus.find((s) => s.id === tool.id)
              const isSelected = selectedCLIs.has(tool.id)
              return (
                <div key={tool.id}
                  className={cn('rounded-xl border-2 p-4 transition-all', isSelected ? 'border-primary bg-primary/5' : 'border-border')}
                >
                  <div className="flex items-start gap-3 cursor-pointer"
                    onClick={() => setSelectedCLIs((prev) => {
                      const n = new Set(prev)
                      n.has(tool.id) ? n.delete(tool.id) : n.add(tool.id)
                      return n
                    })}>
                    <span className="text-2xl mt-0.5">{tool.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{tool.label}</span>
                        {cliLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : status ? (
                          status.installed ? (
                            <Badge className="bg-green-500/15 text-green-400 border-green-500/20 text-[10px] gap-1">
                              <CheckCircle className="h-3 w-3" /> {status.version ? `v${status.version}` : 'Installed'}
                            </Badge>
                          ) : (
                            <Badge className="bg-muted text-muted-foreground border-border text-[10px] gap-1">
                              <XCircle className="h-3 w-3" /> Not installed
                            </Badge>
                          )
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{tool.desc}</p>
                      {status && !status.installed && (
                        <p className="text-xs font-mono text-yellow-400/80 mt-1 bg-yellow-500/5 rounded px-2 py-1 inline-block">
                          {tool.installCmd}
                        </p>
                      )}
                    </div>
                    <div className={cn('h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5',
                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30')}>
                      {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-4 pt-4 border-t border-border space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-medium text-muted-foreground">Model</label>
                          <button onClick={() => fetchModels('cli', tool.id)} disabled={fetchingModels[tool.id]}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                            {fetchingModels[tool.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                            Fetch models
                          </button>
                        </div>
                        <input
                          className="w-full h-8 rounded-md border border-border bg-background px-3 text-xs font-mono outline-none focus:border-primary/50 mb-2"
                          placeholder={`e.g. ${tool.defaultModel}`}
                          value={cliModels[tool.id] || ''}
                          onChange={(e) => setCliModels((p) => ({ ...p, [tool.id]: e.target.value }))}
                        />
                        {(dynamicModels[tool.id] || []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {(dynamicModels[tool.id] || []).map((m) => (
                              <button key={m}
                                onClick={() => setCliModels((p) => ({ ...p, [tool.id]: m }))}
                                className={cn('rounded-md border px-2.5 py-1 text-xs transition-colors',
                                  cliModels[tool.id] === m
                                    ? 'border-primary bg-primary/20 text-primary'
                                    : 'border-border text-muted-foreground hover:border-primary/50')}>
                                {m}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {tool.envKey && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                            {tool.envKeyLabel} <span className="opacity-50">(optional)</span>
                          </label>
                          <ApiKeyInput
                            placeholder={`${tool.envKey}=sk-...`}
                            value={cliKeys[tool.id] ?? ''}
                            onChange={(e) => setCliKeys((p) => ({ ...p, [tool.id]: e.target.value }))}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {!canSaveCLI && cliStatus.length > 0 && (
            <p className="text-sm text-muted-foreground">
              No CLI tools selected — you can still use direct API keys on the next step.
            </p>
          )}
        </div>
      )}

      {/* Step 2 — API Keys */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold">API Keys <span className="text-muted-foreground font-normal text-lg">(optional)</span></h2>
            <p className="text-muted-foreground mt-1">
              Add direct API keys for fallback or if you prefer pay-per-token access. Skip this step if you're using CLIs.
            </p>
          </div>
          <div className="space-y-4">
            {API_PROVIDERS.map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{p.icon}</span>
                  <div>
                    <p className="font-medium text-sm">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.note}</p>
                  </div>
                </div>
                {p.isEndpoint ? (
                  <input
                    className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/50"
                    placeholder={p.placeholder}
                    value={apiEndpoints[p.id] ?? ''}
                    onChange={(e) => setApiEndpoints((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                ) : (
                  <ApiKeyInput
                    placeholder={p.placeholder}
                    value={apiKeys[p.id] ?? ''}
                    onChange={(e) => setApiKeys((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                )}
                {(apiKeys[p.id] || (p.isEndpoint && apiEndpoints[p.id])) && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Model</span>
                      {!p.isEndpoint && (
                        <button onClick={() => fetchModels('api', p.id)} disabled={fetchingModels[p.id]}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                          {fetchingModels[p.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          Fetch models
                        </button>
                      )}
                    </div>
                    <input
                      className="w-full h-8 rounded-md border border-border bg-background px-3 text-xs font-mono outline-none focus:border-primary/50 mb-2"
                      placeholder={`e.g. ${p.defaultModel}`}
                      value={apiModels[p.id] || ''}
                      onChange={(e) => setApiModels((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    />
                    {(dynamicModels[p.id] || p.models).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(dynamicModels[p.id] || p.models).map((m) => (
                          <button key={m}
                            onClick={() => setApiModels((prev) => ({ ...prev, [p.id]: m }))}
                            className={cn('rounded-md border px-2.5 py-1 text-xs transition-colors',
                              apiModels[p.id] === m
                                ? 'border-primary bg-primary/20 text-primary'
                                : 'border-border text-muted-foreground hover:border-primary/50')}>
                            {m}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3 — Done */}
      {step === 3 && (
        <div className="space-y-5 text-center">
          <div className="text-5xl mb-2">🎉</div>
          <h2 className="text-2xl font-bold">All set!</h2>
          <p className="text-muted-foreground">
            Your AI connections are configured.
            {selectedCLIs.size > 0 && (
              <> <strong>{selectedCLIs.size} CLI tool{selectedCLIs.size > 1 ? 's' : ''}</strong> will be used as primary AI backend.</>
            )}
          </p>
          <div className="text-sm text-muted-foreground">
            You can change these anytime in <strong>Settings → CLI Tools</strong> or <strong>Settings → API Keys</strong>.
          </div>
        </div>
      )}
    </WizardShell>
  )
}
