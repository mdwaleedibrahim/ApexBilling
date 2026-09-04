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

// Auto-migrate database from legacy or portable path if main DB does not exist
if (!fs.existsSync(DB_PATH)) {
  const possibleLegacyPaths = [
    path.join(process.cwd(), 'billing_app.db'),
    path.join(process.cwd(), 'data', 'billing_app.db'),
    path.join(__dirname, '..', 'billing_app.db'),
    path.join(__dirname, '..', 'data', 'billing_app.db'),
  ]
  for (const legacyPath of possibleLegacyPaths) {
    if (fs.existsSync(legacyPath) && fs.statSync(legacyPath).size > 0) {
      try {
        fs.copyFileSync(legacyPath, DB_PATH)
        console.log(`[DB] Migrated previous version database from ${legacyPath} → ${DB_PATH}`)
        break
      } catch {}
    }
  }
}

let _db: DatabaseSync | null = null
let _inTransaction = false

export function getDb(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH)
    _db.exec('PRAGMA journal_mode = WAL')
    _db.exec('PRAGMA foreign_keys = ON')
    _db.exec('PRAGMA synchronous = NORMAL')
    _db.exec('PRAGMA busy_timeout = 5000')
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8')
    _db.exec(schema)
    try { _db.exec('ALTER TABLE seller_profile ADD COLUMN enable_scan_to_pay INTEGER DEFAULT 1') } catch {}
    try { _db.exec('ALTER TABLE seller_profile ADD COLUMN show_purchase_price_in_pos INTEGER DEFAULT 1') } catch {}
    try {
      _db.exec('ALTER TABLE seller_profile ADD COLUMN _migrated_purchase_price_default INTEGER DEFAULT 0')
      _db.exec('UPDATE seller_profile SET show_purchase_price_in_pos = 1, _migrated_purchase_price_default = 1 WHERE id = 1')
    } catch {}
    try { _db.exec('ALTER TABLE seller_profile ADD COLUMN show_profit_loss_in_pos INTEGER DEFAULT 1') } catch {}
    try { _db.exec('ALTER TABLE seller_profile ADD COLUMN restrict_sales_to_stock_qty INTEGER DEFAULT 0') } catch {}
    try {
      _db.exec('ALTER TABLE seller_profile ADD COLUMN invoice_terms TEXT DEFAULT \'["Goods once sold can\'\'t be returned", "Goods can be exchanged with valid bill within 7 days of purchase"]\'')
      _db.exec('UPDATE seller_profile SET invoice_terms = \'["Goods once sold can\'\'t be returned", "Goods can be exchanged with valid bill within 7 days of purchase"]\' WHERE invoice_terms IS NULL')
    } catch {}
    try {
      _db.exec('ALTER TABLE seller_profile ADD COLUMN quotation_terms TEXT DEFAULT \'["Quotation valid for 3 days only"]\'')
      _db.exec('UPDATE seller_profile SET quotation_terms = \'["Quotation valid for 3 days only"]\' WHERE quotation_terms IS NULL')
    } catch {}
    try { _db.exec('ALTER TABLE documents ADD COLUMN hide_tax_on_invoice INTEGER DEFAULT 0') } catch {}
    try { _db.exec('ALTER TABLE documents ADD COLUMN terms_and_conditions TEXT') } catch {}
    try { _db.exec('ALTER TABLE document_items ADD COLUMN purchase_price DECIMAL(10,2) DEFAULT 0') } catch {}
    try { _db.exec('ALTER TABLE document_items ADD COLUMN unit TEXT DEFAULT \'PCS\'') } catch {}
    try { _db.exec('CREATE INDEX IF NOT EXISTS idx_document_items_doc_id ON document_items(document_id)') } catch {}
    try { _db.exec('CREATE INDEX IF NOT EXISTS idx_documents_customer_phone ON documents(customer_phone)') } catch {}
    try { _db.exec('CREATE INDEX IF NOT EXISTS idx_documents_analytics ON documents(doc_type, payment_status, doc_date)') } catch {}
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
    if (result && typeof (result as any).then === 'function') {
      throw new Error('[DB] withTransaction callbacks must be strictly synchronous')
    }
    db.exec('COMMIT')
    return result
  } catch (err) {
    try { db.exec('ROLLBACK') } catch {}
    throw err
  } finally {
    _inTransaction = false
  }
}

export default getDb
