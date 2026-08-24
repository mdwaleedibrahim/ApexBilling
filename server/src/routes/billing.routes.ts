/**
 * billing.routes.ts - Phase 5: Invoice & Quotation CRUD + POS Memory Slots
 */
import type { FastifyInstance } from 'fastify';
import { getDb, withTransaction } from '../db/database.js';
import { calculateInvoiceTotals } from '../services/calculation.service.js';
import { deductStockForNewInvoice, reconcileStockOnEdit, restoreStockOnCancel } from '../services/stock-reconciler.service.js';
import { randomUUID } from 'crypto';

function generateDocNumber(db: any, type: 'INVOICE' | 'QUOTATION', prefix = 'INV', qprefix = 'QUO'): string {
  const p = type === 'INVOICE' ? prefix : qprefix;
  const year = new Date().getFullYear();
  const count = (db.prepare(`SELECT COUNT(*) as c FROM documents WHERE doc_type = ?`).get(type) as any).c + 1;
  return `${p}-${year}-${String(count).padStart(4, '0')}`;
}

function validateStockLimits(db: any, rawItems: any[], existingDocId: string | null = null): string | null {
  const profile = db.prepare(`SELECT restrict_sales_to_stock_qty FROM seller_profile WHERE id = 1`).get() as any;
  if (!profile?.restrict_sales_to_stock_qty) return null;

  const newQuantities: Record<string, number> = {};
  for (const item of rawItems) {
    if (item.productId) {
      newQuantities[item.productId] = (newQuantities[item.productId] || 0) + item.quantity;
    }
  }

  const oldQuantities: Record<string, number> = {};
  if (existingDocId) {
    const oldItems = db.prepare(`SELECT product_id, quantity FROM document_items WHERE document_id = ?`).all(existingDocId) as any[];
    for (const item of oldItems) {
      if (item.product_id) {
        oldQuantities[item.product_id] = (oldQuantities[item.product_id] || 0) + item.quantity;
      }
    }
  }

  for (const [prodId, newQty] of Object.entries(newQuantities)) {
    const oldQty = oldQuantities[prodId] || 0;
    if (newQty > oldQty) {
      const netRequired = newQty - oldQty;
      const prod = db.prepare(`SELECT name, stock_qty FROM products WHERE id = ?`).get(prodId) as any;
      if (prod && netRequired > prod.stock_qty) {
        return `Cannot sell ${newQty} units of "${prod.name}" (Only ${prod.stock_qty} available in stock)`;
      }
    }
  }
  return null;
}

