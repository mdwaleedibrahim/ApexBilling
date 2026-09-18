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
    try { _db.exec('ALTER TABLE seller_profile ADD COLUMN show_profit_in_records INTEGER DEFAULT 1') } catch {}
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
    try { _db.exec('ALTER TABLE documents ADD COLUMN paid_amount DECIMAL(12,2) DEFAULT 0.00') } catch {}
    try { _db.exec('ALTER TABLE documents ADD COLUMN partial_payment_mode TEXT') } catch {}
    try { _db.exec('ALTER TABLE documents ADD COLUMN additional_discount DECIMAL(12,2) DEFAULT 0.00') } catch {}
    try { _db.exec('ALTER TABLE documents ADD COLUMN payment_history TEXT DEFAULT \'[]\'') } catch {}
    try { _db.exec('ALTER TABLE documents ADD COLUMN qr_amount_type TEXT DEFAULT \'FULL\'') } catch {}
    try { _db.exec('ALTER TABLE products ADD COLUMN mrp DECIMAL(10,2) DEFAULT 0.00') } catch {}
    try { _db.exec('ALTER TABLE document_items ADD COLUMN purchase_price DECIMAL(10,2) DEFAULT 0') } catch {}
    try { _db.exec('ALTER TABLE document_items ADD COLUMN unit TEXT DEFAULT \'PCS\'') } catch {}
    try { _db.exec('ALTER TABLE document_items ADD COLUMN mrp DECIMAL(10,2) DEFAULT 0.00') } catch {}
    try { _db.exec('CREATE INDEX IF NOT EXISTS idx_document_items_doc_id ON document_items(document_id)') } catch {}
    try { _db.exec('CREATE INDEX IF NOT EXISTS idx_documents_customer_phone ON documents(customer_phone)') } catch {}
    try { _db.exec('CREATE INDEX IF NOT EXISTS idx_documents_analytics ON documents(doc_type, payment_status, doc_date)') } catch {}

    // Multi-Seller GST Profiles & Bank Accounts migration
    try {
      _db.exec(`
        CREATE TABLE IF NOT EXISTS seller_bank_accounts (
          id TEXT PRIMARY KEY,
          bank_name TEXT NOT NULL,
          account_number TEXT NOT NULL,
          ifsc_code TEXT NOT NULL,
          branch_name TEXT,
          account_holder TEXT,
          is_default BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `)
    } catch {}

    try {
      _db.exec(`
        CREATE TABLE IF NOT EXISTS seller_profiles (
          id TEXT PRIMARY KEY,
          business_name TEXT NOT NULL DEFAULT 'My Business',
          trade_name TEXT,
          gstin TEXT NOT NULL DEFAULT '00AAAAA0000A1Z5',
          pan TEXT,
          phone TEXT NOT NULL DEFAULT '9999999999',
          email TEXT,
          address_line1 TEXT NOT NULL DEFAULT 'Address Line 1',
          address_line2 TEXT,
          city TEXT NOT NULL DEFAULT 'City',
          state_code TEXT NOT NULL DEFAULT '36',
          pincode TEXT NOT NULL DEFAULT '500001',
          bank_account_id TEXT REFERENCES seller_bank_accounts(id) ON DELETE SET NULL,
          bank_name TEXT,
          bank_account_no TEXT,
          bank_ifsc TEXT,
          bank_branch TEXT,
          active_upi_id TEXT,
          is_default BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `)
    } catch {}

    try { _db.exec('ALTER TABLE documents ADD COLUMN seller_profile_id TEXT') } catch {}
    try { _db.exec('ALTER TABLE documents ADD COLUMN seller_snapshot TEXT') } catch {}
    try { _db.exec('CREATE INDEX IF NOT EXISTS idx_documents_seller_profile_id ON documents(seller_profile_id)') } catch {}

    try {
      const profileCount = (_db.prepare('SELECT COUNT(*) as c FROM seller_profiles').get() as any)?.c || 0
      if (profileCount === 0) {
        const legacy: any = _db.prepare('SELECT * FROM seller_profile WHERE id = 1').get()
        if (legacy) {
          let bankAccountId = null
          if (legacy.bank_name || legacy.bank_account_no) {
            bankAccountId = 'bank-migrated-1'
            _db.prepare(`
              INSERT OR IGNORE INTO seller_bank_accounts (id, bank_name, account_number, ifsc_code, branch_name, is_default)
              VALUES (?, ?, ?, ?, ?, 1)
            `).run(
              bankAccountId,
              legacy.bank_name || 'Bank Account',
              legacy.bank_account_no || '',
              legacy.bank_ifsc || '',
              legacy.bank_branch || ''
            )
          }

          _db.prepare(`
            INSERT OR IGNORE INTO seller_profiles (
              id, business_name, trade_name, gstin, pan, phone, email,
              address_line1, address_line2, city, state_code, pincode,
              bank_account_id, bank_name, bank_account_no, bank_ifsc, bank_branch,
              active_upi_id, is_default
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          `).run(
            'default-seller-1',
            legacy.business_name || 'My Business',
            legacy.trade_name || null,
            legacy.gstin || '00AAAAA0000A1Z5',
            legacy.pan || null,
            legacy.phone || '9999999999',
            legacy.email || null,
            legacy.address_line1 || 'Address Line 1',
            legacy.address_line2 || null,
            legacy.city || 'Hyderabad',
            legacy.state_code || '36',
            legacy.pincode || '500001',
            bankAccountId,
            legacy.bank_name || null,
            legacy.bank_account_no || null,
            legacy.bank_ifsc || null,
            legacy.bank_branch || null,
            legacy.active_upi_id || null
          )
        }
      }
    } catch (e) {
      console.error('[DB] Error migrating seller_profiles:', e)
    }

    try {
      const defaultProf: any = _db.prepare('SELECT * FROM seller_profiles WHERE is_default = 1 LIMIT 1').get() ||
                               _db.prepare('SELECT * FROM seller_profiles LIMIT 1').get()
      if (defaultProf) {
        const snap = JSON.stringify({
          id: defaultProf.id,
          business_name: defaultProf.business_name,
          trade_name: defaultProf.trade_name,
          gstin: defaultProf.gstin,
          pan: defaultProf.pan,
          phone: defaultProf.phone,
          email: defaultProf.email,
          address_line1: defaultProf.address_line1,
          address_line2: defaultProf.address_line2,
          city: defaultProf.city,
          state_code: defaultProf.state_code,
          pincode: defaultProf.pincode,
          bank_name: defaultProf.bank_name,
          bank_account_no: defaultProf.bank_account_no,
          bank_ifsc: defaultProf.bank_ifsc,
          bank_branch: defaultProf.bank_branch,
          active_upi_id: defaultProf.active_upi_id,
        })
        _db.prepare(`
          UPDATE documents
          SET seller_profile_id = COALESCE(seller_profile_id, ?),
              seller_snapshot = COALESCE(NULLIF(seller_snapshot, ''), ?)
          WHERE seller_snapshot IS NULL OR seller_snapshot = '' OR seller_profile_id IS NULL
        `).run(defaultProf.id, snap)
      }
    } catch (e) {
      console.error('[DB] Error backfilling documents seller_snapshot:', e)
    }

    try {
      _db.exec(`
        UPDATE documents
        SET payment_status = 'PAID'
        WHERE doc_type = 'INVOICE'
          AND payment_status = 'PARTIAL'
          AND paid_amount >= grand_total - 0.01
      `)
    } catch {}
    try {
      _db.exec(`
        UPDATE customers
        SET outstanding_balance = COALESCE((
          SELECT SUM(grand_total - paid_amount)
          FROM documents
          WHERE customer_phone = customers.phone
            AND doc_type = 'INVOICE'
            AND payment_status IN ('UNPAID', 'PARTIAL')
        ), 0)
      `)
    } catch {}
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
