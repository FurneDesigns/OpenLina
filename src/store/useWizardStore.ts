'use client'
import { create } from 'zustand'

interface PlatformWizardData {
  openai?: { apiKey: string; orgId?: string; modelId: string }
  anthropic?: { apiKey: string; modelId: string }
  google?: { apiKey: string; modelId: string }
  ollama?: { endpointUrl: string; modelId: string }
  custom?: { label: string; endpointUrl: string; apiKey?: string; modelId: string }
}

interface ProjectWizardData {
  name?: string
  projectType?: string
  framework?: string
  i18nStrategy?: string
  i18nLocales?: string[]
  defaultLocale?: string
  rootPath?: string
}

interface WizardStore {
  platformStep: number
  projectStep: number
  platformData: PlatformWizardData
  projectData: ProjectWizardData

  setPlatformStep: (step: number) => void
  setProjectStep: (step: number) => void
  setPlatformData: (data: Partial<PlatformWizardData>) => void
  setProjectData: (data: Partial<ProjectWizardData>) => void
  resetPlatform: () => void
  resetProject: () => void
}

export const useWizardStore = create<WizardStore>((set) => ({
  platformStep: 0,
  projectStep: 0,
  platformData: {},
  projectData: {},

  setPlatformStep: (step) => set({ platformStep: step }),
  setProjectStep: (step) => set({ projectStep: step }),
  setPlatformData: (data) => set((s) => ({ platformData: { ...s.platformData, ...data } })),
  setProjectData: (data) => set((s) => ({ projectData: { ...s.projectData, ...data } })),
  resetPlatform: () => set({ platformStep: 0, platformData: {} }),
  resetProject: () => set({ projectStep: 0, projectData: {} }),
}))
