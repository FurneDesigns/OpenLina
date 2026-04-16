import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { invokeWithFailover } from '@/lib/llm/failover'
import type { LLMMessage } from '@/lib/llm/types'

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    messages: LLMMessage[]
    agentId?: string
  }

  const requestId = uuid()
  const failoverEvents: unknown[] = []

  try {
    const response = await invokeWithFailover(body.messages, {
      requestId,
      agentId: body.agentId,
      onFailover: (event) => failoverEvents.push(event),
    })
    return NextResponse.json({ ...response, requestId, failoverEvents })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'LLM invocation failed', requestId },
      { status: 502 },
    )
  }
}
