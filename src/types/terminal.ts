export interface TerminalSession {
  id: string
  label: string
  command: string
  cwd: string
  status: 'active' | 'dead'
  createdAt: string
  closedAt?: string
}
