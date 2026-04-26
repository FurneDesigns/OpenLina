'use client'
import { create } from 'zustand'

export type ToastVariant = 'info' | 'success' | 'warn' | 'danger'
export interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

interface State {
  toasts: Toast[]
  push: (message: string, variant?: ToastVariant) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<State>((set, get) => ({
  toasts: [],
  push: (message, variant = 'info') => {
    const id = Math.random().toString(36).slice(2, 10)
    set({ toasts: [...get().toasts, { id, message, variant }] })
    setTimeout(() => get().dismiss(id), 4500)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))
