import { ok, fail } from '@/lib/api/json'
import { listTemplates } from '@/lib/templates/index'

export const runtime = 'nodejs'

export async function GET() {
  try { return ok(listTemplates()) } catch (err) { return fail(err) }
}
