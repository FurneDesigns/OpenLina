import type { HTMLAttributes } from 'react'

const variants = {
  sold:      'bg-sold-bg text-sold-text',
  available: 'bg-available-bg text-available-text',
  new:       'bg-brand-100 text-brand-700',
  tag:       'bg-slate-100 text-slate-600',
  warning:   'bg-warning-bg text-warning-text',
  info:      'bg-info-bg text-info-text',
  success:   'bg-success-bg text-success-text',
  danger:    'bg-error-bg text-error-text',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants
}

export function Badge({ variant = 'tag', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full tracking-wider uppercase ${variants[variant]} ${className}`}
      {...props}
    />
  )
}
