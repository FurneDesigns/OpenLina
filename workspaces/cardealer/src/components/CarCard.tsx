import Link from 'next/link'
import type { Car } from '@/types/car'
import { formatPrice, formatMileage } from '@/lib/cars'
import { CarImage } from './CarImage'

interface CarCardProps {
  car: Car
}

export function CarCard({ car }: CarCardProps) {
  const title = `${car.year} ${car.make} ${car.model}`

  return (
    <Link
      href={`/cars/${car.id}`}
      className="group block bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-300"
    >
      <div className="relative aspect-video bg-slate-100">
        <CarImage
          src={car.images[0]}
          alt={title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {car.sold && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
            <span className="bg-red-500 text-white text-sm font-bold px-5 py-1.5 rounded-full tracking-wider">
              SOLD
            </span>
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="font-semibold text-slate-900 text-lg leading-tight">{title}</h3>

        <p className="text-2xl font-bold mt-2">
          {car.sold ? (
            <span className="line-through text-slate-400">{formatPrice(car.price)}</span>
          ) : (
            <span className="text-blue-600">{formatPrice(car.price)}</span>
          )}
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-slate-500">
          <span>{formatMileage(car.mileage)}</span>
          <span>{car.transmission}</span>
          <span>{car.fuelType}</span>
        </div>

        <div className="mt-3">
          <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
            {car.color}
          </span>
        </div>

        {!car.sold && (
          <p className="mt-4 text-sm font-medium text-blue-600 group-hover:underline">
            View details &rarr;
          </p>
        )}
      </div>
    </Link>
  )
}
