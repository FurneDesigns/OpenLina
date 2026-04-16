'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, X, Image as ImageIcon, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AssetFile {
  name: string; size: number; url: string; modifiedAt?: string
}

interface Props {
  /** Project ID to upload to (if undefined, operates in local-only/preview mode) */
  projectId?: string
  /** Pre-selected local files (wizard mode — not yet uploaded) */
  localFiles?: File[]
  onLocalFilesChange?: (files: File[]) => void
  className?: string
  label?: string
  accept?: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AssetUploader({
  projectId,
  localFiles,
  onLocalFilesChange,
  className,
  label = 'Logo / Brand assets',
  accept = 'image/*',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [remoteFiles, setRemoteFiles] = useState<AssetFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState<Record<string, 'ok' | 'error'>>({})
  const [dragging, setDragging] = useState(false)

  // Load existing remote assets
  useEffect(() => {
    if (!projectId) return
    fetch(`/api/projects/${projectId}/assets`)
      .then((r) => r.json())
      .then(setRemoteFiles)
      .catch(() => {})
  }, [projectId])

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files)
      if (!arr.length) return

      if (!projectId) {
        // Wizard mode — just accumulate locally
        onLocalFilesChange?.([...(localFiles ?? []), ...arr])
        return
      }

      // Upload mode
      setUploading(true)
      const fd = new FormData()
      arr.forEach((f) => fd.append('file', f))

      try {
        const res = await fetch(`/api/projects/${projectId}/assets`, {
          method: 'POST', body: fd,
        })
        const data = await res.json() as { uploaded: AssetFile[]; errors: string[] }

        setRemoteFiles((prev) => [...data.uploaded, ...prev])
        const results: Record<string, 'ok' | 'error'> = {}
        data.uploaded.forEach((f) => { results[f.name] = 'ok' })
        data.errors.forEach((e) => { const name = e.split(':')[0]; results[name] = 'error' })
        setUploadResults(results)
        setTimeout(() => setUploadResults({}), 3000)
      } catch {
        // ignore
      } finally {
        setUploading(false)
      }
    },
    [projectId, localFiles, onLocalFilesChange]
  )

  async function deleteRemote(name: string) {
    if (!projectId) return
    await fetch(`/api/projects/${projectId}/assets/${encodeURIComponent(name)}`, { method: 'DELETE' })
    setRemoteFiles((prev) => prev.filter((f) => f.name !== name))
  }

  function removeLocal(index: number) {
    onLocalFilesChange?.((localFiles ?? []).filter((_, i) => i !== index))
  }

  const displayFiles: Array<{ name: string; url?: string; size?: number; local?: boolean }> = [
    ...(remoteFiles ?? []).map((f) => ({ ...f, local: false })),
    ...(localFiles ?? []).map((f) => ({ name: f.name, size: f.size, url: URL.createObjectURL(f), local: true })),
  ]

  return (
    <div className={cn('space-y-3', className)}>
      {label && <p className="text-sm font-medium">{label}</p>}

      {/* Drop zone */}
      <div
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors cursor-pointer',
          dragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-accent/30',
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="sr-only"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {uploading ? (
          <Loader2 className="h-7 w-7 animate-spin text-primary mb-2" />
        ) : (
          <Upload className="h-7 w-7 text-muted-foreground mb-2" />
        )}
        <p className="text-sm font-medium text-center">
          {uploading ? 'Uploading...' : 'Drop images here or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG, WebP · max 10 MB each</p>
      </div>

      {/* File list */}
      {displayFiles.length > 0 && (
        <div className="space-y-2">
          {displayFiles.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
            >
              {/* Thumbnail */}
              <div className="h-10 w-10 shrink-0 rounded-md overflow-hidden border border-border bg-muted flex items-center justify-center">
                {file.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.url} alt={file.name} className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{file.name}</p>
                {file.size && (
                  <p className="text-[10px] text-muted-foreground">{formatSize(file.size)}</p>
                )}
              </div>

              {uploadResults[file.name] === 'ok' && <Check className="h-3.5 w-3.5 text-green-400 shrink-0" />}
              {uploadResults[file.name] === 'error' && <span className="text-[10px] text-red-400">Failed</span>}
              {file.local && !projectId && (
                <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">pending</span>
              )}

              <button
                onClick={(e) => { e.stopPropagation(); file.local ? removeLocal(i - remoteFiles.length) : deleteRemote(file.name) }}
                className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
