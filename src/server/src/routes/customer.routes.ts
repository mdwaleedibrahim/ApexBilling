/**
 * customer.routes.ts - Phase 4: Customer Management API
 */
import type { FastifyInstance } from 'fastify';
import { getDb, withTransaction } from '../db/database.js';
import { randomUUID } from 'crypto';
import { normalizePhone } from '../utils/phoneHelper.js';

export async function customerRoutes(app: FastifyInstance) {
  // GET /api/customers/lookup?phone=...&name=... - Instant search for existing customer
  app.get<{ Querystring: { phone?: string; name?: string } }>('/api/customers/lookup', (req, reply) => {
    const db = getDb();
    const rawPhone = req.query.phone || '';
    const rawName = (req.query.name || '').trim();
    const normPhone = normalizePhone(rawPhone);

    let phoneMatch = null;
    if (normPhone && normPhone.length >= 7) {
      phoneMatch = db.prepare(`
        SELECT * FROM customers
        WHERE phone = ? OR phone LIKE ?
        LIMIT 1
      `).get(normPhone, `%${normPhone}%`);
    }

    let nameMatches: any[] = [];
    if (rawName && rawName.length >= 2) {
      nameMatches = db.prepare(`
        SELECT * FROM customers
        WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) OR name LIKE ?
        ORDER BY name COLLATE NOCASE
        LIMIT 5
      `).all(rawName, `%${rawName}%`);
    }

    return reply.send({ phoneMatch, nameMatches });
  });

  // GET /api/customers/search?q=:query
  app.get<{ Querystring: { q: string } }>('/api/customers/search', (req, reply) => {
    const q = (req.query.q || '').trim();
    const normQ = normalizePhone(q);
    const db = getDb();
    const rows = db.prepare(`
      SELECT c.*,
        COALESCE((
          SELECT SUM(d.grand_total - d.paid_amount)
          FROM documents d
          WHERE d.customer_phone = c.phone
            AND d.doc_type = 'INVOICE'
            AND d.payment_status IN ('UNPAID', 'PARTIAL')
        ), 0) AS outstanding_balance
      FROM customers c
      WHERE c.phone LIKE ? OR c.phone LIKE ? OR c.name LIKE ?
      ORDER BY c.name COLLATE NOCASE
      LIMIT 20
    `).all(`${q}%`, `${normQ}%`, `%${q}%`);
    return reply.send(rows);
  });

  // GET /api/customers
  app.get('/api/customers', (_req, reply) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT c.*,
        COALESCE((
          SELECT SUM(d.grand_total - d.paid_amount)
          FROM documents d
          WHERE d.customer_phone = c.phone
            AND d.doc_type = 'INVOICE'
            AND d.payment_status IN ('UNPAID', 'PARTIAL')
        ), 0) AS outstanding_balance
      FROM customers c
      ORDER BY c.name COLLATE NOCASE
    `).all();
    return reply.send(rows);
  });

  // GET /api/customers/:phone
  app.get<{ Params: { phone: string } }>('/api/customers/:phone', (req, reply) => {
    const db = getDb();
    const phone = normalizePhone(req.params.phone);
    const customer = db.prepare(`
      SELECT c.*,
        COALESCE((
          SELECT SUM(d.grand_total - d.paid_amount)
          FROM documents d
          WHERE d.customer_phone = c.phone
            AND d.doc_type = 'INVOICE'
            AND d.payment_status IN ('UNPAID', 'PARTIAL')
        ), 0) AS outstanding_balance
      FROM customers c
      WHERE c.phone = ? OR c.phone = ?
    `).get(phone, req.params.phone);
    if (!customer) return reply.status(404).send({ error: 'Customer not found' });
    return reply.send(customer);
  });

  // POST /api/customers - Create or upsert
  app.post<{ Body: any }>('/api/customers', (req, reply) => {
    const db = getDb();
    const { phone: rawPhone, name, email, gstin, billing_address, state_code } = (req.body || {}) as any;
    const phone = normalizePhone(rawPhone);
    if (!phone || !name) return reply.status(400).send({ error: 'phone and name are required' });
    db.prepare(`
      INSERT INTO customers (phone, name, email, gstin, billing_address, state_code)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET
        name = excluded.name, email = excluded.email, gstin = excluded.gstin,
        billing_address = excluded.billing_address, state_code = excluded.state_code,
        updated_at = CURRENT_TIMESTAMP
    `).run(phone, name, email || null, gstin || null, billing_address || null, state_code || '36');
    const customer = db.prepare(`SELECT * FROM customers WHERE phone = ?`).get(phone);
    return reply.status(201).send(customer);
  });

  // PUT /api/customers/:phone
  app.put<{ Params: { phone: string }; Body: any }>('/api/customers/:phone', (req, reply) => {
    const db = getDb();
    const phone = normalizePhone(req.params.phone);
    const { name, email, gstin, billing_address, state_code } = (req.body || {}) as any;
    db.prepare(`
      UPDATE customers SET name=?, email=?, gstin=?, billing_address=?, state_code=?, updated_at=CURRENT_TIMESTAMP
      WHERE phone=? OR phone=?
    `).run(name, email || null, gstin || null, billing_address || null, state_code || '36', phone, req.params.phone);
    return reply.send(db.prepare(`SELECT * FROM customers WHERE phone = ? OR phone = ?`).get(phone, req.params.phone));
  });

  // DELETE /api/customers/:phone
  app.delete<{ Params: { phone: string } }>('/api/customers/:phone', (req, reply) => {
    getDb().prepare(`DELETE FROM customers WHERE phone = ?`).run(req.params.phone);
    return reply.send({ success: true });
  });

  // GET /api/customers/:phone/invoices - Customer invoice history
  app.get<{ Params: { phone: string } }>('/api/customers/:phone/invoices', (req, reply) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, doc_type, doc_number, doc_date, grand_total, payment_status
      FROM documents WHERE customer_phone = ?
      ORDER BY doc_date DESC, created_at DESC
    `).all(req.params.phone);
    return reply.send(rows);
  });

  // GET /api/gstin/:gstin - Server-side GSTIN lookup proxy
  app.get<{ Params: { gstin: string } }>('/api/gstin/:gstin', async (req, reply) => {
    const gstin = (req.params.gstin || '').trim().toUpperCase();
    // Validate GSTIN format: 15-character alphanumeric
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
      return reply.status(400).send({ error: 'Invalid GSTIN format' });
    }

    // Extract state code from GSTIN (first 2 digits)
    const stateCode = gstin.slice(0, 2);

    // Try fetching from GST government portal
    const HEADERS: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://services.gst.gov.in',
      'Referer': 'https://services.gst.gov.in/services/searchtp',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
    };

    try {
      const res = await fetch(
        `https://services.gst.gov.in/services/api/search/taxpayerDetails?gstin=${gstin}`,
        { headers: HEADERS, signal: AbortSignal.timeout(5000) }
      );
      const raw = await res.text();
      try {
        const json = JSON.parse(raw);
        if (json?.taxpayerInfo || json?.lgnm) {
          const info = json.taxpayerInfo || json;
          return reply.send({
            gstin,
            stateCode,
            tradeName: info.tradeNam || info.trade_name || '',
            legalName: info.lgnm || info.legal_name || '',
            address: [info.pradr?.addr?.bnm, info.pradr?.addr?.st, info.pradr?.addr?.loc, info.pradr?.addr?.dst, info.pradr?.addr?.stcd]
              .filter(Boolean).join(', '),
            status: info.sts || '',
            source: 'gst.gov.in',
          });
        }
      } catch {}
      // Response not parseable or no useful data — still return state info
      return reply.send({ gstin, stateCode, tradeName: '', legalName: '', address: '', status: '', source: 'state_only' });
    } catch (err: any) {
      // Network error — still return state code so UI can populate state
      return reply.send({ gstin, stateCode, tradeName: '', legalName: '', address: '', status: '', source: 'offline', error: err.message });
    }
  });
}

