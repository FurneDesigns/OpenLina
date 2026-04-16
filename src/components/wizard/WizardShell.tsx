'use client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface WizardShellProps {
  steps: string[]
  currentStep: number
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  isLoading?: boolean
  children: React.ReactNode
}

export function WizardShell({
  steps,
  currentStep,
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextDisabled,
  isLoading,
  children,
}: WizardShellProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="w-full max-w-2xl">
        {/* Step indicator */}
        <div className="mb-8 flex items-center gap-2">
          {steps.map((label, i) => (
            <div key={i} className="flex flex-1 items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                    i < currentStep
                      ? 'bg-primary text-white'
                      : i === currentStep
                        ? 'bg-primary/20 text-primary ring-2 ring-primary'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {i < currentStep ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className="hidden text-[10px] text-muted-foreground sm:block">{label}</span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 transition-colors',
                    i < currentStep ? 'bg-primary' : 'bg-muted',
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="rounded-xl border border-border bg-card p-8 shadow-lg animate-fade-in">
          {children}
        </div>

        {/* Navigation */}
        <div className="mt-4 flex justify-between">
          <Button variant="ghost" onClick={onBack} disabled={!onBack}>
            Back
          </Button>
          <Button onClick={onNext} disabled={nextDisabled || isLoading}>
            {isLoading ? 'Loading...' : nextLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
