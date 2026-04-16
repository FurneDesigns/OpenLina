'use client'
import { create } from 'zustand'

export interface Project {
  id: string; name: string; slug: string
  description?: string; projectType: string; framework: string
  workspacePath?: string; assetsDir?: string
  targetAudience?: string
  brandColors?: { primary: string; secondary: string; accent: string }
  keyFeatures?: string[]; techStack?: string[]
  deploymentTarget?: string; i18nStrategy?: string
  i18nLocales?: string[]; createdAt: string; updatedAt: string
}

interface ProjectStore {
  projects: Project[]
  activeProjectId: string | null
  setProjects: (p: Project[]) => void
  addProject:  (p: Project) => void
  setActive:   (id: string | null) => void
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [], activeProjectId: null,
  setProjects: (projects) => set({ projects }),
  addProject:  (p)        => set((s) => ({ projects: [p, ...s.projects] })),
  setActive:   (id)       => set({ activeProjectId: id }),
}))
