import { NextResponse } from 'next/server'

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init)
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export function fail(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : String(err)
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function readJson<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    return {} as T
  }
}
