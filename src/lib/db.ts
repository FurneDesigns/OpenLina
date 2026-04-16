import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import fs from 'fs'
import { runMigrations } from './migrations'

export const DATA_DIR = process.env.OPENLINA_DATA_DIR || path.join(
  process.env.HOME || process.env.USERPROFILE || '~',
  '.openlina'
)

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const DB_PATH = path.join(DATA_DIR, 'openlina.db')

export type DB = InstanceType<typeof DatabaseSync>

let _db: DB | null = null

export function getDb(): DB {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH)
    _db.exec('PRAGMA journal_mode = WAL')
    _db.exec('PRAGMA foreign_keys = ON')
    runMigrations(_db)
  }
  return _db
}

export function closeDb(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}
