import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={`h-9 w-full rounded-md border border-border bg-surfaceAlt px-3 text-sm text-text outline-none focus:border-accent ${className || ''}`}
        {...rest}
      />
    )
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={`min-h-[80px] w-full rounded-md border border-border bg-surfaceAlt px-3 py-2 text-sm text-text outline-none focus:border-accent ${className || ''}`}
        {...rest}
      />
    )
  },
)

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="text-xs font-medium uppercase tracking-wide text-muted mb-1 block">{children}</label>
}
