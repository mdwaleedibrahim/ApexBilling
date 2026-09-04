/**
 * csv-importer.service.ts
 * Phase 3: CSV Batch Stream Parser with SQLite UPSERT logic
 */

import { getDb, withTransaction } from '../db/database.js';
import { randomUUID } from 'crypto';

export interface CsvProductRow {
  sku: string;
  name: string;
  hsn_sac?: string;
  unit?: string;
  purchase_price?: number;
  selling_price: number;
  tax_rate?: number;
  stock_qty?: number;
}

export interface ImportResult {
  inserted: number;
  updated: number;
  errors: Array<{ row: number; message: string }>;
  totalRows: number;
}

/**
 * Parse CSV text into product rows.
 * Expected headers (case-insensitive):
 * sku, name, hsn_sac, unit, purchase_price, selling_price, tax_rate, stock_qty
 */
export function parseCsvText(csvText: string): { rows: CsvProductRow[]; errors: Array<{ row: number; message: string }> } {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  if (lines.length < 2) return { rows: [], errors: [{ row: 0, message: 'CSV must have a header row and at least one data row.' }] };

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows: CsvProductRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 2) continue;

    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = cols[idx] || ''; });

    if (!obj['sku'] || !obj['name']) {
      errors.push({ row: i + 1, message: `Row ${i + 1}: missing required fields sku or name.` });
      continue;
    }
    const sellingPrice = parseFloat(obj['selling_price'] || '0');
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      errors.push({ row: i + 1, message: `Row ${i + 1}: invalid selling_price.` });
      continue;
    }

    rows.push({
      sku: obj['sku'],
      name: obj['name'],
      hsn_sac: obj['hsn_sac'] || undefined,
      unit: obj['unit'] || 'PCS',
      purchase_price: parseFloat(obj['purchase_price'] || '0') || 0,
      selling_price: sellingPrice,
      tax_rate: parseFloat(obj['tax_rate'] || '18') || 18,
      stock_qty: parseInt(obj['stock_qty'] || '0', 10) || 0,
    });
  }

  return { rows, errors };
}

/**
 * Upsert parsed rows into the products table.
 * ON CONFLICT(sku): update fields, ADD new stock_qty to existing.
 */
export function upsertProducts(rows: CsvProductRow[]): ImportResult {
  const db = getDb();
  let inserted = 0;
  let updated = 0;
  const errors: Array<{ row: number; message: string }> = [];

  const checkExisting = db.prepare(`SELECT id FROM products WHERE sku = ?`);
  const insertStmt = db.prepare(`
    INSERT INTO products (id, sku, name, hsn_sac, unit, purchase_price, selling_price, tax_rate, stock_qty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateStmt = db.prepare(`
    UPDATE products SET
      name = ?, hsn_sac = ?, unit = ?, purchase_price = ?, selling_price = ?, tax_rate = ?,
      stock_qty = stock_qty + ?, updated_at = CURRENT_TIMESTAMP
    WHERE sku = ?
  `);

  withTransaction(() => {
    rows.forEach((row, idx) => {
      try {
        const existing = checkExisting.get(row.sku) as { id: string } | undefined;
        if (existing) {
          updateStmt.run(row.name, row.hsn_sac || null, row.unit || 'PCS', row.purchase_price || 0,
            row.selling_price, row.tax_rate ?? 18, row.stock_qty || 0, row.sku);
          updated++;
        } else {
          insertStmt.run(randomUUID(), row.sku, row.name, row.hsn_sac || null, row.unit || 'PCS',
            row.purchase_price || 0, row.selling_price, row.tax_rate ?? 18, row.stock_qty || 0);
          inserted++;
        }
      } catch (e: any) {
        errors.push({ row: idx + 2, message: e.message });
      }
    });
  });

  return { inserted, updated, errors, totalRows: rows.length };
}
