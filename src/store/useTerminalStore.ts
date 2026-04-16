'use client'
import { create } from 'zustand'
import type { TerminalSession } from '@/types/terminal'

interface TerminalStore {
  sessions: TerminalSession[]
  activeSessionId: string | null
  addSession: (session: TerminalSession) => void
  updateSession: (id: string, patch: Partial<TerminalSession>) => void
  removeSession: (id: string) => void
  setActiveSession: (id: string | null) => void
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  sessions: [],
  activeSessionId: null,

  addSession: (session) =>
    set((s) => ({ sessions: [...s.sessions, session], activeSessionId: session.id })),
  updateSession: (id, patch) =>
    set((s) => ({ sessions: s.sessions.map((sess) => (sess.id === id ? { ...sess, ...patch } : sess)) })),
  removeSession: (id) =>
    set((s) => {
      const remaining = s.sessions.filter((sess) => sess.id !== id)
      return {
        sessions: remaining,
        activeSessionId:
          s.activeSessionId === id ? (remaining.at(-1)?.id ?? null) : s.activeSessionId,
      }
    }),
  setActiveSession: (id) => set({ activeSessionId: id }),
}))
