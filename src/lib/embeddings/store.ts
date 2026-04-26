import { getDb, genId, nowIso } from '../db'
import { EMBEDDING_DIMS, EMBEDDING_MODEL } from './provider'

export interface EmbeddingRow {
  id: string
  source_type: string
  source_id: string | null
  project_id: string | null
  chunk_index: number
  content: string
  vector: Buffer
  model: string
  dims: number
  created_at: string
}

export function bufferToFloat32(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
}

export function float32ToBuffer(arr: Float32Array): Buffer {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)
}

export interface InsertVecArgs {
  sourceType: string
  sourceId?: string | null
  projectId?: string | null
  chunkIndex: number
  content: string
  vector: Float32Array
}

export function insertVector(args: InsertVecArgs): string {
  const db = getDb()
  const id = genId('emb')
  db.prepare(`INSERT INTO embeddings (id, source_type, source_id, project_id, chunk_index, content, vector, model, dims, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, args.sourceType, args.sourceId ?? null, args.projectId ?? null, args.chunkIndex, args.content, float32ToBuffer(args.vector), EMBEDDING_MODEL, EMBEDDING_DIMS, nowIso())
  return id
}

export function deleteBySource(sourceType: string, sourceId: string): void {
  getDb().prepare(`DELETE FROM embeddings WHERE source_type = ? AND source_id = ?`).run(sourceType, sourceId)
}

export interface SearchArgs {
  query: Float32Array
  k?: number
  projectId?: string
  sourceType?: string
}

export interface SearchHit {
  id: string
  score: number
  content: string
  sourceType: string
  sourceId: string | null
  chunkIndex: number
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

export function searchVectors(args: SearchArgs): SearchHit[] {
  const db = getDb()
  let sql = `SELECT id, source_type, source_id, chunk_index, content, vector FROM embeddings WHERE 1=1`
  const params: any[] = []
  if (args.projectId) { sql += ` AND project_id = ?`; params.push(args.projectId) }
  if (args.sourceType) { sql += ` AND source_type = ?`; params.push(args.sourceType) }
  const rows = db.prepare(sql).all(...params) as EmbeddingRow[]
  const k = args.k ?? 8
  const scored = rows.map((row) => {
    const vec = bufferToFloat32(row.vector as any)
    return {
      id: row.id,
      score: dot(args.query, vec),
      content: row.content,
      sourceType: row.source_type,
      sourceId: row.source_id,
      chunkIndex: row.chunk_index,
    }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k)
}
