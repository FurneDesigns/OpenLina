'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FolderKanban, Activity, Settings, Plus, BarChart3 } from 'lucide-react'

const ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects/new', label: 'New project', icon: Plus },
  { href: '/runs', label: 'Runs', icon: Activity },
  { href: '/metrics', label: 'Metrics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-surface">
      <div className="px-4 py-4 border-b border-border">
        <Link href="/" className="block">
          <Image
            src="/logo-openlina-full.png"
            alt="OpenLina"
            width={400}
            height={100}
            priority
            sizes="100vw"
            style={{ width: '100%', height: 'auto' }}
          />
        </Link>
      </div>
      <nav className="p-2 flex flex-col gap-1">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${active ? 'bg-accent/10 text-accent' : 'text-text hover:bg-surfaceAlt'}`}>
              <Icon className="size-4" />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="px-4 py-3 mt-2 border-t border-border text-xs text-muted">
        <FolderKanban className="size-3 inline mr-1" /> Projects in sidebar via /
      </div>
    </aside>
  )
}
