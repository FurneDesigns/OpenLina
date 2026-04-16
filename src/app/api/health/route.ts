import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export function GET() {
  try {
    getDb() // Ensure DB is initialized
    return NextResponse.json({
      status: 'ok',
      version: '0.1.0',
      cwd: process.cwd(),
    })
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
