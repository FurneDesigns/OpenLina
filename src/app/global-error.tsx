'use client'
export default function GlobalError({ error }: { error: Error }) {
  return (
    <html><body>
      <div style={{ padding: 32, fontFamily: 'system-ui' }}>
        <h2>OpenLina crashed</h2>
        <pre>{error.message}</pre>
      </div>
    </body></html>
  )
}
