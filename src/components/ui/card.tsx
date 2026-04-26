import { HTMLAttributes, forwardRef } from 'react'

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Card(
  { className, ...rest }, ref,
) {
  return <div ref={ref} className={`rounded-lg border border-border bg-surface ${className || ''}`} {...rest} />
})

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-4 py-3 border-b border-border ${className || ''}`} {...rest} />
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-4 ${className || ''}`} {...rest} />
}
