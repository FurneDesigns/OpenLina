'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Settings,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { href: '/',         icon: LayoutDashboard, label: 'Projects' },
  { href: '/settings', icon: Settings,        label: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-16 flex-col items-center border-r border-border bg-card py-4">
      {/* Logo */}
      <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
        <Zap className="h-5 w-5 text-white" />
      </div>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {links.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                active
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
