import type { ButtonHTMLAttributes } from 'react'

const variants = {
  primary:   'bg-brand-600 hover:bg-brand-700 text-white',
  secondary: 'border-2 border-slate-200 hover:border-slate-300 bg-white text-slate-700',
  ghost:     'hover:bg-slate-100 text-slate-700',
  danger:    'bg-red-600 hover:bg-red-700 text-white',
}

const sizes = {
  sm:  'px-3 py-1.5 text-xs rounded-lg',
  md:  'px-5 py-2.5 text-sm rounded-xl',
  lg:  'px-8 py-4 text-base rounded-xl',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-colors focus-ring disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
}
