import { EventEmitter } from 'events'
import { v4 as uuid } from 'uuid'
import { getDb } from '../db'
import type { AgentMessage, MessageRole } from '@/types/agent'

class MessageBus extends EventEmitter {
  publish(opts: {
    fromAgentId?: string
    toAgentId?: string
    content: string
    role: MessageRole
    metadata?: Record<string, unknown>
  }): AgentMessage {
    const db = getDb()
    const msg: AgentMessage = {
      id: uuid(),
      fromAgentId: opts.fromAgentId,
      toAgentId: opts.toAgentId,
      content: opts.content,
      role: opts.role,
      metadata: opts.metadata,
      createdAt: new Date().toISOString(),
    }

    db.prepare(`
      INSERT INTO agent_messages (id, from_agent, to_agent, content, role, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      msg.id,
      msg.fromAgentId ?? null,
      msg.toAgentId ?? null,
      msg.content,
      msg.role,
      msg.metadata ? JSON.stringify(msg.metadata) : null,
      msg.createdAt,
    )

    this.emit('message', msg)
    if (msg.toAgentId) {
      this.emit(`message:${msg.toAgentId}`, msg)
    } else {
      this.emit('broadcast', msg)
    }

    return msg
  }

  getHistory(agentId: string, limit = 50): AgentMessage[] {
    const db = getDb()
    const rows = db.prepare(`
      SELECT * FROM agent_messages
      WHERE to_agent = ? OR from_agent = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(agentId, agentId, limit) as Array<{
      id: string
      from_agent: string | null
      to_agent: string | null
      content: string
      role: string
      metadata: string | null
      created_at: string
    }>

    return rows.reverse().map((r) => ({
      id: r.id,
      fromAgentId: r.from_agent ?? undefined,
      toAgentId: r.to_agent ?? undefined,
      content: r.content,
      role: r.role as MessageRole,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      createdAt: r.created_at,
    }))
  }
}

export const messageBus = new MessageBus()
messageBus.setMaxListeners(100)
