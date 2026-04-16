'use client'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title={title} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
