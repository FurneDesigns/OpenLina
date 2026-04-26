import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean
}

export function Card({ padding = true, className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-card rounded-2xl border border-slate-100 shadow-sm ${padding ? 'p-6' : ''} ${className}`}
      {...props}
    />
  )
}
