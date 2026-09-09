/**
 * billing.routes.ts - Phase 5: Invoice & Quotation CRUD + POS Memory Slots
 */
import type { FastifyInstance } from 'fastify';
import { getDb, withTransaction } from '../db/database.js';
import { calculateInvoiceTotals } from '../services/calculation.service.js';
import { deductStockForNewInvoice, reconcileStockOnEdit, restoreStockOnCancel } from '../services/stock-reconciler.service.js';
import { randomUUID } from 'crypto';
import { normalizePhone } from '../utils/phoneHelper.js';

function generateDocNumber(db: any, type: 'INVOICE' | 'QUOTATION', prefix = 'INV', qprefix = 'QUO'): string {
  const p = type === 'INVOICE' ? prefix : qprefix;
  const year = new Date().getFullYear();
  const pattern = `${p}-${year}-%`;
  const existingNumbers = db.prepare(`SELECT doc_number FROM documents WHERE doc_number LIKE ?`).all(pattern) as Array<{ doc_number: string }>;
  let maxSeq = 0;
  for (const row of existingNumbers) {
    const parts = row.doc_number.split('-');
    if (parts.length >= 3) {
      const seq = parseInt(parts[2], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  let nextSeq = maxSeq + 1;
  let candidate = `${p}-${year}-${String(nextSeq).padStart(4, '0')}`;
  while (db.prepare(`SELECT 1 FROM documents WHERE doc_number = ?`).get(candidate)) {
    nextSeq++;
    candidate = `${p}-${year}-${String(nextSeq).padStart(4, '0')}`;
  }
  return candidate;
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

function ensureProductInInventory(db: any, item: any): string {
  if (item.productId) {
    const existing = db.prepare(`SELECT id FROM products WHERE id = ?`).get(item.productId);
    if (existing) return item.productId;
  }
  const byName = db.prepare(`SELECT id FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))`).get(item.productName) as any;
  if (byName) {
    return byName.id;
  }
  const id = randomUUID();
  const sku = 'SKU-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);
  db.prepare(`
    INSERT INTO products (id, sku, name, hsn_sac, unit, purchase_price, selling_price, mrp, tax_rate, stock_qty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    sku,
    item.productName.trim(),
    item.hsnSac || null,
    item.unit || 'PCS',
    item.purchasePrice || 0,
    item.unitPrice || 0,
    item.mrp || 0,
    item.gstRate ?? 18,
    item.quantity || 0
  );
  return id;
}

function saveCustomerIfPaymentComplete(db: any, docId: string | null, customerSnapshot: any, customerPhone?: string | null): string | null {
  let snap: any = {};
  try {
    snap = typeof customerSnapshot === 'string' ? JSON.parse(customerSnapshot) : (customerSnapshot || {});
  } catch {
    snap = {};
  }

  let phone = normalizePhone(customerPhone || snap.phone || '');
  let name = (snap.name || '').trim();

  // If both phone and name are empty, nothing to persist
  if (!phone && !name) return null;

  // Search if a customer with this exact phone already exists in customers table
  if (phone && !phone.startsWith('NO_PHONE_')) {
    const existingByPhone = db.prepare(`SELECT phone FROM customers WHERE phone = ?`).get(phone) as any;
    if (existingByPhone) {
      phone = existingByPhone.phone;
    }
  } else if (!phone && name) {
    // If no phone was entered, search if an existing customer with this name exists to avoid duplicate
    const existingByName = db.prepare(`SELECT phone FROM customers WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1`).get(name) as any;
    if (existingByName && existingByName.phone) {
      phone = existingByName.phone;
    }
  }

  if (!phone) {
    phone = 'NO_PHONE_' + randomUUID().slice(0, 8).toUpperCase();
  }
  if (!name) {
    name = phone.startsWith('NO_PHONE_') ? 'Customer' : `Customer ${phone}`;
  }

  db.prepare(`
    INSERT INTO customers (phone, name, email, gstin, billing_address, state_code)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(phone) DO UPDATE SET
      name = CASE WHEN excluded.name != '' AND excluded.name NOT LIKE 'Customer %' THEN excluded.name ELSE customers.name END,
      email = COALESCE(excluded.email, customers.email),
      gstin = COALESCE(excluded.gstin, customers.gstin),
      billing_address = COALESCE(excluded.billing_address, customers.billing_address),
      state_code = COALESCE(excluded.state_code, customers.state_code),
      updated_at = CURRENT_TIMESTAMP
  `).run(phone, name, snap.email || null, snap.gstin || null, snap.billing_address || null, snap.state_code || '36');

  if (docId) {
    db.prepare(`UPDATE documents SET customer_phone = ? WHERE id = ?`).run(phone, docId);
  }

  return phone;
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
      const safeLimit = Math.max(1, Math.min(1000, parseInt(limit || '100', 10) || 100));
      sql += ' LIMIT ?';
      params.push(safeLimit);
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
      discount_pct = 0, additional_discount = 0, payment_mode = 'CASH', payment_status = 'PAID', selected_upi_id, notes,
      terms_and_conditions, hide_tax_on_invoice = 0, paid_amount = 0, partial_payment_mode,
      converting_quotation_id } = (req.body || {}) as any;

    if (!rawItems?.length) return reply.status(400).send({ error: 'items required' });

    const totals = calculateInvoiceTotals(rawItems, discount_pct, additional_discount);

    // Enforce loss prevention: grand total must not be lower than total purchase cost
    let totalPurchaseCost = 0;
    for (const item of rawItems) {
      const pp = parseFloat(item.purchasePrice || 0);
      const qty = parseFloat(item.quantity || 0);
      if (pp > 0 && qty > 0) {
        totalPurchaseCost += pp * qty;
      }
    }
    if (totalPurchaseCost > 0 && totals.grandTotal < totalPurchaseCost - 0.01) {
      return reply.status(400).send({
        error: `Discounts cannot exceed allowable limit: Grand total (₹${totals.grandTotal.toFixed(2)}) is lower than total purchase cost (₹${totalPurchaseCost.toFixed(2)}). Loss is not allowed.`
      });
    }

    // Enforce stock restrictions if enabled
    if (doc_type === 'INVOICE' && payment_status !== 'CANCELLED') {
      const stockErr = validateStockLimits(db, totals.items);
      if (stockErr) return reply.status(400).send({ error: stockErr });
    }

    const id = randomUUID();
    const doc_number = generateDocNumber(db, doc_type);
    const snapshot = typeof customer_snapshot === 'string' ? customer_snapshot : JSON.stringify(customer_snapshot || {});
    const termsStr = terms_and_conditions !== undefined
      ? (typeof terms_and_conditions === 'string' ? terms_and_conditions : JSON.stringify(terms_and_conditions))
      : null;

    let finalPaidAmount = 0;
    if (doc_type === 'INVOICE') {
      if (payment_status === 'PAID') {
        finalPaidAmount = totals.grandTotal;
      } else if (payment_status === 'PARTIAL') {
        finalPaidAmount = parseFloat(paid_amount) || 0;
      }
    }

    withTransaction(() => {
      // Ensure all items (including manual ones) exist in inventory
      for (const item of totals.items) {
        item.productId = ensureProductInInventory(db, item);
      }

      // Handle customer linking:
      // If payment is complete (PAID invoice), save the customer immediately
      let finalPhone: string | null = null;
      if (doc_type === 'INVOICE' && payment_status === 'PAID') {
        finalPhone = saveCustomerIfPaymentComplete(db, null, snapshot, customer_phone);
      } else if (customer_phone) {
        const normPhone = normalizePhone(customer_phone);
        // If not paid yet, link phone only if customer already exists in customers table
        const exists = db.prepare('SELECT phone FROM customers WHERE phone = ?').get(normPhone);
        if (exists) finalPhone = normPhone;
      }

      db.prepare(`
        INSERT INTO documents (id, doc_type, doc_number, doc_date, customer_phone, customer_snapshot,
          gross_subtotal, discount_pct, discount_amount, additional_discount, taxable_amount, cgst_total, sgst_total,
          round_off, grand_total, payment_mode, payment_status, selected_upi_id, notes, terms_and_conditions,
          hide_tax_on_invoice, paid_amount, partial_payment_mode)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(id, doc_type, doc_number, doc_date || new Date().toISOString().slice(0,10),
        finalPhone, snapshot, totals.grossSubtotal, totals.discountPct, totals.discountAmount, totals.additionalDiscount,
        totals.taxableAmount, totals.cgstTotal, totals.sgstTotal, totals.roundOff, totals.grandTotal,
        payment_mode, payment_status, selected_upi_id || null, notes || null, termsStr,
        hide_tax_on_invoice ? 1 : 0, finalPaidAmount, partial_payment_mode || (payment_status === 'PARTIAL' ? 'CASH' : null));

      const insertItem = db.prepare(`
        INSERT INTO document_items (id, document_id, product_id, product_name, hsn_sac, unit, quantity, unit_price, mrp,
          gross_amount, taxable_value, gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, total_amount, purchase_price)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `);
      for (const item of totals.items) {
        insertItem.run(randomUUID(), id, item.productId || null, item.productName, item.hsnSac || null,
          item.unit || 'PCS', item.quantity, item.unitPrice, item.mrp || 0, item.grossAmount, item.taxableValue,
          item.gstRate, item.cgstRate, item.cgstAmount, item.sgstRate, item.sgstAmount, item.totalAmount,
          item.purchasePrice || 0);
      }

      // If converted from quotation, remove the quotation from records!
      if (converting_quotation_id) {
        db.prepare(`DELETE FROM documents WHERE id = ? AND doc_type = 'QUOTATION'`).run(converting_quotation_id);
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

    const { items: rawItems, discount_pct = 0, additional_discount, payment_mode, payment_status, notes,
      terms_and_conditions, customer_phone, customer_snapshot, hide_tax_on_invoice,
      paid_amount, partial_payment_mode } = (req.body || {}) as any;
    if (!rawItems?.length) return reply.status(400).send({ error: 'items required' });

    const finalAdditionalDiscount = additional_discount !== undefined ? (parseFloat(additional_discount) || 0) : (existing.additional_discount || 0);
    const totals = calculateInvoiceTotals(rawItems, discount_pct, finalAdditionalDiscount);
    const newStatus = payment_status || existing.payment_status;

    // Enforce loss prevention: grand total must not be lower than total purchase cost
    let totalPurchaseCost = 0;
    for (const item of rawItems) {
      const pp = parseFloat(item.purchasePrice || 0);
      const qty = parseFloat(item.quantity || 0);
      if (pp > 0 && qty > 0) {
        totalPurchaseCost += pp * qty;
      }
    }
    if (totalPurchaseCost > 0 && totals.grandTotal < totalPurchaseCost - 0.01) {
      return reply.status(400).send({
        error: `Discounts cannot exceed allowable limit: Grand total (₹${totals.grandTotal.toFixed(2)}) is lower than total purchase cost (₹${totalPurchaseCost.toFixed(2)}). Loss is not allowed.`
      });
    }

    // Enforce stock restrictions if enabled
    if (existing.doc_type === 'INVOICE' && newStatus !== 'CANCELLED') {
      const stockErr = validateStockLimits(db, totals.items, req.params.id);
      if (stockErr) return reply.status(400).send({ error: stockErr });
    }

    const termsStr = terms_and_conditions !== undefined
      ? (typeof terms_and_conditions === 'string' ? terms_and_conditions : JSON.stringify(terms_and_conditions))
      : existing.terms_and_conditions;

    let finalPaidAmount = existing.paid_amount || 0;
    if (existing.doc_type === 'INVOICE') {
      if (newStatus === 'PAID') {
        finalPaidAmount = totals.grandTotal;
      } else if (newStatus === 'PARTIAL') {
        finalPaidAmount = paid_amount !== undefined ? (parseFloat(paid_amount) || 0) : (existing.paid_amount || 0);
      } else {
        finalPaidAmount = 0;
      }
    }

    withTransaction(() => {
      // Ensure all items (including manual ones) exist in inventory
      for (const item of totals.items) {
        item.productId = ensureProductInInventory(db, item);
      }

      // Reconcile stock if it's an invoice
      if (existing.doc_type === 'INVOICE') {
        reconcileStockOnEdit(req.params.id, totals.items.map((i: any) => ({ productId: i.productId, quantity: i.quantity })));
      }

      let finalPhone = customer_phone || existing.customer_phone;
      if (existing.doc_type === 'INVOICE' && newStatus === 'PAID') {
        finalPhone = saveCustomerIfPaymentComplete(db, null, customer_snapshot || existing.customer_snapshot, finalPhone);
      } else if (finalPhone) {
        const exists = db.prepare('SELECT phone FROM customers WHERE phone = ?').get(finalPhone);
        if (!exists) finalPhone = null;
      }

      db.prepare(`
        UPDATE documents SET customer_phone=?, customer_snapshot=?, gross_subtotal=?, discount_pct=?,
          discount_amount=?, additional_discount=?, taxable_amount=?, cgst_total=?, sgst_total=?, round_off=?, grand_total=?,
          payment_mode=?, payment_status=?, notes=?, terms_and_conditions=?, hide_tax_on_invoice=?,
          paid_amount=?, partial_payment_mode=?, revision_number=revision_number+1, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).run(finalPhone,
        typeof customer_snapshot === 'string' ? customer_snapshot : JSON.stringify(customer_snapshot || JSON.parse(existing.customer_snapshot)),
        totals.grossSubtotal, totals.discountPct, totals.discountAmount, totals.additionalDiscount, totals.taxableAmount,
        totals.cgstTotal, totals.sgstTotal, totals.roundOff, totals.grandTotal,
        payment_mode || existing.payment_mode, newStatus,
        notes ?? existing.notes, termsStr, hide_tax_on_invoice !== undefined ? (hide_tax_on_invoice ? 1 : 0) : existing.hide_tax_on_invoice || 0,
        finalPaidAmount, partial_payment_mode !== undefined ? partial_payment_mode : existing.partial_payment_mode,
        req.params.id);

      db.prepare(`DELETE FROM document_items WHERE document_id = ?`).run(req.params.id);
      const insertItem = db.prepare(`
        INSERT INTO document_items (id, document_id, product_id, product_name, hsn_sac, unit, quantity, unit_price, mrp,
          gross_amount, taxable_value, gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, total_amount, purchase_price)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `);
      for (const item of totals.items) {
        insertItem.run(randomUUID(), req.params.id, item.productId || null, item.productName,
          item.hsnSac || null, item.unit || 'PCS', item.quantity, item.unitPrice, item.mrp || 0, item.grossAmount, item.taxableValue,
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
  app.patch<{ Params: { id: string }; Body: { payment_status: string; payment_mode?: string; paid_amount?: number; partial_payment_mode?: string } }>(
    '/api/documents/:id/status', (req, reply) => {
      const { payment_status, payment_mode, paid_amount, partial_payment_mode } = req.body;
      const db = getDb();
      const existing = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(req.params.id) as any;
      if (!existing) return reply.status(404).send({ error: 'Document not found' });

      withTransaction(() => {
        let finalPaid = existing.paid_amount || 0;
        if (payment_status === 'PAID') {
          finalPaid = existing.grand_total;
          saveCustomerIfPaymentComplete(db, req.params.id, existing.customer_snapshot, existing.customer_phone);
        } else if (payment_status === 'PARTIAL' && paid_amount !== undefined) {
          finalPaid = parseFloat(paid_amount as any) || 0;
        }

        db.prepare(`UPDATE documents SET payment_status=?, payment_mode=COALESCE(?,payment_mode), paid_amount=?, partial_payment_mode=COALESCE(?,partial_payment_mode), updated_at=CURRENT_TIMESTAMP WHERE id=?`)
          .run(payment_status, payment_mode || null, finalPaid, partial_payment_mode || null, req.params.id);
      });
      return reply.send(db.prepare(`SELECT * FROM documents WHERE id = ?`).get(req.params.id));
    }
  );

  // POST /api/documents/:id/convert - Convert Quotation to Invoice
  app.post<{ Params: { id: string }; Body: { payment_mode?: string; payment_status?: string; paid_amount?: number; partial_payment_mode?: string } }>(
    '/api/documents/:id/convert', (req, reply) => {
      const db = getDb();
      const quo: any = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(req.params.id);
      if (!quo) return reply.status(404).send({ error: 'Quotation not found' });
      if (quo.doc_type !== 'QUOTATION') return reply.status(400).send({ error: 'Document is not a quotation' });

      const items: any[] = db.prepare(`SELECT * FROM document_items WHERE document_id = ?`).all(req.params.id) as any[];
      const payment_mode = req.body?.payment_mode || 'CASH';
      const payment_status = req.body?.payment_status || 'PAID';
      const paid_amount = req.body?.paid_amount !== undefined ? req.body.paid_amount : (payment_status === 'PAID' ? quo.grand_total : 0);
      const partial_payment_mode = req.body?.partial_payment_mode || (payment_status === 'PARTIAL' ? 'CASH' : null);

      // Enforce stock restrictions if enabled
      if (payment_status !== 'CANCELLED') {
        const stockErr = validateStockLimits(db, items.map(i => ({ productId: i.product_id, quantity: i.quantity })));
        if (stockErr) return reply.status(400).send({ error: stockErr });
      }

      const invoiceId = randomUUID();
      const invoiceNum = generateDocNumber(db, 'INVOICE');

      withTransaction(() => {
        deductStockForNewInvoice(items.map(i => ({
          productId: i.product_id,
          quantity: i.quantity,
          productName: i.product_name
        })));

        let finalPhone = quo.customer_phone;
        if (payment_status === 'PAID') {
          finalPhone = saveCustomerIfPaymentComplete(db, null, quo.customer_snapshot, quo.customer_phone);
        } else if (finalPhone) {
          const exists = db.prepare('SELECT phone FROM customers WHERE phone = ?').get(finalPhone);
          if (!exists) finalPhone = null;
        }

        db.prepare(`
          INSERT INTO documents (
            id, doc_type, doc_number, parent_doc_id, revision_number, doc_date,
            customer_phone, customer_snapshot, gross_subtotal, discount_pct, discount_amount,
            taxable_amount, cgst_total, sgst_total, round_off, grand_total,
            payment_mode, payment_status, selected_upi_id, notes, terms_and_conditions, hide_tax_on_invoice,
            paid_amount, partial_payment_mode
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          invoiceId, 'INVOICE', invoiceNum, null, 1, new Date().toISOString().split('T')[0],
          finalPhone, quo.customer_snapshot, quo.gross_subtotal, quo.discount_pct, quo.discount_amount,
          quo.taxable_amount, quo.cgst_total, quo.sgst_total, quo.round_off, quo.grand_total,
          payment_mode, payment_status, quo.selected_upi_id, quo.notes, quo.terms_and_conditions || null, quo.hide_tax_on_invoice || 0,
          paid_amount, partial_payment_mode
        );

        const insertItem = db.prepare(`
          INSERT INTO document_items (id, document_id, product_id, product_name, hsn_sac, unit, quantity, unit_price,
            gross_amount, taxable_value, gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, total_amount, purchase_price)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `);

        for (const item of items) {
          insertItem.run(
            randomUUID(), invoiceId, item.product_id, item.product_name, item.hsn_sac, item.unit || 'PCS',
            item.quantity, item.unit_price, item.gross_amount, item.taxable_value,
            item.gst_rate, item.cgst_rate, item.cgst_amount, item.sgst_rate, item.sgst_amount, item.total_amount,
            item.purchase_price || 0
          );
        }

        // Delete the quotation from records so it is removed
        db.prepare(`DELETE FROM documents WHERE id = ?`).run(quo.id);
      });

      const newInvoice = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(invoiceId);
      const newItems = db.prepare(`SELECT * FROM document_items WHERE document_id = ?`).all(invoiceId);
      return reply.status(201).send({ ...newInvoice as any, items: newItems });
    }
  );

  // DELETE /api/documents/:id - Delete quotation or document
  app.delete<{ Params: { id: string } }>('/api/documents/:id', (req, reply) => {
    const db = getDb();
    const doc = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(req.params.id) as any;
    if (!doc) return reply.status(404).send({ error: 'Document not found' });
    withTransaction(() => {
      if (doc.doc_type === 'INVOICE' && doc.payment_status !== 'CANCELLED') {
        restoreStockOnCancel(req.params.id);
      }
      db.prepare(`DELETE FROM documents WHERE id = ?`).run(req.params.id);
    });
    return reply.send({ success: true });
  });

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
