import './globals.css'
import { AppShell } from '@/components/layout/AppShell'

export const metadata = {
  title: 'OpenLina',
  description: 'Local-first GUI to orchestrate AI dev agents.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
