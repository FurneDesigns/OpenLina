import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getCar,
  getCars,
  getConfig,
  formatPrice,
  formatMileage,
  buildWhatsAppUrl,
} from '@/lib/cars'
import { ImageGallery } from '@/components/ImageGallery'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateStaticParams() {
  return getCars().map((car) => ({ id: car.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const car = getCar(id)
  if (!car) return { title: 'Not Found' }
  return {
    title: `${car.year} ${car.make} ${car.model}`,
    description: car.description,
  }
}

const SPEC_ROWS = [
  { label: 'Year', key: 'year' },
  { label: 'Mileage', key: 'mileage' },
  { label: 'Transmission', key: 'transmission' },
  { label: 'Fuel Type', key: 'fuelType' },
  { label: 'Color', key: 'color' },
] as const

export default async function CarDetailPage({ params }: Props) {
  const { id } = await params
  const car = getCar(id)

  if (!car) {
    notFound()
  }

  const config = getConfig()
  const title = `${car.year} ${car.make} ${car.model}`
  const whatsappUrl = buildWhatsAppUrl(
    config.whatsapp,
    `Hi, I'm interested in the ${title} listed for ${formatPrice(car.price)}. Is it still available?`
  )

  const specValues: Record<string, string> = {
    year: String(car.year),
    mileage: formatMileage(car.mileage),
    transmission: car.transmission,
    fuelType: car.fuelType,
    color: car.color,
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <Link
        href="/#listings"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-6 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All listings
      </Link>

      <div className="lg:grid lg:grid-cols-5 lg:gap-10">
        {/* Gallery */}
        <div className="lg:col-span-3">
          <ImageGallery images={car.images} alt={title} />
        </div>

        {/* Info panel */}
        <div className="lg:col-span-2 mt-6 lg:mt-0">
          {car.sold && (
            <span className="inline-block bg-red-100 text-red-600 text-xs font-bold px-3 py-1 rounded-full mb-3 tracking-wider">
              SOLD
            </span>
          )}

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{title}</h1>

          <p className="text-3xl font-bold mt-2 mb-6">
            {car.sold ? (
              <span className="line-through text-slate-400">{formatPrice(car.price)}</span>
            ) : (
              <span className="text-blue-600">{formatPrice(car.price)}</span>
            )}
          </p>

          {/* Specs table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
            {SPEC_ROWS.map(({ label, key }, i) => (
              <div
                key={key}
                className={`flex justify-between px-4 py-3 text-sm ${
                  i % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                }`}
              >
                <span className="text-slate-500 font-medium">{label}</span>
                <span className="text-slate-900 font-semibold">{specValues[key]}</span>
              </div>
            ))}
          </div>

          {/* Contact CTAs */}
          {!car.sold ? (
            <div className="flex flex-col gap-3">
              <a
                href={`tel:${config.phone}`}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-xl transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                Call Now
              </a>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-4 rounded-xl transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </a>

              <a
                href={`mailto:${config.email}?subject=Enquiry: ${title}&body=Hi, I'm interested in the ${title} listed for ${formatPrice(car.price)}. Is it still available?`}
                className="flex items-center justify-center gap-2 border-2 border-slate-200 hover:border-slate-300 bg-white text-slate-700 font-semibold py-4 rounded-xl transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Send Email
              </a>
            </div>
          ) : (
            <div className="bg-slate-100 rounded-xl p-4 text-center text-slate-500 text-sm">
              This vehicle has been sold.{' '}
              <Link href="/#listings" className="text-blue-600 hover:underline">
                View other listings
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Description + Features */}
      <div className="mt-10 lg:max-w-3xl space-y-8">
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-3">About This Car</h2>
          <p className="text-slate-600 leading-relaxed">{car.description}</p>
        </div>

        {car.features.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">Features &amp; Equipment</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {car.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-slate-600 text-sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4 text-green-500 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
