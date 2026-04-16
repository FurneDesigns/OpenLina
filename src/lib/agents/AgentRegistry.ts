import { AgentRunner } from './AgentRunner'
import type { AgentStatus } from '@/types/agent'

type StatusCallback = (agentId: string, status: AgentStatus) => void
type FailoverCallback = Parameters<typeof AgentRunner.prototype.run>[0] extends never
  ? never
  : (event: { requestId: string; failedLlmId: string; nextLlmId: string; reason: string; message: string }) => void

class AgentRegistry {
  private runners = new Map<string, AgentRunner>()
  private onStatusCallbacks: StatusCallback[] = []
  private onFailoverCallbacks: FailoverCallback[] = []

  onStatus(cb: StatusCallback): void {
    this.onStatusCallbacks.push(cb)
  }

  onFailover(cb: FailoverCallback): void {
    this.onFailoverCallbacks.push(cb)
  }

  async run(agentId: string, prompt: string): Promise<string> {
    const runner = new AgentRunner(
      agentId,
      (id, status) => this.onStatusCallbacks.forEach((cb) => cb(id, status)),
      (event) => this.onFailoverCallbacks.forEach((cb) => cb(event)),
    )
    this.runners.set(agentId, runner)
    try {
      return await runner.run(prompt)
    } finally {
      this.runners.delete(agentId)
    }
  }

  cancel(agentId: string): void {
    this.runners.get(agentId)?.cancel()
    this.runners.delete(agentId)
  }

  isRunning(agentId: string): boolean {
    return this.runners.has(agentId)
  }
}

export const agentRegistry = new AgentRegistry()
