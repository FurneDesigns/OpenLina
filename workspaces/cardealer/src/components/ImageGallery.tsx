'use client'

import { useState } from 'react'
import { CarImage } from './CarImage'

interface ImageGalleryProps {
  images: string[]
  alt: string
}

export function ImageGallery({ images, alt }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const displayImages = images.length > 0 ? images : ['']

  return (
    <div>
      <div className="relative aspect-video bg-slate-100 rounded-2xl overflow-hidden">
        <CarImage
          key={displayImages[activeIndex]}
          src={displayImages[activeIndex]}
          alt={`${alt} — photo ${activeIndex + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 60vw"
          priority={activeIndex === 0}
        />
      </div>

      {displayImages.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {displayImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              aria-label={`View photo ${i + 1}`}
              className={`relative flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden bg-slate-100 transition-all ${
                i === activeIndex
                  ? 'ring-2 ring-blue-500 ring-offset-2'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <CarImage
                src={img}
                alt={`${alt} thumbnail ${i + 1}`}
                fill
                className="object-cover"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
