'use client'
import { Zap, Shield, Cpu, RefreshCcw } from 'lucide-react'

export function StepWelcome() {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20">
          <Zap className="h-8 w-8 text-primary" />
        </div>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-foreground">Welcome to OpenLina</h2>
        <p className="mt-2 text-muted-foreground">
          Connect your AI platforms to get started. All credentials are stored locally and encrypted.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
        {[
          { icon: Shield, title: 'Local & secure', desc: 'AES-256 encrypted, never leaves your machine' },
          { icon: RefreshCcw, title: 'Auto failover', desc: 'Switches LLMs when one runs out of tokens' },
          { icon: Cpu, title: 'Multi-agent', desc: 'Build and connect agents visually' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-lg border border-border bg-muted/30 p-4">
            <Icon className="mb-2 h-5 w-5 text-primary" />
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
