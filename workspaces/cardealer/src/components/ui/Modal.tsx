'use client'

import type { ReactNode } from 'react'
import { Button } from './Button'
import { Spinner } from './Spinner'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  confirmLabel?: string
  confirmVariant?: 'primary' | 'danger'
  onConfirm?: () => void
  loading?: boolean
}

export function Modal({
  open,
  onClose,
  title,
  children,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  onConfirm,
  loading = false,
}: ModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-surface-darker/60 backdrop-blur-sm"
        onClick={!loading ? onClose : undefined}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-2xl w-full max-w-md p-6 flex flex-col gap-4"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        <h2 id="modal-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <div className="text-sm text-slate-600">{children}</div>
        <div className="flex items-center gap-3 justify-end pt-2">
          {loading && <Spinner size="sm" />}
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          {onConfirm && (
            <Button variant={confirmVariant} size="sm" onClick={onConfirm} disabled={loading}>
              {confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
