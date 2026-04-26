import { getCars, getConfig } from '@/lib/cars'
import { CarCard } from '@/components/CarCard'
import { ContactSection } from '@/components/ContactSection'

export default function HomePage() {
  const cars = getCars()
  const config = getConfig()
  const availableCount = cars.filter((c) => !c.sold).length

  return (
    <>
      {/* Hero */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-24 text-center">
          <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-4">
            {config.location}
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
            {config.tagline}
          </h1>
          <p className="text-slate-400 text-lg mb-10">
            Browse {availableCount} available vehicle
            {availableCount !== 1 ? 's' : ''} — contact us directly, no middlemen.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#listings"
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-4 rounded-full transition-colors text-lg"
            >
              Browse Listings
            </a>
            <a
              href="#contact"
              className="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-8 py-4 rounded-full transition-colors text-lg"
            >
              Contact Us
            </a>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <div className="bg-blue-600 text-white py-3">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center gap-x-8 gap-y-1 text-sm font-medium">
          <span>&#10003; No hidden fees</span>
          <span>&#10003; Full service history available</span>
          <span>&#10003; Test drives welcome</span>
        </div>
      </div>

      {/* Car grid */}
      <section id="listings" className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Available Vehicles</h2>
          <span className="text-sm text-slate-500">{availableCount} for sale</span>
        </div>

        {cars.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-lg">No listings yet — check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cars.map((car) => (
              <CarCard key={car.id} car={car} />
            ))}
          </div>
        )}
      </section>

      {/* Contact */}
      <ContactSection config={config} />
    </>
  )
}