export async function billingRoutes(app: FastifyInstance) {
  // ── Documents ──────────────────────────────────────────────────────────────

  // GET /api/documents - list all with filters
  app.get<{ Querystring: { type?: string; status?: string; search?: string; limit?: string } }>(
    '/api/documents', (req, reply) => {
      const { type, status, search, limit } = req.query;
      let sql = `SELECT d.*, di_count.item_count FROM documents d
        LEFT JOIN (SELECT document_id, COUNT(*) as item_count FROM document_items GROUP BY document_id) di_count
        ON d.id = di_count.document_id WHERE 1=1`;
      const params: any[] = [];
      if (type && type !== 'undefined') { sql += ' AND d.doc_type = ?'; params.push(type); }
      if (status && status !== 'undefined') { sql += ' AND d.payment_status = ?'; params.push(status); }
      if (search && search.trim() && search !== 'undefined') { sql += ' AND (d.doc_number LIKE ? OR d.customer_snapshot LIKE ?)'; params.push(`%${search.trim()}%`, `%${search.trim()}%`); }
      sql += ' ORDER BY d.doc_date DESC, d.created_at DESC';
      sql += ` LIMIT ${parseInt(limit || '100')}`;
      return reply.send(getDb().prepare(sql).all(...params));
    }
  );

  // GET /api/documents/:id - full detail with line items
  app.get<{ Params: { id: string } }>('/api/documents/:id', (req, reply) => {
    const db = getDb();
    const doc = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(req.params.id);
    if (!doc) return reply.status(404).send({ error: 'Document not found' });
    const items = db.prepare(`SELECT * FROM document_items WHERE document_id = ? ORDER BY rowid`).all(req.params.id);
    return reply.send({ ...doc as any, items });
  });

  // POST /api/documents - create invoice or quotation
  app.post<{ Body: any }>('/api/documents', (req, reply) => {
    const db = getDb();
    const { doc_type = 'INVOICE', doc_date, customer_phone, customer_snapshot, items: rawItems,
      discount_pct = 0, payment_mode = 'CASH', payment_status = 'PAID', selected_upi_id, notes, hide_tax_on_invoice = 0 } = (req.body || {}) as any;

    if (!rawItems?.length) return reply.status(400).send({ error: 'items required' });

    if (doc_type === 'INVOICE') {
      const stockErr = validateStockLimits(db, rawItems);
      if (stockErr) return reply.status(400).send({ error: stockErr });
    }

    const totals = calculateInvoiceTotals(rawItems, discount_pct);
    const id = randomUUID();
    const doc_number = generateDocNumber(db, doc_type);
    const snapshot = typeof customer_snapshot === 'string' ? customer_snapshot : JSON.stringify(customer_snapshot || {});

    withTransaction(() => {
      db.prepare(`
        INSERT INTO documents (id, doc_type, doc_number, doc_date, customer_phone, customer_snapshot,
          gross_subtotal, discount_pct, discount_amount, taxable_amount, cgst_total, sgst_total,
          round_off, grand_total, payment_mode, payment_status, selected_upi_id, notes, hide_tax_on_invoice)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(id, doc_type, doc_number, doc_date || new Date().toISOString().slice(0,10),
        customer_phone || null, snapshot, totals.grossSubtotal, totals.discountPct, totals.discountAmount,
        totals.taxableAmount, totals.cgstTotal, totals.sgstTotal, totals.roundOff, totals.grandTotal,
        payment_mode, payment_status, selected_upi_id || null, notes || null, hide_tax_on_invoice ? 1 : 0);

      const insertItem = db.prepare(`
        INSERT INTO document_items (id, document_id, product_id, product_name, hsn_sac, unit, quantity, unit_price,
          gross_amount, taxable_value, gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, total_amount, purchase_price)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `);
      for (const item of totals.items) {
        insertItem.run(randomUUID(), id, item.productId || null, item.productName, item.hsnSac || null,
          item.unit || 'PCS', item.quantity, item.unitPrice, item.grossAmount, item.taxableValue,
          item.gstRate, item.cgstRate, item.cgstAmount, item.sgstRate, item.sgstAmount, item.totalAmount,
          item.purchasePrice || 0);
      }

      // Deduct stock only for confirmed invoices
      if (doc_type === 'INVOICE' && payment_status !== 'CANCELLED') {
        deductStockForNewInvoice(totals.items);
      }
    });

    const doc = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(id);
    const items = db.prepare(`SELECT * FROM document_items WHERE document_id = ?`).all(id);
    return reply.status(201).send({ ...doc as any, items });
  });

  // PUT /api/documents/:id - edit invoice (with stock reconciliation + revision bump)
  app.put<{ Params: { id: string }; Body: any }>('/api/documents/:id', (req, reply) => {
    const db = getDb();
    const existing = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(req.params.id) as any;
    if (!existing) return reply.status(404).send({ error: 'Document not found' });
    if (existing.payment_status === 'CANCELLED') return reply.status(400).send({ error: 'Cannot edit cancelled document' });

    const { items: rawItems, discount_pct = 0, payment_mode, payment_status, notes, customer_phone, customer_snapshot, hide_tax_on_invoice } = (req.body || {}) as any;
    if (!rawItems?.length) return reply.status(400).send({ error: 'items required' });

    if (existing.doc_type === 'INVOICE') {
      const stockErr = validateStockLimits(db, rawItems, req.params.id);
      if (stockErr) return reply.status(400).send({ error: stockErr });
    }

    const totals = calculateInvoiceTotals(rawItems, discount_pct);

    withTransaction(() => {
      // Reconcile stock if it's an invoice
      if (existing.doc_type === 'INVOICE') {
        reconcileStockOnEdit(req.params.id, rawItems.map((i: any) => ({ productId: i.productId, quantity: i.quantity })));
      }

      db.prepare(`
        UPDATE documents SET customer_phone=?, customer_snapshot=?, gross_subtotal=?, discount_pct=?,
          discount_amount=?, taxable_amount=?, cgst_total=?, sgst_total=?, round_off=?, grand_total=?,
          payment_mode=?, payment_status=?, notes=?, hide_tax_on_invoice=?, revision_number=revision_number+1, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).run(customer_phone || existing.customer_phone,
        typeof customer_snapshot === 'string' ? customer_snapshot : JSON.stringify(customer_snapshot || JSON.parse(existing.customer_snapshot)),
        totals.grossSubtotal, totals.discountPct, totals.discountAmount, totals.taxableAmount,
        totals.cgstTotal, totals.sgstTotal, totals.roundOff, totals.grandTotal,
        payment_mode || existing.payment_mode, payment_status || existing.payment_status,
        notes ?? existing.notes, hide_tax_on_invoice !== undefined ? (hide_tax_on_invoice ? 1 : 0) : existing.hide_tax_on_invoice || 0,
        req.params.id);

      db.prepare(`DELETE FROM document_items WHERE document_id = ?`).run(req.params.id);
      const insertItem = db.prepare(`
        INSERT INTO document_items (id, document_id, product_id, product_name, hsn_sac, unit, quantity, unit_price,
          gross_amount, taxable_value, gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, total_amount, purchase_price)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `);
      for (const item of totals.items) {
        insertItem.run(randomUUID(), req.params.id, item.productId || null, item.productName,
          item.hsnSac || null, item.unit || 'PCS', item.quantity, item.unitPrice, item.grossAmount, item.taxableValue,
          item.gstRate, item.cgstRate, item.cgstAmount, item.sgstRate, item.sgstAmount, item.totalAmount,
          item.purchasePrice || 0);
      }
    });

    const doc = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(req.params.id);
    const items = db.prepare(`SELECT * FROM document_items WHERE document_id = ?`).all(req.params.id);
    return reply.send({ ...doc as any, items });
  });

  // PATCH /api/documents/:id/cancel
  app.patch<{ Params: { id: string } }>('/api/documents/:id/cancel', (req, reply) => {
    const db = getDb();
    const doc = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(req.params.id) as any;
    if (!doc) return reply.status(404).send({ error: 'Document not found' });
    if (doc.payment_status === 'CANCELLED') return reply.send({ message: 'Already cancelled' });
    withTransaction(() => {
      if (doc.doc_type === 'INVOICE') restoreStockOnCancel(req.params.id);
      db.prepare(`UPDATE documents SET payment_status='CANCELLED', updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(req.params.id);
    });
    return reply.send({ success: true });
  });

  // PATCH /api/documents/:id/status
  app.patch<{ Params: { id: string }; Body: { payment_status: string; payment_mode?: string } }>(
    '/api/documents/:id/status', (req, reply) => {
      const { payment_status, payment_mode } = req.body;
      const db = getDb();
      db.prepare(`UPDATE documents SET payment_status=?, payment_mode=COALESCE(?,payment_mode), updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(payment_status, payment_mode || null, req.params.id);
      return reply.send(db.prepare(`SELECT * FROM documents WHERE id = ?`).get(req.params.id));
    }
  );

  // POST /api/documents/:id/convert - Convert Quotation to Invoice
  app.post<{ Params: { id: string }; Body: { payment_mode?: string; payment_status?: string } }>(
    '/api/documents/:id/convert', (req, reply) => {
      const db = getDb();
      const quo: any = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(req.params.id);
      if (!quo) return reply.status(404).send({ error: 'Quotation not found' });
      if (quo.doc_type !== 'QUOTATION') return reply.status(400).send({ error: 'Document is not a quotation' });

      const items: any[] = db.prepare(`SELECT * FROM document_items WHERE document_id = ?`).all(req.params.id) as any[];
      const payment_mode = req.body?.payment_mode || 'CASH';
      const payment_status = req.body?.payment_status || 'PAID';

      const invoiceId = randomUUID();
      const invoiceNum = generateDocNumber(db, 'INVOICE');

      withTransaction(() => {
        deductStockForNewInvoice(items.map(i => ({
          productId: i.product_id,
          quantity: i.quantity,
          productName: i.product_name
        })));

        db.prepare(`
          INSERT INTO documents (
            id, doc_type, doc_number, parent_doc_id, revision_number, doc_date,
            customer_phone, customer_snapshot, gross_subtotal, discount_pct, discount_amount,
            taxable_amount, cgst_total, sgst_total, round_off, grand_total,
            payment_mode, payment_status, selected_upi_id, notes
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          invoiceId, 'INVOICE', invoiceNum, quo.id, 1, new Date().toISOString().split('T')[0],
          quo.customer_phone, quo.customer_snapshot, quo.gross_subtotal, quo.discount_pct, quo.discount_amount,
          quo.taxable_amount, quo.cgst_total, quo.sgst_total, quo.round_off, quo.grand_total,
          payment_mode, payment_status, quo.selected_upi_id, quo.notes
        );

        const insertItem = db.prepare(`
          INSERT INTO document_items (id, document_id, product_id, product_name, hsn_sac, unit, quantity, unit_price,
            gross_amount, taxable_value, gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, total_amount)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `);

        for (const item of items) {
          insertItem.run(
            randomUUID(), invoiceId, item.product_id, item.product_name, item.hsn_sac, item.unit || 'PCS',
            item.quantity, item.unit_price, item.gross_amount, item.taxable_value,
            item.gst_rate, item.cgst_rate, item.cgst_amount, item.sgst_rate, item.sgst_amount, item.total_amount
          );
        }
      });

      const newInvoice = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(invoiceId);
      const newItems = db.prepare(`SELECT * FROM document_items WHERE document_id = ?`).all(invoiceId);
      return reply.status(201).send({ ...newInvoice as any, items: newItems });
    }
  );

  // ── POS Memory Slots ───────────────────────────────────────────────────────

  // GET /api/pos/slots - all 5 slots
  app.get('/api/pos/slots', (_req, reply) => {
    return reply.send(getDb().prepare(`SELECT * FROM pos_memory_slots ORDER BY slot_id`).all());
  });

  // PUT /api/pos/slots/:slotId - save cart state
  app.put<{ Params: { slotId: string }; Body: { cart_state: any; slot_label?: string } }>(
    '/api/pos/slots/:slotId', (req, reply) => {
      const slotId = parseInt(req.params.slotId);
      if (slotId < 1 || slotId > 5) return reply.status(400).send({ error: 'slot_id must be 1-5' });
      const cartJson = typeof req.body.cart_state === 'string' ? req.body.cart_state : JSON.stringify(req.body.cart_state);
      getDb().prepare(`
        UPDATE pos_memory_slots SET cart_state=?, slot_label=COALESCE(?,slot_label), updated_at=CURRENT_TIMESTAMP WHERE slot_id=?
      `).run(cartJson, req.body.slot_label || null, slotId);
      return reply.send({ success: true });
    }
  );
}
