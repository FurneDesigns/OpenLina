'use client'
import { create } from 'zustand'
import type { LLMConfigSummary } from '@/types/llm'

interface LLMStore {
  queue: LLMConfigSummary[]
  isFailoverActive: boolean
  failoverReason: string | null
  currentLlmId: string | null
  setQueue: (queue: LLMConfigSummary[]) => void
  setFailover: (active: boolean, reason?: string, currentId?: string) => void
}

export const useLLMStore = create<LLMStore>((set) => ({
  queue: [],
  isFailoverActive: false,
  failoverReason: null,
  currentLlmId: null,

  setQueue: (queue) => set({ queue }),
  setFailover: (active, reason, currentId) =>
    set({ isFailoverActive: active, failoverReason: reason ?? null, currentLlmId: currentId ?? null }),
}))
