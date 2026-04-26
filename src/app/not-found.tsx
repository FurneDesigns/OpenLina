import Link from 'next/link'
export default function NotFound() {
  return (
    <div className="p-8">
      <h2 className="text-lg font-semibold mb-2">Not found</h2>
      <Link href="/" className="text-accent text-sm">Back to dashboard</Link>
    </div>
  )
}
