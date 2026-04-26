import { ReactNode } from 'react'

type Variant = 'neutral' | 'success' | 'warn' | 'danger' | 'accent'

const VARIANT: Record<Variant, string> = {
  neutral: 'bg-surfaceAlt text-muted border-border',
  success: 'bg-success/10 text-success border-success/40',
  warn: 'bg-warn/10 text-warn border-warn/40',
  danger: 'bg-danger/10 text-danger border-danger/40',
  accent: 'bg-accent/10 text-accent border-accent/40',
}

export function Badge({ variant = 'neutral', children }: { variant?: Variant; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${VARIANT[variant]}`}>
      {children}
    </span>
  )
}
