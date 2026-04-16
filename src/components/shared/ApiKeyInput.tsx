'use client'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ApiKeyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

export function ApiKeyInput({ className, ...props }: ApiKeyInputProps) {
  const [show, setShow] = useState(false)
  return (
    <div className={cn('relative flex items-center', className)}>
      <Input
        {...props}
        type={show ? 'text' : 'password'}
        className="pr-10 font-mono text-xs"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-0 h-full px-3 text-muted-foreground hover:text-foreground"
        onClick={() => setShow((v) => !v)}
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  )
}
