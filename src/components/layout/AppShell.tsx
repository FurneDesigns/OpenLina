'use client'
import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Toaster } from '../shared/Toaster'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <Toaster />
    </div>
  )
}
