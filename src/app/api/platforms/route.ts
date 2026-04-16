import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'
import { getDb } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto'

export async function GET() {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM platforms ORDER BY id').all() as Array<{
    id: string
    label: string
    enabled: number
    api_key_enc: string | null
    endpoint_url: string | null
    org_id: string | null
    extra_config: string | null
    created_at: string
    updated_at: string
  }>

  const platforms = rows.map((r) => ({
    id: r.id,
    label: r.label,
    enabled: Boolean(r.enabled),
    hasApiKey: Boolean(r.api_key_enc),
    endpointUrl: r.endpoint_url,
    orgId: r.org_id,
    extraConfig: r.extra_config ? JSON.parse(r.extra_config) : undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  return NextResponse.json(platforms)
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    id?: string
    label: string
    apiKey?: string
    endpointUrl?: string
    orgId?: string
    enabled?: boolean
    extraConfig?: Record<string, unknown>
  }

  const db = getDb()
  const id = body.id ?? uuid()
  const apiKeyEnc = body.apiKey ? encrypt(body.apiKey) : null

  db.prepare(`
    INSERT INTO platforms (id, label, enabled, api_key_enc, endpoint_url, org_id, extra_config)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      enabled = excluded.enabled,
      api_key_enc = COALESCE(excluded.api_key_enc, api_key_enc),
      endpoint_url = excluded.endpoint_url,
      org_id = excluded.org_id,
      extra_config = excluded.extra_config,
      updated_at = datetime('now')
  `).run(
    id,
    body.label,
    body.enabled !== false ? 1 : 0,
    apiKeyEnc,
    body.endpointUrl ?? null,
    body.orgId ?? null,
    body.extraConfig ? JSON.stringify(body.extraConfig) : null,
  )

  return NextResponse.json({ id }, { status: 201 })
}
