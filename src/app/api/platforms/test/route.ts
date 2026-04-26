import { ok, fail, readJson } from '@/lib/api/json'
import { checkAdapterHealth } from '@/lib/llm/cli-health'
import { getAdapterById } from '@/lib/llm/registry'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await readJson<{ llm_config_id: string }>(req)
    const adapter = getAdapterById(body.llm_config_id)
    if (!adapter) return ok({ healthy: false, error: 'adapter not found' })
    const healthy = await checkAdapterHealth(adapter)
    return ok({ healthy })
  } catch (err) { return fail(err) }
}
