'use client'
import { create } from 'zustand'

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'stopped'

export interface PipelineStep {
  stepId: string
  agentId: string
  agentName: string
  role: string
  iteration: number
  status: StepStatus
  output: string
  tokensUsed?: number
}

export interface PipelineState {
  runId: string | null
  projectId: string | null
  status: 'idle' | 'running' | 'completed' | 'failed' | 'stopped'
  iteration: number
  maxIterations: number
  steps: PipelineStep[]
  terminalLines: string[]  // streamed text for terminal display

  setRunId:        (id: string | null) => void
  setStatus:       (s: PipelineState['status']) => void
  setIteration:    (n: number) => void
  addStep:         (step: PipelineStep) => void
  updateStep:      (stepId: string, patch: Partial<PipelineStep>) => void
  appendChunk:     (stepId: string, delta: string) => void
  appendTerminal:  (line: string) => void
  reset:           (projectId: string, maxIterations: number) => void
}

export const usePipelineStore = create<PipelineState>((set) => ({
  runId: null, projectId: null, status: 'idle',
  iteration: 0, maxIterations: 3, steps: [], terminalLines: [],

  setRunId:     (id)   => set({ runId: id }),
  setStatus:    (s)    => set({ status: s }),
  setIteration: (n)    => set({ iteration: n }),
  addStep:      (step) => set((s) => ({ steps: [...s.steps, step] })),
  updateStep:   (stepId, patch) =>
    set((s) => ({ steps: s.steps.map((st) => st.stepId === stepId ? { ...st, ...patch } : st) })),
  appendChunk:  (stepId, delta) =>
    set((s) => ({
      steps: s.steps.map((st) => st.stepId === stepId ? { ...st, output: st.output + delta } : st),
      terminalLines: [...s.terminalLines, delta],
    })),
  appendTerminal: (line) =>
    set((s) => ({ terminalLines: [...s.terminalLines, line].slice(-2000) })),
  reset: (projectId, maxIterations) =>
    set({ runId: null, projectId, status: 'idle', iteration: 0, maxIterations, steps: [], terminalLines: [] }),
}))
