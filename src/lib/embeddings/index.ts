import { embedMany, embedOne } from './provider'
import { chunkText } from './chunk'
import { deleteBySource, insertVector, searchVectors } from './store'

const MAX_INPUT_BYTES = 200_000
const MAX_CHUNKS = 200

export interface IndexSourceArgs {
  sourceType: string
  sourceId?: string | null
  projectId?: string | null
  content: string
}

function trimInput(text: string): string {
  if (text.length <= MAX_INPUT_BYTES) return text
  const half = MAX_INPUT_BYTES / 2
  return text.slice(0, half) + '\n[... truncated ...]\n' + text.slice(-half)
}

export async function indexSource(args: IndexSourceArgs): Promise<number> {
  const text = trimInput(args.content || '')
  if (!text.trim()) return 0
  if (args.sourceId) deleteBySource(args.sourceType, args.sourceId)
  let chunks = chunkText(text)
  if (chunks.length > MAX_CHUNKS) chunks = chunks.slice(0, MAX_CHUNKS)
  const vectors = await embedMany(chunks)
  for (let i = 0; i < chunks.length; i++) {
    insertVector({
      sourceType: args.sourceType,
      sourceId: args.sourceId ?? null,
      projectId: args.projectId ?? null,
      chunkIndex: i,
      content: chunks[i],
      vector: vectors[i],
    })
  }
  return chunks.length
}

export interface SearchArgs {
  query: string
  k?: number
  projectId?: string
  sourceType?: string
}

export async function search(args: SearchArgs) {
  const vec = await embedOne(args.query)
  return searchVectors({ query: vec, k: args.k, projectId: args.projectId, sourceType: args.sourceType })
}

export async function buildContext(args: { query: string; projectId?: string; k?: number; maxChars?: number }): Promise<string> {
  const max = args.maxChars ?? 8_000
  const hits = await search({ query: args.query, projectId: args.projectId, k: args.k ?? 8 })
  const parts: string[] = []
  let used = 0
  for (const h of hits) {
    const block = `### ${h.sourceType}#${h.sourceId || '?'} (score=${h.score.toFixed(3)})\n${h.content}`
    if (used + block.length > max) break
    parts.push(block)
    used += block.length
  }
  return parts.join('\n\n')
}
