import { getDb } from '../db'
import { invokeWithFailover } from '../llm/failover'
import { messageBus } from './MessageBus'
import type { LLMMessage } from '../llm/types'
import type { AgentStatus } from '@/types/agent'

type StatusCallback = (agentId: string, status: AgentStatus) => void
type FailoverCallback = (event: {
  requestId: string
  failedLlmId: string
  nextLlmId: string
  reason: string
  message: string
}) => void

export class AgentRunner {
  private abortController: AbortController | null = null

  constructor(
    private agentId: string,
    private onStatus?: StatusCallback,
    private onFailover?: FailoverCallback,
  ) {}

  async run(userPrompt: string): Promise<string> {
    this.abortController = new AbortController()
    const db = getDb()

    const agent = db
      .prepare('SELECT * FROM agents WHERE id = ?')
      .get(this.agentId) as {
        system_prompt: string
        llm_config_id: string | null
      } | undefined

    if (!agent) throw new Error(`Agent ${this.agentId} not found`)

    this.setStatus('running')

    // Build message history for this agent
    const history = messageBus.getHistory(this.agentId, 20)
    const messages: LLMMessage[] = []

    if (agent.system_prompt) {
      messages.push({ role: 'system', content: agent.system_prompt })
    }

    for (const msg of history) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    messages.push({ role: 'user', content: userPrompt })

    // Publish the user message to the bus
    messageBus.publish({
      toAgentId: this.agentId,
      content: userPrompt,
      role: 'user',
    })

    try {
      const response = await invokeWithFailover(messages, {
        agentId: this.agentId,
        onFailover: this.onFailover,
      })

      if (this.abortController.signal.aborted) {
        this.setStatus('idle')
        return ''
      }

      // Publish the assistant response
      messageBus.publish({
        fromAgentId: this.agentId,
        content: response.content,
        role: 'assistant',
        metadata: {
          llmConfigId: response.llmConfigId,
          usage: {
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
          },
          latencyMs: response.latencyMs,
        },
      })

      this.setStatus('idle')
      return response.content
    } catch (err) {
      this.setStatus('error')
      messageBus.publish({
        fromAgentId: this.agentId,
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        role: 'system',
      })
      throw err
    }
  }

  cancel(): void {
    this.abortController?.abort()
    this.setStatus('idle')
  }

  private setStatus(status: AgentStatus): void {
    const db = getDb()
    db.prepare("UPDATE agents SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
      status,
      this.agentId,
    )
    this.onStatus?.(this.agentId, status)
  }
}
