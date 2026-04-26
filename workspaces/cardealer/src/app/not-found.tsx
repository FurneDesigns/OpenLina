import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <p className="text-8xl font-extrabold text-slate-200 select-none">404</p>
      <h1 className="text-2xl font-bold text-slate-800 mt-2 mb-3">Page Not Found</h1>
      <p className="text-slate-500 max-w-sm mb-8">
        This car may have been sold or the listing doesn&apos;t exist. Browse our other available
        vehicles.
      </p>
      <Link
        href="/"
        className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-full transition-colors"
      >
        Back to Listings
      </Link>
    </div>
  )
}
