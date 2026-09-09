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
      SELECT * FROM customers
      WHERE phone LIKE ? OR phone LIKE ? OR name LIKE ?
      ORDER BY name COLLATE NOCASE
      LIMIT 20
    `).all(`${q}%`, `${normQ}%`, `%${q}%`);
    return reply.send(rows);
  });

  // GET /api/customers
  app.get('/api/customers', (_req, reply) => {
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM customers ORDER BY name COLLATE NOCASE`).all();
    return reply.send(rows);
  });

  // GET /api/customers/:phone
  app.get<{ Params: { phone: string } }>('/api/customers/:phone', (req, reply) => {
    const db = getDb();
    const phone = normalizePhone(req.params.phone);
    const customer = db.prepare(`SELECT * FROM customers WHERE phone = ? OR phone = ?`).get(phone, req.params.phone);
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
}
