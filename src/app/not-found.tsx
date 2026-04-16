import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
      <p className="text-4xl font-bold text-muted-foreground/20">404</p>
      <p className="text-sm text-muted-foreground">Page not found.</p>
      <Link href="/" className="text-xs text-primary hover:underline">Go home</Link>
    </div>
  )
}
