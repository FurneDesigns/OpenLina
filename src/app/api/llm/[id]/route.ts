import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { broadcastLLMQueueUpdate } from '@/server/socket'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  db.prepare('DELETE FROM llm_configs WHERE id = ?').run(params.id)
  broadcastLLMQueueUpdate()
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json()) as {
    enabled?: boolean; priority?: number; temperature?: number
    maxTokens?: number; systemPrompt?: string; label?: string
    modelId?: string; cliCommand?: string; cliEnvVars?: Record<string, string>
  }
  const db = getDb()

  const sets: string[] = ["updated_at = datetime('now')"]
  const vals: unknown[] = []

  if (body.enabled !== undefined)    { sets.push('enabled = ?');      vals.push(body.enabled ? 1 : 0) }
  if (body.priority !== undefined)   { sets.push('priority = ?');     vals.push(body.priority) }
  if (body.temperature !== undefined){ sets.push('temperature = ?');  vals.push(body.temperature) }
  if (body.maxTokens !== undefined)  { sets.push('max_tokens = ?');   vals.push(body.maxTokens) }
  if (body.systemPrompt !== undefined){ sets.push('system_prompt = ?'); vals.push(body.systemPrompt) }
  if (body.label !== undefined)      { sets.push('label = ?');        vals.push(body.label) }
  if (body.modelId !== undefined)    { sets.push('model_id = ?');     vals.push(body.modelId) }
  if (body.cliCommand !== undefined) { sets.push('cli_command = ?');  vals.push(body.cliCommand) }
  if (body.cliEnvVars !== undefined) { sets.push('cli_env_vars = ?'); vals.push(JSON.stringify(body.cliEnvVars)) }

  vals.push(params.id)
  db.prepare(`UPDATE llm_configs SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  broadcastLLMQueueUpdate()
  return NextResponse.json({ ok: true })
}
