'use client'
import { CheckCircle2 } from 'lucide-react'
import { useWizardStore } from '@/store/useWizardStore'

const PLATFORM_LABELS: Record<string, string> = {
  openai: 'OpenAI / Codex',
  anthropic: 'Claude / Anthropic',
  google: 'Google Gemini',
  ollama: 'Ollama (local)',
  custom: 'Custom endpoint',
}

export function StepComplete() {
  const { platformData } = useWizardStore()

  const configured = Object.entries(platformData)
    .filter(([, v]) => v && (v.apiKey || v.endpointUrl))
    .map(([k]) => k)

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600/20">
          <CheckCircle2 className="h-8 w-8 text-green-400" />
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-bold">Platforms configured!</h2>
        <p className="mt-2 text-muted-foreground">
          {configured.length} platform{configured.length !== 1 ? 's' : ''} ready to use.
        </p>
      </div>
      <div className="space-y-2 text-left">
        {configured.map((k) => (
          <div key={k} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span className="text-sm">{PLATFORM_LABELS[k] ?? k}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
