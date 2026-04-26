import { ok } from '@/lib/api/json'

export const runtime = 'nodejs'

export async function GET() {
  return ok({ ok: true, ts: Date.now() })
}
