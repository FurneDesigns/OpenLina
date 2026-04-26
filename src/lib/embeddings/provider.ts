import os from 'node:os'
import path from 'node:path'

const MODEL = 'Xenova/all-MiniLM-L6-v2'
export const EMBEDDING_DIMS = 384
export const EMBEDDING_MODEL = MODEL

let extractorPromise: Promise<any> | null = null

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const cache = path.join(os.homedir(), '.openlina', 'models')
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { pipeline, env } = await import('@xenova/transformers')
      env.cacheDir = cache
      env.allowLocalModels = true
      env.useFSCache = true
      return pipeline('feature-extraction', MODEL, { quantized: true })
    })()
  }
  return extractorPromise
}

export async function embedMany(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return []
  const extractor = await getExtractor()
  const out: Float32Array[] = []
  const BATCH = 16
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH)
    const result = await extractor(batch, { pooling: 'mean', normalize: true })
    // result is a Tensor with shape [batch, dims] when given array
    const data = result.data as Float32Array
    const rows = batch.length
    const dims = data.length / rows
    for (let r = 0; r < rows; r++) {
      const slice = new Float32Array(dims)
      slice.set(data.subarray(r * dims, (r + 1) * dims))
      out.push(slice)
    }
  }
  return out
}

export async function embedOne(text: string): Promise<Float32Array> {
  const [v] = await embedMany([text])
  return v
}
