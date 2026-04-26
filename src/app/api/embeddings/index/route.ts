import { ok, bad, fail, readJson } from '@/lib/api/json'
import { indexSource } from '@/lib/embeddings/index'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await readJson<{ sourceType: string; sourceId?: string; projectId?: string; content: string }>(req)
    if (!body?.sourceType || !body?.content) return bad('sourceType and content required')
    const n = await indexSource(body)
    return ok({ chunks: n })
  } catch (err) { return fail(err) }
}
