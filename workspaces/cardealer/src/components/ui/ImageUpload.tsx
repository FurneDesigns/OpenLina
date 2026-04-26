'use client'

import { useState, useRef } from 'react'
import { Spinner } from './Spinner'

interface ImageUploadProps {
  onFiles: (files: File[]) => void
  uploading?: boolean
  accept?: string
  maxFiles?: number
  className?: string
}

export function ImageUpload({
  onFiles,
  uploading = false,
  accept = 'image/jpeg,image/png,image/webp',
  maxFiles = 10,
  className = '',
}: ImageUploadProps) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files).slice(0, maxFiles)
    if (files.length) onFiles(files)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, maxFiles)
    if (files.length) onFiles(files)
    e.target.value = ''
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors
        ${uploading ? 'cursor-default' : 'cursor-pointer'}
        ${dragOver
          ? 'border-brand-500 bg-brand-50'
          : 'border-slate-200 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/50'}
        ${className}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="sr-only"
        onChange={handleChange}
        disabled={uploading}
        aria-label="Upload photos"
      />
      {uploading ? (
        <>
          <Spinner size="lg" />
          <p className="text-sm text-muted">Uploading…</p>
        </>
      ) : (
        <>
          <svg className="h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <div>
            <p className="text-sm font-medium text-slate-700">
              Drag photos here or{' '}
              <span className="text-brand-600 underline underline-offset-2">browse</span>
            </p>
            <p className="text-xs text-muted mt-1">JPG, PNG, WebP · up to {maxFiles} photos</p>
          </div>
        </>
      )}
    </div>
  )
}
