'use client'
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-8">
      <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
      <pre className="text-xs text-muted whitespace-pre-wrap">{error.message}</pre>
      <button onClick={reset} className="mt-4 px-3 py-1.5 rounded bg-accent text-white text-sm">Retry</button>
    </div>
  )
}
