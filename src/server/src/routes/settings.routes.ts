/**
 * settings.routes.ts - Phase 8: Multi-Seller GST Profiles, Bank Accounts & UPI Manager
 */
import type { FastifyInstance } from 'fastify';
import { getDb, withTransaction } from '../db/database.js';
import { randomUUID } from 'crypto';

export async function settingsRoutes(app: FastifyInstance) {
  // ── Multi-Seller Profiles ──────────────────────────────────────────────────

  // GET /api/settings/profiles - List all seller profiles, bank accounts, UPI accounts & store settings
  app.get('/api/settings/profiles', (_req, reply) => {
    const db = getDb();
    const profiles = db.prepare(`
      SELECT sp.*, sba.account_number as linked_account_number, sba.bank_name as linked_bank_name
      FROM seller_profiles sp
      LEFT JOIN seller_bank_accounts sba ON sp.bank_account_id = sba.id
      ORDER BY sp.is_default DESC, sp.created_at ASC
    `).all() as any[];

    const bankAccounts = db.prepare(`
      SELECT * FROM seller_bank_accounts ORDER BY is_default DESC, created_at ASC
    `).all() as any[];

    const upiAccounts = db.prepare(`
      SELECT * FROM seller_upi_accounts ORDER BY is_default DESC, label ASC
    `).all() as any[];

    const storeSettings = db.prepare(`SELECT * FROM seller_profile WHERE id = 1`).get() as any;

    return reply.send({ profiles, bankAccounts, upiAccounts, storeSettings });
  });

  // POST /api/settings/profiles - Create a new Seller GST Profile
  app.post<{ Body: any }>('/api/settings/profiles', (req, reply) => {
    const db = getDb();
    const {
      business_name, trade_name, gstin, pan, phone, email,
      address_line1, address_line2, city, state_code, pincode,
      bank_account_id, active_upi_id, is_default
    } = (req.body || {}) as any;

    if (!business_name || !gstin || !phone || !address_line1 || !city || !pincode) {
      return reply.status(400).send({ error: 'Business name, GSTIN, phone, address, city, and pincode are required.' });
    }

    const id = randomUUID();
    const existingCount = (db.prepare(`SELECT COUNT(*) as c FROM seller_profiles`).get() as any).c;
    const shouldBeDefault = is_default || existingCount === 0;

    let bank_name = null;
    let bank_account_no = null;
    let bank_ifsc = null;
    let bank_branch = null;

    if (bank_account_id) {
      const bank: any = db.prepare(`SELECT * FROM seller_bank_accounts WHERE id = ?`).get(bank_account_id);
      if (bank) {
        bank_name = bank.bank_name;
        bank_account_no = bank.account_number;
        bank_ifsc = bank.ifsc_code;
        bank_branch = bank.branch_name;
      }
    }

    withTransaction(() => {
      if (shouldBeDefault) {
        db.prepare(`UPDATE seller_profiles SET is_default = 0`).run();
      }

      db.prepare(`
        INSERT INTO seller_profiles (
          id, business_name, trade_name, gstin, pan, phone, email,
          address_line1, address_line2, city, state_code, pincode,
          bank_account_id, bank_name, bank_account_no, bank_ifsc, bank_branch,
          active_upi_id, is_default, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
      `).run(
        id, business_name.trim(), trade_name?.trim() || null, gstin.trim().toUpperCase(), pan?.trim()?.toUpperCase() || null,
        phone.trim(), email?.trim() || null, address_line1.trim(), address_line2?.trim() || null,
        city.trim(), state_code || '36', pincode.trim(),
        bank_account_id || null, bank_name, bank_account_no, bank_ifsc, bank_branch,
        active_upi_id || null, shouldBeDefault ? 1 : 0
      );
    });

    return reply.status(201).send(db.prepare(`SELECT * FROM seller_profiles WHERE id = ?`).get(id));
  });

  // PUT /api/settings/profiles/:id - Update specific Seller GST Profile
  app.put<{ Params: { id: string }; Body: any }>('/api/settings/profiles/:id', (req, reply) => {
    const db = getDb();
    const existing = db.prepare(`SELECT * FROM seller_profiles WHERE id = ?`).get(req.params.id) as any;
    if (!existing) return reply.status(404).send({ error: 'Seller profile not found' });

    const {
      business_name, trade_name, gstin, pan, phone, email,
      address_line1, address_line2, city, state_code, pincode,
      bank_account_id, active_upi_id, is_default
    } = (req.body || {}) as any;

    let bank_name = existing.bank_name;
    let bank_account_no = existing.bank_account_no;
    let bank_ifsc = existing.bank_ifsc;
    let bank_branch = existing.bank_branch;

    if (bank_account_id !== undefined) {
      if (bank_account_id) {
        const bank: any = db.prepare(`SELECT * FROM seller_bank_accounts WHERE id = ?`).get(bank_account_id);
        if (bank) {
          bank_name = bank.bank_name;
          bank_account_no = bank.account_number;
          bank_ifsc = bank.ifsc_code;
          bank_branch = bank.branch_name;
        }
      } else {
        bank_name = null;
        bank_account_no = null;
        bank_ifsc = null;
        bank_branch = null;
      }
    }

    withTransaction(() => {
      if (is_default) {
        db.prepare(`UPDATE seller_profiles SET is_default = 0`).run();
      }

      db.prepare(`
        UPDATE seller_profiles SET
          business_name = COALESCE(?, business_name),
          trade_name = ?,
          gstin = COALESCE(?, gstin),
          pan = ?,
          phone = COALESCE(?, phone),
          email = ?,
          address_line1 = COALESCE(?, address_line1),
          address_line2 = ?,
          city = COALESCE(?, city),
          state_code = COALESCE(?, state_code),
          pincode = COALESCE(?, pincode),
          bank_account_id = ?,
          bank_name = ?,
          bank_account_no = ?,
          bank_ifsc = ?,
          bank_branch = ?,
          active_upi_id = ?,
          is_default = CASE WHEN ? = 1 THEN 1 ELSE is_default END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        business_name?.trim() || null,
        trade_name !== undefined ? (trade_name?.trim() || null) : existing.trade_name,
        gstin?.trim()?.toUpperCase() || null,
        pan !== undefined ? (pan?.trim()?.toUpperCase() || null) : existing.pan,
        phone?.trim() || null,
        email !== undefined ? (email?.trim() || null) : existing.email,
        address_line1?.trim() || null,
        address_line2 !== undefined ? (address_line2?.trim() || null) : existing.address_line2,
        city?.trim() || null,
        state_code || null,
        pincode?.trim() || null,
        bank_account_id !== undefined ? (bank_account_id || null) : existing.bank_account_id,
        bank_name,
        bank_account_no,
        bank_ifsc,
        bank_branch,
        active_upi_id !== undefined ? (active_upi_id || null) : existing.active_upi_id,
        is_default ? 1 : 0,
        req.params.id
      );
    });

    return reply.send(db.prepare(`SELECT * FROM seller_profiles WHERE id = ?`).get(req.params.id));
  });

  // DELETE /api/settings/profiles/:id - Delete Seller GST Profile
  app.delete<{ Params: { id: string } }>('/api/settings/profiles/:id', (req, reply) => {
    const db = getDb();
    const count = (db.prepare(`SELECT COUNT(*) as c FROM seller_profiles`).get() as any).c;
    if (count <= 1) {
      return reply.status(400).send({ error: 'Cannot delete the only seller profile. At least one profile must exist.' });
    }

    const existing: any = db.prepare(`SELECT * FROM seller_profiles WHERE id = ?`).get(req.params.id);
    if (!existing) return reply.status(404).send({ error: 'Profile not found' });

    withTransaction(() => {
      db.prepare(`DELETE FROM seller_profiles WHERE id = ?`).run(req.params.id);
      if (existing.is_default) {
        const remaining: any = db.prepare(`SELECT id FROM seller_profiles ORDER BY created_at ASC LIMIT 1`).get();
        if (remaining) {
          db.prepare(`UPDATE seller_profiles SET is_default = 1 WHERE id = ?`).run(remaining.id);
        }
      }
    });

    return reply.send({ success: true });
  });

  // ── Saved Bank Accounts ────────────────────────────────────────────────────

  // GET /api/settings/bank-accounts - List all saved bank accounts
  app.get('/api/settings/bank-accounts', (_req, reply) => {
    const db = getDb();
    return reply.send(db.prepare(`SELECT * FROM seller_bank_accounts ORDER BY is_default DESC, created_at ASC`).all());
  });

  // POST /api/settings/bank-accounts - Create saved bank account
  app.post<{ Body: any }>('/api/settings/bank-accounts', (req, reply) => {
    const db = getDb();
    const { bank_name, account_number, ifsc_code, branch_name, account_holder, is_default } = (req.body || {}) as any;

    if (!bank_name || !account_number || !ifsc_code) {
      return reply.status(400).send({ error: 'Bank name, account number, and IFSC code are required.' });
    }

    const id = randomUUID();
    const existingCount = (db.prepare(`SELECT COUNT(*) as c FROM seller_bank_accounts`).get() as any).c;
    const shouldBeDefault = is_default || existingCount === 0;

    withTransaction(() => {
      if (shouldBeDefault) {
        db.prepare(`UPDATE seller_bank_accounts SET is_default = 0`).run();
      }

      db.prepare(`
        INSERT INTO seller_bank_accounts (id, bank_name, account_number, ifsc_code, branch_name, account_holder, is_default, updated_at)
        VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
      `).run(
        id, bank_name.trim(), account_number.trim(), ifsc_code.trim().toUpperCase(),
        branch_name?.trim() || null, account_holder?.trim() || null, shouldBeDefault ? 1 : 0
      );
    });

    return reply.status(201).send(db.prepare(`SELECT * FROM seller_bank_accounts WHERE id = ?`).get(id));
  });

  // PUT /api/settings/bank-accounts/:id - Update saved bank account
  app.put<{ Params: { id: string }; Body: any }>('/api/settings/bank-accounts/:id', (req, reply) => {
    const db = getDb();
    const { bank_name, account_number, ifsc_code, branch_name, account_holder, is_default } = (req.body || {}) as any;

    withTransaction(() => {
      if (is_default) {
        db.prepare(`UPDATE seller_bank_accounts SET is_default = 0`).run();
      }

      db.prepare(`
        UPDATE seller_bank_accounts SET
          bank_name = COALESCE(?, bank_name),
          account_number = COALESCE(?, account_number),
          ifsc_code = COALESCE(?, ifsc_code),
          branch_name = ?,
          account_holder = ?,
          is_default = CASE WHEN ? = 1 THEN 1 ELSE is_default END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        bank_name?.trim() || null,
        account_number?.trim() || null,
        ifsc_code?.trim()?.toUpperCase() || null,
        branch_name !== undefined ? (branch_name?.trim() || null) : null,
        account_holder !== undefined ? (account_holder?.trim() || null) : null,
        is_default ? 1 : 0,
        req.params.id
      );

      // Sync linked seller profiles
      db.prepare(`
        UPDATE seller_profiles SET
          bank_name = COALESCE(?, bank_name),
          bank_account_no = COALESCE(?, bank_account_no),
          bank_ifsc = COALESCE(?, bank_ifsc),
          bank_branch = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE bank_account_id = ?
      `).run(
        bank_name?.trim() || null,
        account_number?.trim() || null,
        ifsc_code?.trim()?.toUpperCase() || null,
        branch_name !== undefined ? (branch_name?.trim() || null) : null,
        req.params.id
      );
    });

    return reply.send(db.prepare(`SELECT * FROM seller_bank_accounts WHERE id = ?`).get(req.params.id));
  });

  // DELETE /api/settings/bank-accounts/:id - Delete saved bank account
  app.delete<{ Params: { id: string } }>('/api/settings/bank-accounts/:id', (req, reply) => {
    const db = getDb();
    withTransaction(() => {
      db.prepare(`UPDATE seller_profiles SET bank_account_id = NULL WHERE bank_account_id = ?`).run(req.params.id);
      db.prepare(`DELETE FROM seller_bank_accounts WHERE id = ?`).run(req.params.id);
    });
    return reply.send({ success: true });
  });

  // ── Global Store Preferences ───────────────────────────────────────────────

  // PUT /api/settings/store-preferences - Update store toggles and global terms
  app.put<{ Body: any }>('/api/settings/store-preferences', (req, reply) => {
    const db = getDb();
    const {
      enable_scan_to_pay, show_purchase_price_in_pos, show_profit_loss_in_pos,
      show_profit_in_records, restrict_sales_to_stock_qty,
      invoice_terms, quotation_terms
    } = (req.body || {}) as any;

    const invoiceTermsStr = invoice_terms !== undefined
      ? (typeof invoice_terms === 'string' ? invoice_terms : JSON.stringify(invoice_terms))
      : undefined;
    const quotationTermsStr = quotation_terms !== undefined
      ? (typeof quotation_terms === 'string' ? quotation_terms : JSON.stringify(quotation_terms))
      : undefined;

    const current = db.prepare(`SELECT invoice_terms, quotation_terms FROM seller_profile WHERE id=1`).get() as any;

    db.prepare(`
      UPDATE seller_profile SET
        enable_scan_to_pay = COALESCE(?, enable_scan_to_pay),
        show_purchase_price_in_pos = COALESCE(?, show_purchase_price_in_pos),
        show_profit_loss_in_pos = COALESCE(?, show_profit_loss_in_pos),
        show_profit_in_records = COALESCE(?, show_profit_in_records),
        restrict_sales_to_stock_qty = COALESCE(?, restrict_sales_to_stock_qty),
        invoice_terms = COALESCE(?, invoice_terms),
        quotation_terms = COALESCE(?, quotation_terms),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(
      enable_scan_to_pay !== undefined ? (enable_scan_to_pay ? 1 : 0) : null,
      show_purchase_price_in_pos !== undefined ? (show_purchase_price_in_pos ? 1 : 0) : null,
      show_profit_loss_in_pos !== undefined ? (show_profit_loss_in_pos ? 1 : 0) : null,
      show_profit_in_records !== undefined ? (show_profit_in_records ? 1 : 0) : null,
      restrict_sales_to_stock_qty !== undefined ? (restrict_sales_to_stock_qty ? 1 : 0) : null,
      invoiceTermsStr !== undefined ? invoiceTermsStr : (current?.invoice_terms || null),
      quotationTermsStr !== undefined ? quotationTermsStr : (current?.quotation_terms || null)
    );

    return reply.send(db.prepare(`SELECT * FROM seller_profile WHERE id = 1`).get());
  });

  // ── Backward Compatible Profile Endpoints ─────────────────────────────────

  // GET /api/settings/profile
  app.get('/api/settings/profile', (_req, reply) => {
    const db = getDb();
    let profile: any = db.prepare(`SELECT * FROM seller_profiles WHERE is_default = 1 LIMIT 1`).get() ||
                       db.prepare(`SELECT * FROM seller_profiles LIMIT 1`).get() ||
                       db.prepare(`SELECT * FROM seller_profile WHERE id = 1`).get();

    const storeSettings: any = db.prepare(`SELECT * FROM seller_profile WHERE id = 1`).get() || {};
    const upiAccounts: any[] = db.prepare(`SELECT * FROM seller_upi_accounts ORDER BY is_default DESC, label`).all() as any[];

    if (profile && storeSettings) {
      profile = {
        ...profile,
        enable_scan_to_pay: storeSettings.enable_scan_to_pay,
        show_purchase_price_in_pos: storeSettings.show_purchase_price_in_pos,
        show_profit_loss_in_pos: storeSettings.show_profit_loss_in_pos,
        show_profit_in_records: storeSettings.show_profit_in_records,
        restrict_sales_to_stock_qty: storeSettings.restrict_sales_to_stock_qty,
        invoice_terms: storeSettings.invoice_terms,
        quotation_terms: storeSettings.quotation_terms,
      };
    }

    if (profile && !profile.active_upi_id && upiAccounts.length > 0) {
      const defaultAcc = upiAccounts.find(a => a.is_default) || upiAccounts[0];
      if (defaultAcc) {
        profile.active_upi_id = defaultAcc.upi_id;
        try {
          db.prepare(`UPDATE seller_profiles SET active_upi_id = ? WHERE id = ?`).run(defaultAcc.upi_id, profile.id);
        } catch {}
      }
    }

    return reply.send({ profile, upiAccounts, storeSettings });
  });

  // PUT /api/settings/profile
  app.put<{ Body: any }>('/api/settings/profile', (req, reply) => {
    const db = getDb();
    const {
      business_name, trade_name, gstin, pan, phone, email,
      address_line1, address_line2, city, state_code, pincode,
      bank_name, bank_account_no, bank_ifsc, bank_branch, active_upi_id, enable_scan_to_pay,
      show_purchase_price_in_pos, show_profit_loss_in_pos, show_profit_in_records, restrict_sales_to_stock_qty,
      invoice_terms, quotation_terms
    } = (req.body || {}) as any;

    const invoiceTermsStr = invoice_terms !== undefined
      ? (typeof invoice_terms === 'string' ? invoice_terms : JSON.stringify(invoice_terms))
      : undefined;
    const quotationTermsStr = quotation_terms !== undefined
      ? (typeof quotation_terms === 'string' ? quotation_terms : JSON.stringify(quotation_terms))
      : undefined;

    const current = db.prepare(`SELECT invoice_terms, quotation_terms FROM seller_profile WHERE id=1`).get() as any;

    withTransaction(() => {
      // Update store settings row
      db.prepare(`
        UPDATE seller_profile SET
          business_name = COALESCE(?, business_name),
          trade_name = COALESCE(?, trade_name),
          gstin = COALESCE(?, gstin),
          pan = COALESCE(?, pan),
          phone = COALESCE(?, phone),
          email = COALESCE(?, email),
          address_line1 = COALESCE(?, address_line1),
          address_line2 = COALESCE(?, address_line2),
          city = COALESCE(?, city),
          state_code = COALESCE(?, state_code),
          pincode = COALESCE(?, pincode),
          bank_name = COALESCE(?, bank_name),
          bank_account_no = COALESCE(?, bank_account_no),
          bank_ifsc = COALESCE(?, bank_ifsc),
          bank_branch = COALESCE(?, bank_branch),
          active_upi_id = COALESCE(?, active_upi_id),
          enable_scan_to_pay = COALESCE(?, enable_scan_to_pay),
          show_purchase_price_in_pos = COALESCE(?, show_purchase_price_in_pos),
          show_profit_loss_in_pos = COALESCE(?, show_profit_loss_in_pos),
          show_profit_in_records = COALESCE(?, show_profit_in_records),
          restrict_sales_to_stock_qty = COALESCE(?, restrict_sales_to_stock_qty),
          invoice_terms = COALESCE(?, invoice_terms),
          quotation_terms = COALESCE(?, quotation_terms),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(
        business_name || null,
        trade_name !== undefined ? trade_name : null,
        gstin || null,
        pan !== undefined ? pan : null,
        phone || null,
        email !== undefined ? email : null,
        address_line1 || null,
        address_line2 !== undefined ? address_line2 : null,
        city || null,
        state_code || null,
        pincode || null,
        bank_name !== undefined ? bank_name : null,
        bank_account_no !== undefined ? bank_account_no : null,
        bank_ifsc !== undefined ? bank_ifsc : null,
        bank_branch !== undefined ? bank_branch : null,
        active_upi_id !== undefined ? active_upi_id : null,
        enable_scan_to_pay !== undefined ? (enable_scan_to_pay ? 1 : 0) : null,
        show_purchase_price_in_pos !== undefined ? (show_purchase_price_in_pos ? 1 : 0) : null,
        show_profit_loss_in_pos !== undefined ? (show_profit_loss_in_pos ? 1 : 0) : null,
        show_profit_in_records !== undefined ? (show_profit_in_records ? 1 : 0) : null,
        restrict_sales_to_stock_qty !== undefined ? (restrict_sales_to_stock_qty ? 1 : 0) : null,
        invoiceTermsStr !== undefined ? invoiceTermsStr : null,
        quotationTermsStr !== undefined ? quotationTermsStr : null
      );

      // Also update the default seller_profiles row if seller details were passed
      if (business_name || gstin || phone || address_line1) {
        const defaultProf: any = db.prepare(`SELECT id FROM seller_profiles WHERE is_default = 1 LIMIT 1`).get() ||
                                 db.prepare(`SELECT id FROM seller_profiles LIMIT 1`).get();
        if (defaultProf) {
          db.prepare(`
            UPDATE seller_profiles SET
              business_name = COALESCE(?, business_name),
              trade_name = COALESCE(?, trade_name),
              gstin = COALESCE(?, gstin),
              pan = COALESCE(?, pan),
              phone = COALESCE(?, phone),
              email = COALESCE(?, email),
              address_line1 = COALESCE(?, address_line1),
              address_line2 = COALESCE(?, address_line2),
              city = COALESCE(?, city),
              state_code = COALESCE(?, state_code),
              pincode = COALESCE(?, pincode),
              bank_name = COALESCE(?, bank_name),
              bank_account_no = COALESCE(?, bank_account_no),
              bank_ifsc = COALESCE(?, bank_ifsc),
              bank_branch = COALESCE(?, bank_branch),
              active_upi_id = COALESCE(?, active_upi_id),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            business_name || null, trade_name !== undefined ? trade_name : null,
            gstin || null, pan !== undefined ? pan : null,
            phone || null, email !== undefined ? email : null,
            address_line1 || null, address_line2 !== undefined ? address_line2 : null,
            city || null, state_code || null, pincode || null,
            bank_name !== undefined ? bank_name : null,
            bank_account_no !== undefined ? bank_account_no : null,
            bank_ifsc !== undefined ? bank_ifsc : null,
            bank_branch !== undefined ? bank_branch : null,
            active_upi_id !== undefined ? active_upi_id : null,
            defaultProf.id
          );
        }
      }
    });

    return reply.send(db.prepare(`SELECT * FROM seller_profile WHERE id=1`).get());
  });

  // ── UPI Accounts ───────────────────────────────────────────────────────────

  // POST /api/settings/upi - add UPI account
  app.post<{ Body: any }>('/api/settings/upi', (req, reply) => {
    const db = getDb();
    const { upi_id, payee_name, label, is_default } = (req.body || {}) as any;
    if (!upi_id || !payee_name || !label) return reply.status(400).send({ error: 'upi_id, payee_name, label required' });

    const id = randomUUID();
    const existingCount = (db.prepare(`SELECT COUNT(*) as c FROM seller_upi_accounts`).get() as any).c;
    const shouldBeDefault = is_default || existingCount === 0;

    withTransaction(() => {
      if (shouldBeDefault) {
        db.prepare(`UPDATE seller_upi_accounts SET is_default=0`).run();
        db.prepare(`UPDATE seller_profile SET active_upi_id=? WHERE id=1`).run(upi_id);
        db.prepare(`UPDATE seller_profiles SET active_upi_id=? WHERE is_default=1`).run(upi_id);
      }

      db.prepare(`INSERT INTO seller_upi_accounts (id, upi_id, payee_name, label, is_default) VALUES (?,?,?,?,?)`)
        .run(id, upi_id, payee_name, label, shouldBeDefault ? 1 : 0);
    });

    return reply.status(201).send(db.prepare(`SELECT * FROM seller_upi_accounts WHERE id=?`).get(id));
  });

  // PUT /api/settings/upi/:id
  app.put<{ Params: { id: string }; Body: any }>('/api/settings/upi/:id', (req, reply) => {
    const db = getDb();
    const { upi_id, payee_name, label, is_default } = (req.body || {}) as any;

    withTransaction(() => {
      if (is_default) {
        db.prepare(`UPDATE seller_upi_accounts SET is_default=0`).run();
        db.prepare(`UPDATE seller_profile SET active_upi_id=? WHERE id=1`).run(upi_id);
        db.prepare(`UPDATE seller_profiles SET active_upi_id=? WHERE is_default=1`).run(upi_id);
      }

      db.prepare(`UPDATE seller_upi_accounts SET upi_id=?,payee_name=?,label=?,is_default=? WHERE id=?`)
        .run(upi_id, payee_name, label, is_default ? 1 : 0, req.params.id);
    });

    return reply.send(db.prepare(`SELECT * FROM seller_upi_accounts WHERE id=?`).get(req.params.id));
  });

  // DELETE /api/settings/upi/:id
  app.delete<{ Params: { id: string } }>('/api/settings/upi/:id', (req, reply) => {
    const db = getDb();
    withTransaction(() => {
      db.prepare(`DELETE FROM seller_upi_accounts WHERE id=? OR upi_id=?`).run(req.params.id, req.params.id);

      // Fallback active_upi_id to remaining default or first account
      const remaining: any = db.prepare(`SELECT upi_id FROM seller_upi_accounts ORDER BY is_default DESC LIMIT 1`).get();
      db.prepare(`UPDATE seller_profile SET active_upi_id=? WHERE id=1`).run(remaining?.upi_id || null);
      db.prepare(`UPDATE seller_profiles SET active_upi_id=? WHERE is_default=1`).run(remaining?.upi_id || null);
    });

    return reply.send({ success: true });
  });
}
