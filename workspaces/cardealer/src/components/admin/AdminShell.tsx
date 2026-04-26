import type { ReactNode } from 'react'
import Link from 'next/link'

interface AdminShellProps {
  children: ReactNode
  title?: string
  actions?: ReactNode
}

export function AdminShell({ children, title, actions }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-surface-light">
      <header className="bg-surface-darker sticky top-0 z-40" style={{ boxShadow: 'var(--shadow-panel)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/admin"
              className="text-white font-bold text-sm hover:text-brand-300 transition-colors shrink-0"
            >
              Admin
            </Link>
            {title && (
              <>
                <span className="text-slate-600 text-sm" aria-hidden>/</span>
                <span className="text-slate-300 text-sm truncate">{title}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              ← View site
            </Link>
            <form action="/api/admin/logout" method="POST">
              <button
                type="submit"
                className="text-xs text-slate-400 hover:text-red-400 transition-colors"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {actions && (
          <div className="flex items-center justify-end mb-6">
            {actions}
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
