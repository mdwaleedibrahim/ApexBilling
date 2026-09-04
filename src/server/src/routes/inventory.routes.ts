/**
 * inventory.routes.ts - Phase 3: Inventory CRUD + CSV Import
 */
import type { FastifyInstance } from 'fastify';
import { getDb, withTransaction } from '../db/database.js';
import { parseCsvText, upsertProducts } from '../services/csv-importer.service.js';
import { randomUUID } from 'crypto';

export async function inventoryRoutes(app: FastifyInstance) {
  // GET /api/inventory - list all products
  app.get('/api/inventory', (_req, reply) => {
    const rows = getDb().prepare(`SELECT * FROM products ORDER BY name COLLATE NOCASE`).all();
    return reply.send(rows);
  });

  // GET /api/inventory/search?q=
  app.get<{ Querystring: { q: string } }>('/api/inventory/search', (req, reply) => {
    const q = (req.query.q || '').trim();
    const rows = getDb().prepare(`
      SELECT * FROM products WHERE sku LIKE ? OR name LIKE ?
      ORDER BY name COLLATE NOCASE LIMIT 30
    `).all(`${q}%`, `%${q}%`);
    return reply.send(rows);
  });

  // GET /api/inventory/:id
  app.get<{ Params: { id: string } }>('/api/inventory/:id', (req, reply) => {
    const p = getDb().prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id);
    if (!p) return reply.status(404).send({ error: 'Product not found' });
    return reply.send(p);
  });

  // POST /api/inventory - create product
  app.post<{ Body: any }>('/api/inventory', (req, reply) => {
    const db = getDb();
    const { sku, name, hsn_sac, unit, purchase_price, selling_price, tax_rate, stock_qty } = (req.body || {}) as any;
    if (!sku || !name || selling_price == null) return reply.status(400).send({ error: 'sku, name, selling_price required' });
    const id = randomUUID();
    db.prepare(`
      INSERT INTO products (id, sku, name, hsn_sac, unit, purchase_price, selling_price, tax_rate, stock_qty)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, sku, name, hsn_sac || null, unit || 'PCS', purchase_price || 0, selling_price, tax_rate ?? 18, stock_qty || 0);
    return reply.status(201).send(db.prepare(`SELECT * FROM products WHERE id = ?`).get(id));
  });

  // PUT /api/inventory/:id - update product
  app.put<{ Params: { id: string }; Body: any }>('/api/inventory/:id', (req, reply) => {
    const db = getDb();
    const { sku, name, hsn_sac, unit, purchase_price, selling_price, tax_rate, stock_qty } = (req.body || {}) as any;
    db.prepare(`
      UPDATE products SET sku=?, name=?, hsn_sac=?, unit=?, purchase_price=?, selling_price=?, tax_rate=?, stock_qty=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(sku, name, hsn_sac || null, unit || 'PCS', purchase_price || 0, selling_price, tax_rate ?? 18, stock_qty || 0, req.params.id);
    return reply.send(db.prepare(`SELECT * FROM products WHERE id = ?`).get(req.params.id));
  });

  // DELETE /api/inventory/:id
  app.delete<{ Params: { id: string } }>('/api/inventory/:id', (req, reply) => {
    getDb().prepare(`DELETE FROM products WHERE id = ?`).run(req.params.id);
    return reply.send({ success: true });
  });

  // POST /api/inventory/import-csv - CSV batch import
  app.post<{ Body: { csv: string } }>('/api/inventory/import-csv', (req, reply) => {
    const { csv } = req.body;
    if (!csv) return reply.status(400).send({ error: 'csv field required' });
    const { rows, errors: parseErrors } = parseCsvText(csv);
    const result = upsertProducts(rows);
    result.errors.push(...parseErrors);
    return reply.send(result);
  });
}
