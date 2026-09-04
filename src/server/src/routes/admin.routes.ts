/**
 * admin.routes.ts — Admin, System Maintenance, Data Persistence & Backup/Restore
 */
import type { FastifyInstance } from 'fastify'
import fs from 'fs'
import path from 'path'
import { getDb, withTransaction } from '../db/database.js'

const DB_DIR  = path.join(process.env.APPDATA || process.env.HOME || '.', 'ApexBill')
const DB_PATH = path.join(DB_DIR, 'billing_app.db')
const BACKUP_DIR = path.join(DB_DIR, 'backups')

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

export async function adminRoutes(app: FastifyInstance) {
  // GET /api/admin/system-info
  app.get('/api/admin/system-info', (_req, reply) => {
    const db = getDb()

    let dbSize = 0
    let lastModified = ''
    if (fs.existsSync(DB_PATH)) {
      const stats = fs.statSync(DB_PATH)
      dbSize = Math.round((stats.size / (1024 * 1024)) * 100) / 100 // Size in MB
      lastModified = stats.mtime.toISOString()
    }

    const journalMode = (db.prepare('PRAGMA journal_mode').get() as any)?.journal_mode || 'WAL'
    const invoiceCount = (db.prepare("SELECT COUNT(*) as c FROM documents WHERE doc_type='INVOICE'").get() as any)?.c || 0
    const quotationCount = (db.prepare("SELECT COUNT(*) as c FROM documents WHERE doc_type='QUOTATION'").get() as any)?.c || 0
    const productCount = (db.prepare('SELECT COUNT(*) as c FROM products').get() as any)?.c || 0
    const customerCount = (db.prepare('SELECT COUNT(*) as c FROM customers').get() as any)?.c || 0
    const upiCount = (db.prepare('SELECT COUNT(*) as c FROM seller_upi_accounts').get() as any)?.c || 0

    // List recent snapshot files
    const snapshots = fs.existsSync(BACKUP_DIR)
      ? fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db') || f.endsWith('.json')).map(f => {
          const s = fs.statSync(path.join(BACKUP_DIR, f))
          return { name: f, sizeMb: Math.round((s.size / (1024 * 1024)) * 100) / 100, createdAt: s.mtime.toISOString() }
        }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10)
      : []

    return reply.send({
      dbPath: DB_PATH,
      dbSizeMb: dbSize,
      journalMode,
      lastModified,
      counts: {
        invoices: invoiceCount,
        quotations: quotationCount,
        products: productCount,
        customers: customerCount,
        upiAccounts: upiCount,
      },
      snapshots,
    })
  })

  // GET /api/admin/backup/export — Full System JSON Backup
  app.get('/api/admin/backup/export', (_req, reply) => {
    const db = getDb()

    const profile = db.prepare('SELECT * FROM seller_profile WHERE id=1').get()
    const upiAccounts = db.prepare('SELECT * FROM seller_upi_accounts').all()
    const products = db.prepare('SELECT * FROM products').all()
    const customers = db.prepare('SELECT * FROM customers').all()
    const documents = db.prepare('SELECT * FROM documents').all()
    const documentItems = db.prepare('SELECT * FROM document_items').all()
    const memorySlots = db.prepare('SELECT * FROM pos_memory_slots').all()

    const backupPayload = {
      app: 'ApexBill',
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      data: {
        profile,
        upiAccounts,
        products,
        customers,
        documents,
        documentItems,
        memorySlots,
      },
    }

    reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="ApexBill_Full_Backup_${new Date().toISOString().slice(0,10)}.json"`)
      .send(backupPayload)
  })

  // POST /api/admin/backup/restore — Full System JSON Restore with Transaction Rollback Protection
  app.post<{ Body: any }>('/api/admin/backup/restore', (req, reply) => {
    const body = (req.body || {}) as any
    const payload = body.data || body

    if (!payload || !payload.profile) {
      return reply.status(400).send({ error: 'Invalid backup file format' })
    }

    const db = getDb()

    // 1. Create safety snapshot before restoring
    try {
      const emergencyBackup = path.join(BACKUP_DIR, `pre_restore_${Date.now()}.db`)
      fs.copyFileSync(DB_PATH, emergencyBackup)
    } catch {}

    // 2. Perform transactional wipe & repopulate
    withTransaction(() => {
      // Clear existing records
      db.prepare('DELETE FROM document_items').run()
      db.prepare('DELETE FROM documents').run()
      db.prepare('DELETE FROM customers').run()
      db.prepare('DELETE FROM products').run()
      db.prepare('DELETE FROM seller_upi_accounts').run()
      db.prepare('DELETE FROM pos_memory_slots').run()

      // Restore Profile
      if (payload.profile) {
        const p = payload.profile
        db.prepare(`
          UPDATE seller_profile SET
            business_name=?, trade_name=?, gstin=?, pan=?, phone=?, email=?,
            address_line1=?, address_line2=?, city=?, state_code=?, pincode=?,
            bank_name=?, bank_account_no=?, bank_ifsc=?, bank_branch=?, active_upi_id=?,
            enable_scan_to_pay=?, show_purchase_price_in_pos=?, show_profit_loss_in_pos=?,
            restrict_sales_to_stock_qty=?, invoice_terms=?, quotation_terms=?, updated_at=CURRENT_TIMESTAMP
          WHERE id=1
        `).run(
          p.business_name, p.trade_name || null, p.gstin, p.pan || null, p.phone, p.email || null,
          p.address_line1, p.address_line2 || null, p.city, p.state_code, p.pincode,
          p.bank_name || null, p.bank_account_no || null, p.bank_ifsc || null, p.bank_branch || null,
          p.active_upi_id || null, p.enable_scan_to_pay ?? 1,
          p.show_purchase_price_in_pos ?? 1, p.show_profit_loss_in_pos ?? 1,
          p.restrict_sales_to_stock_qty ?? 0,
          p.invoice_terms ? (typeof p.invoice_terms === 'string' ? p.invoice_terms : JSON.stringify(p.invoice_terms)) : null,
          p.quotation_terms ? (typeof p.quotation_terms === 'string' ? p.quotation_terms : JSON.stringify(p.quotation_terms)) : null
        )
      }

      // Restore UPI Accounts
      if (Array.isArray(payload.upiAccounts)) {
        const insertUpi = db.prepare('INSERT INTO seller_upi_accounts (id, upi_id, payee_name, label, is_default) VALUES (?,?,?,?,?)')
        for (const u of payload.upiAccounts) {
          insertUpi.run(u.id, u.upi_id, u.payee_name, u.label, u.is_default ? 1 : 0)
        }
      }

      // Restore Products
      if (Array.isArray(payload.products)) {
        const insertProd = db.prepare(`
          INSERT INTO products (id, sku, name, hsn_sac, unit, purchase_price, selling_price, tax_rate, stock_qty)
          VALUES (?,?,?,?,?,?,?,?,?)
        `)
        for (const pr of payload.products) {
          insertProd.run(pr.id, pr.sku, pr.name, pr.hsn_sac || null, pr.unit || 'PCS', pr.purchase_price || 0, pr.selling_price, pr.tax_rate ?? 18, pr.stock_qty || 0)
        }
      }

      // Restore Customers
      if (Array.isArray(payload.customers)) {
        const insertCust = db.prepare(`
          INSERT INTO customers (phone, name, email, gstin, billing_address, state_code, outstanding_balance)
          VALUES (?,?,?,?,?,?,?)
        `)
        for (const c of payload.customers) {
          insertCust.run(c.phone, c.name, c.email || null, c.gstin || null, c.billing_address || null, c.state_code || '36', c.outstanding_balance || 0)
        }
      }

      // Restore Documents
      if (Array.isArray(payload.documents)) {
        const insertDoc = db.prepare(`
          INSERT INTO documents (id, doc_type, doc_number, parent_doc_id, doc_date, customer_phone, customer_snapshot,
            gross_subtotal, discount_pct, discount_amount, taxable_amount, cgst_total, sgst_total,
            round_off, grand_total, payment_mode, payment_status, selected_upi_id, revision_number, notes, terms_and_conditions, hide_tax_on_invoice)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `)
        for (const d of payload.documents) {
          insertDoc.run(
            d.id, d.doc_type, d.doc_number, d.parent_doc_id || null, d.doc_date, d.customer_phone || null,
            typeof d.customer_snapshot === 'string' ? d.customer_snapshot : JSON.stringify(d.customer_snapshot || {}),
            d.gross_subtotal, d.discount_pct || 0, d.discount_amount || 0, d.taxable_amount,
            d.cgst_total || 0, d.sgst_total || 0, d.round_off || 0, d.grand_total,
            d.payment_mode || 'CASH', d.payment_status || 'PAID', d.selected_upi_id || null,
            d.revision_number || 1, d.notes || null,
            d.terms_and_conditions ? (typeof d.terms_and_conditions === 'string' ? d.terms_and_conditions : JSON.stringify(d.terms_and_conditions)) : null,
            d.hide_tax_on_invoice ? 1 : 0
          )
        }
      }

      // Restore Document Items
      if (Array.isArray(payload.documentItems)) {
        const insertItem = db.prepare(`
          INSERT INTO document_items (id, document_id, product_id, product_name, hsn_sac, unit, quantity, unit_price,
            gross_amount, taxable_value, gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, total_amount, purchase_price)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `)
        for (const item of payload.documentItems) {
          insertItem.run(
            item.id, item.document_id, item.product_id || null, item.product_name, item.hsn_sac || null,
            item.unit || 'PCS', item.quantity, item.unit_price, item.gross_amount, item.taxable_value,
            item.gst_rate, item.cgst_rate || 0, item.cgst_amount || 0, item.sgst_rate || 0, item.sgst_amount || 0,
            item.total_amount, item.purchase_price || 0
          )
        }
      }

      // Restore Memory Slots
      if (Array.isArray(payload.memorySlots)) {
        const insertSlot = db.prepare('INSERT OR REPLACE INTO pos_memory_slots (slot_id, slot_label, cart_state) VALUES (?,?,?)')
        for (const ms of payload.memorySlots) {
          insertSlot.run(ms.slot_id, ms.slot_label || `Slot ${ms.slot_id}`, typeof ms.cart_state === 'string' ? ms.cart_state : JSON.stringify(ms.cart_state || {}))
        }
      }
    })

    return reply.send({ success: true, message: 'System restored successfully!' })
  })

  // POST /api/admin/backup/snapshot — Create Instant Snapshot Copy
  app.get('/api/admin/backup/snapshot', (_req, reply) => {
    try {
      const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const snapshotName = `snapshot_${nowStr}.db`
      const targetPath = path.join(BACKUP_DIR, snapshotName)
      fs.copyFileSync(DB_PATH, targetPath)
      return reply.send({ success: true, snapshot: snapshotName })
    } catch (err: any) {
      return reply.status(500).send({ error: err?.message || 'Failed to create snapshot' })
    }
  })

  // POST /api/admin/cleanup — Wipe selected data (billing | inventory | all)
  app.post<{ Body: { scope: string } }>('/api/admin/cleanup', (req, reply) => {
    const db = getDb()
    const { scope } = req.body || {}
    if (!['billing', 'inventory', 'customers', 'all'].includes(scope)) {
      return reply.status(400).send({ error: 'scope must be: billing | inventory | customers | all' })
    }
    db.exec('BEGIN')
    try {
      if (scope === 'billing' || scope === 'all') {
        db.prepare('DELETE FROM document_items').run()
        db.prepare('DELETE FROM documents').run()
        db.prepare(`UPDATE pos_memory_slots SET slot_label = 'Slot ' || slot_id, cart_state = '{"items":[],"customer":null,"discountPct":0,"paymentMode":"CASH"}'`).run()
      }
      if (scope === 'inventory' || scope === 'all') {
        db.prepare('UPDATE document_items SET product_id = NULL').run()
        db.prepare('DELETE FROM products').run()
      }
      if (scope === 'customers' || scope === 'all') {
        db.prepare('DELETE FROM customers').run()
      }
      db.exec('COMMIT')
      return reply.send({ success: true, scope })
    } catch (err: any) {
      db.exec('ROLLBACK')
      return reply.status(500).send({ error: err?.message || 'Cleanup failed' })
    }
  })
}
