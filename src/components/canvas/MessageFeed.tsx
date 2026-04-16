'use client'
import { useAgentStore } from '@/store/useAgentStore'
import { cn } from '@/lib/utils'
import { Bot, User } from 'lucide-react'

export function MessageFeed() {
  const { messages } = useAgentStore()

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        Agent messages will appear here
      </div>
    )
  }

  return (
    <div className="flex flex-col-reverse gap-2 overflow-y-auto p-3 h-full">
      {messages.map((msg) => (
        <div key={msg.id} className="flex items-start gap-2">
          <div className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs',
            msg.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
          )}>
            {msg.role === 'user' ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              {msg.fromAgentId && (
                <span className="text-[10px] font-medium text-primary truncate">{msg.fromAgentId.slice(0, 8)}</span>
              )}
              {msg.toAgentId && (
                <span className="text-[10px] text-muted-foreground">→ {msg.toAgentId.slice(0, 8)}</span>
              )}
              <span className="text-[10px] text-muted-foreground/50 ml-auto shrink-0">
                {new Date(msg.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed break-words whitespace-pre-wrap">
              {msg.content.slice(0, 300)}{msg.content.length > 300 ? '…' : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
