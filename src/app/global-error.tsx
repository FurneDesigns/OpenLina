'use client'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html>
      <body style={{ background: '#09090b', color: '#fafafa', fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', margin: 0, flexDirection: 'column', gap: '1rem' }}>
        <p style={{ color: '#f87171', fontSize: '0.75rem' }}>{error.message}</p>
        <button onClick={reset} style={{ border: '1px solid #27272a', background: 'transparent', color: '#fafafa', padding: '0.25rem 0.75rem', borderRadius: '0.375rem', cursor: 'pointer' }}>
          Retry
        </button>
      </body>
    </html>
  )
}
