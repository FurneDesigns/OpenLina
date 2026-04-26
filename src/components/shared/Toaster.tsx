'use client'
import { useToastStore } from '@/store/useToastStore'

const VARIANT_COLORS: Record<string, string> = {
  info: 'bg-surfaceAlt border-border',
  success: 'bg-success/10 border-success/40',
  warn: 'bg-warn/10 border-warn/40',
  danger: 'bg-danger/10 border-danger/40',
}

export function Toaster() {
  const { toasts, dismiss } = useToastStore()
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-96 pointer-events-none">
      {toasts.map((t) => (
        <button key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto rounded-md border px-3 py-2 text-sm text-left shadow-lg ${VARIANT_COLORS[t.variant] || VARIANT_COLORS.info}`}>
          {t.message}
        </button>
      ))}
    </div>
  )
}
