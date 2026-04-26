import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ className = '', error = false, ...props }: InputProps) {
  return (
    <input
      className={`w-full border rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors disabled:bg-slate-50 disabled:text-slate-400 ${
        error
          ? 'border-error-border focus:ring-error-text focus:border-error-border'
          : 'border-slate-200 focus:ring-brand-500 focus:border-brand-500'
      } ${className}`}
      aria-invalid={error || undefined}
      {...props}
    />
  )
}
