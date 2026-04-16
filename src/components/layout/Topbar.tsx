'use client'
import { useLLMStore } from '@/store/useLLMStore'
import { useLLMFailover } from '@/hooks/useLLMFailover'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Cpu } from 'lucide-react'

export function Topbar({ title }: { title: string }) {
  useLLMFailover()
  const { isFailoverActive, failoverReason, currentLlmId } = useLLMStore()

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-card px-4">
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-2">
        {isFailoverActive && (
          <Badge variant="warning" className="flex items-center gap-1 animate-pulse">
            <AlertTriangle className="h-3 w-3" />
            Failover: {currentLlmId}
          </Badge>
        )}
        {currentLlmId && !isFailoverActive && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Cpu className="h-3 w-3" />
            {currentLlmId}
          </Badge>
        )}
      </div>
    </header>
  )
}
