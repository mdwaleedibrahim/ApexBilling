/**
 * database.ts — SQLite connection using Node.js built-in node:sqlite (v22.5+)
 * No native compilation required.
 */
// @ts-ignore — node:sqlite types may not be bundled yet; works at runtime on Node 22+
import { DatabaseSync } from 'node:sqlite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DB_DIR  = path.join(process.env.APPDATA || process.env.HOME || '.', 'ApexBill')
const DB_PATH = path.join(DB_DIR, 'billing_app.db')
const SCHEMA_PATH = path.join(__dirname, 'schema.sql')

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })

let _db: DatabaseSync | null = null
let _inTransaction = false

export function getDb(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH)
    _db.exec('PRAGMA journal_mode = WAL')
    _db.exec('PRAGMA foreign_keys = ON')
    _db.exec('PRAGMA synchronous = NORMAL')
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8')
    _db.exec(schema)
    console.log(`[DB] SQLite connected → ${DB_PATH}`)
  }
  return _db
}

/**
 * Re-entrant atomic transaction wrapper.
 * Reuses existing transaction if already inside one.
 */
export function withTransaction<T>(fn: () => T): T {
  const db = getDb()
  if (_inTransaction) {
    return fn()
  }
  _inTransaction = true
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  } finally {
    _inTransaction = false
  }
}

export default getDb
