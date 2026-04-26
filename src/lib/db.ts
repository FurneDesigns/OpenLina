import path from 'node:path'
import fs from 'node:fs'
import { runMigrations } from './migrations'

// node:sqlite is built-in (Node >= 22.5, requires --experimental-sqlite)
// We require it lazily so editors / non-runtime imports don't choke.
type DatabaseSync = any

let _db: DatabaseSync | null = null
let _initialized = false

export function getDataDir(): string {
  const fromEnv = process.env.OPENLINA_DATA_DIR
  const dir = fromEnv && fromEnv.length > 0 ? fromEnv : path.join(process.cwd(), '.openlina-data')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function getDb(): DatabaseSync {
  if (_db) return _db
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sqlite = require('node:sqlite') as { DatabaseSync: new (path: string) => DatabaseSync }
  if (!sqlite || !sqlite.DatabaseSync) {
    throw new Error(
      'node:sqlite is not available. Run with `node --experimental-sqlite` (Node >= 22.5).',
    )
  }
  const dbPath = path.join(getDataDir(), 'openlina.sqlite')
  _db = new sqlite.DatabaseSync(dbPath)
  // Pragmas for WAL + sane defaults
  try {
    _db.exec('PRAGMA journal_mode = WAL;')
    _db.exec('PRAGMA foreign_keys = ON;')
    _db.exec('PRAGMA synchronous = NORMAL;')
  } catch {}
  if (!_initialized) {
    runMigrations(_db)
    // Any run still marked 'running' on boot is stale (no live runner exists across restarts).
    // Mark them as 'stopped' so the UI can offer Resume instead of a forever-spinning state.
    try {
      _db.prepare(`UPDATE project_runs SET status = 'stopped', completed_at = COALESCE(completed_at, ?) WHERE status = 'running'`).run(nowIso())
      _db.prepare(`UPDATE run_steps SET status = 'stopped', completed_at = COALESCE(completed_at, ?) WHERE status = 'running'`).run(nowIso())
    } catch {}
    _initialized = true
  }
  return _db
}

export function tx<T>(fn: () => T): T {
  const db = getDb()
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    try {
      db.exec('ROLLBACK')
    } catch {}
    throw err
  }
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function genId(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10)
  const ts = Date.now().toString(36)
  return `${prefix ? prefix + '_' : ''}${ts}${rand}`
}

export function safeJsonParse<T = unknown>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
