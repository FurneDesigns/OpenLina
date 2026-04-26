import type { ReactNode } from 'react'

interface FormSectionProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function FormSection({ title, description, children, className = '' }: FormSectionProps) {
  return (
    <section
      className={`bg-white border border-border rounded-2xl overflow-hidden ${className}`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="px-6 py-4 border-b border-border bg-surface-muted/40">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <div className="px-6 py-5 flex flex-col gap-4">
        {children}
      </div>
    </section>
  )
}
