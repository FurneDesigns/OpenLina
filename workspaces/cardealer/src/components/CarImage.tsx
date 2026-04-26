'use client'

import Image, { type ImageProps } from 'next/image'
import { useState } from 'react'

export function CarImage({ src, alt, ...props }: ImageProps) {
  const [hasError, setHasError] = useState(false)

  if (hasError || !src) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-16 h-16 text-slate-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        >
          <rect x="1" y="6" width="22" height="13" rx="2" />
          <path d="M5 6l2-3h10l2 3" />
          <circle cx="8" cy="15" r="2" />
          <circle cx="16" cy="15" r="2" />
        </svg>
        <span className="mt-2 text-xs text-slate-400">No image</span>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      {...props}
      onError={() => setHasError(true)}
    />
  )
}
