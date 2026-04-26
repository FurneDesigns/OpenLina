import type { Metadata } from 'next'
import './globals.css'
import { Nav } from '@/components/Nav'
import { getConfig } from '@/lib/cars'

export function generateMetadata(): Metadata {
  const config = getConfig()
  return {
    title: {
      default: config.businessName,
      template: `%s — ${config.businessName}`,
    },
    description: config.tagline,
  }
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const config = getConfig()

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-gray-50 text-slate-900 antialiased">
        <Nav config={config} />
        <main className="flex-1">{children}</main>
        <footer className="bg-slate-900 text-slate-400 py-8 text-center text-sm">
          <p>
            &copy; {new Date().getFullYear()} {config.businessName} &middot;{' '}
            {config.location}
          </p>
          <p className="mt-1">
            <a
              href={`tel:${config.phone}`}
              className="hover:text-white transition-colors"
            >
              {config.phone}
            </a>
          </p>
        </footer>
      </body>
    </html>
  )
}
