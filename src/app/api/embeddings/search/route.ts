import { ok, bad, fail, readJson } from '@/lib/api/json'
import { search } from '@/lib/embeddings/index'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await readJson<{ query: string; projectId?: string; k?: number; sourceType?: string }>(req)
    if (!body?.query) return bad('query required')
    const hits = await search(body)
    return ok(hits)
  } catch (err) { return fail(err) }
}
