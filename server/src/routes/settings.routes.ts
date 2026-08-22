/**
 * settings.routes.ts - Phase 8: Seller Profile & Multi-UPI Manager
 */
import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';

export async function settingsRoutes(app: FastifyInstance) {
  // GET /api/settings/profile
  app.get('/api/settings/profile', (_req, reply) => {
    const db = getDb();
    const profile = db.prepare(`SELECT * FROM seller_profile WHERE id = 1`).get();
    const upiAccounts = db.prepare(`SELECT * FROM seller_upi_accounts ORDER BY is_default DESC, label`).all();
    return reply.send({ profile, upiAccounts });
  });

  // PUT /api/settings/profile
  app.put<{ Body: any }>('/api/settings/profile', (req, reply) => {
    const db = getDb();
    const {
      business_name, trade_name, gstin, pan, phone, email,
      address_line1, address_line2, city, state_code, pincode,
      bank_name, bank_account_no, bank_ifsc, bank_branch, active_upi_id
    } = req.body;
    db.prepare(`
      UPDATE seller_profile SET
        business_name=?, trade_name=?, gstin=?, pan=?, phone=?, email=?,
        address_line1=?, address_line2=?, city=?, state_code=?, pincode=?,
        bank_name=?, bank_account_no=?, bank_ifsc=?, bank_branch=?, active_upi_id=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=1
    `).run(business_name, trade_name||null, gstin, pan||null, phone, email||null,
      address_line1, address_line2||null, city, state_code, pincode,
      bank_name||null, bank_account_no||null, bank_ifsc||null, bank_branch||null, active_upi_id||null);
    return reply.send(db.prepare(`SELECT * FROM seller_profile WHERE id=1`).get());
  });

  // POST /api/settings/upi - add UPI account
  app.post<{ Body: any }>('/api/settings/upi', (req, reply) => {
    const db = getDb();
    const { upi_id, payee_name, label, is_default } = req.body;
    if (!upi_id || !payee_name || !label) return reply.status(400).send({ error: 'upi_id, payee_name, label required' });
    const id = randomUUID();
    if (is_default) db.prepare(`UPDATE seller_upi_accounts SET is_default=0`).run();
    db.prepare(`INSERT INTO seller_upi_accounts (id, upi_id, payee_name, label, is_default) VALUES (?,?,?,?,?)`)
      .run(id, upi_id, payee_name, label, is_default ? 1 : 0);
    return reply.status(201).send(db.prepare(`SELECT * FROM seller_upi_accounts WHERE id=?`).get(id));
  });

  // PUT /api/settings/upi/:id
  app.put<{ Params: { id: string }; Body: any }>('/api/settings/upi/:id', (req, reply) => {
    const db = getDb();
    const { upi_id, payee_name, label, is_default } = req.body;
    if (is_default) db.prepare(`UPDATE seller_upi_accounts SET is_default=0`).run();
    db.prepare(`UPDATE seller_upi_accounts SET upi_id=?,payee_name=?,label=?,is_default=? WHERE id=?`)
      .run(upi_id, payee_name, label, is_default ? 1 : 0, req.params.id);
    return reply.send(db.prepare(`SELECT * FROM seller_upi_accounts WHERE id=?`).get(req.params.id));
  });

  // DELETE /api/settings/upi/:id
  app.delete<{ Params: { id: string } }>('/api/settings/upi/:id', (req, reply) => {
    getDb().prepare(`DELETE FROM seller_upi_accounts WHERE id=?`).run(req.params.id);
    return reply.send({ success: true });
  });
}
