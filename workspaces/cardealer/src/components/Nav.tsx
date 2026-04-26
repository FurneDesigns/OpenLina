import Link from 'next/link'
import type { SiteConfig } from '@/types/car'

interface NavProps {
  config: SiteConfig
}

export function Nav({ config }: NavProps) {
  return (
    <header className="bg-slate-900 text-white sticky top-0 z-50 shadow-lg">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="font-bold text-xl tracking-tight hover:text-blue-400 transition-colors"
        >
          {config.businessName}
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link
            href="/#listings"
            className="text-slate-300 hover:text-white transition-colors hidden sm:block"
          >
            Cars
          </Link>
          <Link
            href="/#contact"
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full transition-colors"
          >
            Contact
          </Link>
        </div>
      </nav>
    </header>
  )
}
