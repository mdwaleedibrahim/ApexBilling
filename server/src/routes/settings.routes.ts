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
    let profile: any = db.prepare(`SELECT * FROM seller_profile WHERE id = 1`).get();
    const upiAccounts: any[] = db.prepare(`SELECT * FROM seller_upi_accounts ORDER BY is_default DESC, label`).all() as any[];

    // Auto-fallback active_upi_id to default UPI account if not explicitly set
    if (profile && !profile.active_upi_id && upiAccounts.length > 0) {
      const defaultAcc = upiAccounts.find(a => a.is_default) || upiAccounts[0];
      if (defaultAcc) {
        profile.active_upi_id = defaultAcc.upi_id;
        db.prepare(`UPDATE seller_profile SET active_upi_id = ? WHERE id = 1`).run(defaultAcc.upi_id);
      }
    }

    return reply.send({ profile, upiAccounts });
  });

  // PUT /api/settings/profile
  app.put<{ Body: any }>('/api/settings/profile', (req, reply) => {
    const db = getDb();
    const {
      business_name, trade_name, gstin, pan, phone, email,
      address_line1, address_line2, city, state_code, pincode,
      bank_name, bank_account_no, bank_ifsc, bank_branch, active_upi_id, enable_scan_to_pay,
      show_purchase_price_in_pos, show_profit_loss_in_pos
    } = (req.body || {}) as any;

    db.prepare(`
      UPDATE seller_profile SET
        business_name=?, trade_name=?, gstin=?, pan=?, phone=?, email=?,
        address_line1=?, address_line2=?, city=?, state_code=?, pincode=?,
        bank_name=?, bank_account_no=?, bank_ifsc=?, bank_branch=?, active_upi_id=?,
        enable_scan_to_pay=?, show_purchase_price_in_pos=?, show_profit_loss_in_pos=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=1
    `).run(business_name, trade_name||null, gstin, pan||null, phone, email||null,
      address_line1, address_line2||null, city, state_code, pincode,
      bank_name||null, bank_account_no||null, bank_ifsc||null, bank_branch||null,
      active_upi_id||null, enable_scan_to_pay !== undefined ? (enable_scan_to_pay ? 1 : 0) : 1,
      show_purchase_price_in_pos ? 1 : 0,
      show_profit_loss_in_pos !== undefined ? (show_profit_loss_in_pos ? 1 : 0) : 1);

    return reply.send(db.prepare(`SELECT * FROM seller_profile WHERE id=1`).get());
  });

  // POST /api/settings/upi - add UPI account
  app.post<{ Body: any }>('/api/settings/upi', (req, reply) => {
    const db = getDb();
    const { upi_id, payee_name, label, is_default } = (req.body || {}) as any;
    if (!upi_id || !payee_name || !label) return reply.status(400).send({ error: 'upi_id, payee_name, label required' });

    const id = randomUUID();
    const existingCount = (db.prepare(`SELECT COUNT(*) as c FROM seller_upi_accounts`).get() as any).c;
    const shouldBeDefault = is_default || existingCount === 0;

    if (shouldBeDefault) {
      db.prepare(`UPDATE seller_upi_accounts SET is_default=0`).run();
      db.prepare(`UPDATE seller_profile SET active_upi_id=? WHERE id=1`).run(upi_id);
    }

    db.prepare(`INSERT INTO seller_upi_accounts (id, upi_id, payee_name, label, is_default) VALUES (?,?,?,?,?)`)
      .run(id, upi_id, payee_name, label, shouldBeDefault ? 1 : 0);

    return reply.status(201).send(db.prepare(`SELECT * FROM seller_upi_accounts WHERE id=?`).get(id));
  });

  // PUT /api/settings/upi/:id
  app.put<{ Params: { id: string }; Body: any }>('/api/settings/upi/:id', (req, reply) => {
    const db = getDb();
    const { upi_id, payee_name, label, is_default } = (req.body || {}) as any;

    if (is_default) {
      db.prepare(`UPDATE seller_upi_accounts SET is_default=0`).run();
      db.prepare(`UPDATE seller_profile SET active_upi_id=? WHERE id=1`).run(upi_id);
    }

    db.prepare(`UPDATE seller_upi_accounts SET upi_id=?,payee_name=?,label=?,is_default=? WHERE id=?`)
      .run(upi_id, payee_name, label, is_default ? 1 : 0, req.params.id);

    return reply.send(db.prepare(`SELECT * FROM seller_upi_accounts WHERE id=?`).get(req.params.id));
  });

  // DELETE /api/settings/upi/:id
  app.delete<{ Params: { id: string } }>('/api/settings/upi/:id', (req, reply) => {
    const db = getDb();
    db.prepare(`DELETE FROM seller_upi_accounts WHERE id=? OR upi_id=?`).run(req.params.id, req.params.id);

    // Fallback active_upi_id to remaining default or first account
    const remaining: any = db.prepare(`SELECT upi_id FROM seller_upi_accounts ORDER BY is_default DESC LIMIT 1`).get();
    db.prepare(`UPDATE seller_profile SET active_upi_id=? WHERE id=1`).run(remaining?.upi_id || null);

    return reply.send({ success: true });
  });
}
