import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OpenLina — AI Dev Workspace',
  description: 'Local GUI for Codex, Claude Code, and more',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  )
}
