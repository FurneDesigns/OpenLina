export interface ChunkOpts {
  maxChars?: number
  overlap?: number
}

export function chunkText(text: string, opts: ChunkOpts = {}): string[] {
  const max = opts.maxChars ?? 1500
  const overlap = opts.overlap ?? 200
  if (!text) return []
  if (text.length <= max) return [text]
  const paragraphs = text.split(/\n\n+/)
  const chunks: string[] = []
  let current = ''
  for (const p of paragraphs) {
    if (p.length > max) {
      if (current) { chunks.push(current); current = '' }
      for (let i = 0; i < p.length; i += max - overlap) {
        chunks.push(p.slice(i, i + max))
      }
      continue
    }
    if ((current + '\n\n' + p).length > max) {
      if (current) chunks.push(current)
      current = p
    } else {
      current = current ? current + '\n\n' + p : p
    }
  }
  if (current) chunks.push(current)
  // Add overlap by re-stitching tails
  const withOverlap: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    const prevTail = i > 0 ? chunks[i - 1].slice(-overlap) : ''
    withOverlap.push((prevTail + chunks[i]).slice(0, max))
  }
  return withOverlap
}
