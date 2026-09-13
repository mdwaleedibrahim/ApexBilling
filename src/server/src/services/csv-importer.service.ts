/**
 * csv-importer.service.ts
 * Phase 3: CSV Batch Stream Parser & Exporter with SQLite UPSERT logic
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
  mrp?: number;
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
 * Parses a single CSV line according to RFC 4180 rules, handling quotes, commas within quotes, and escaped quotes.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Normalizes raw header strings into canonical field names.
 */
function normalizeHeader(raw: string): string {
  const clean = raw.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (clean === 'sku') return 'sku';
  if (['name', 'product_name', 'item_name', 'title'].includes(clean)) return 'name';
  if (['hsn_sac', 'hsn', 'sac', 'hsn_code', 'hsn_sac_code'].includes(clean)) return 'hsn_sac';
  if (['unit', 'uom'].includes(clean)) return 'unit';
  if (['purchase_price', 'cost_price', 'cost', 'buy_price', 'purchase'].includes(clean)) return 'purchase_price';
  if (['selling_price', 'price', 'sale_price', 'rate'].includes(clean)) return 'selling_price';
  if (['mrp', 'printed_mrp'].includes(clean)) return 'mrp';
  if (['tax_rate', 'gst_rate', 'gst', 'tax', 'gst_pct', 'tax_pct'].includes(clean)) return 'tax_rate';
  if (['stock_qty', 'stock', 'qty', 'quantity', 'current_stock'].includes(clean)) return 'stock_qty';
  return clean;
}

/**
 * Parse CSV text into product rows.
 * Expected headers (case-insensitive, accepts human names or snake_case):
 * SKU, Name, HSN/SAC, Unit, Purchase Price, Selling Price, MRP, GST %, Stock Qty
 */
export function parseCsvText(csvText: string): { rows: CsvProductRow[]; errors: Array<{ row: number; message: string }> } {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], errors: [{ row: 0, message: 'CSV must have a header row and at least one data row.' }] };

  const rawHeaders = parseCsvLine(lines[0]);
  const headers = rawHeaders.map(normalizeHeader);
  const rows: CsvProductRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) continue;

    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = cols[idx] !== undefined ? cols[idx] : ''; });

    if (!obj['sku'] || !obj['name']) {
      errors.push({ row: i + 1, message: `Row ${i + 1}: missing required fields SKU or Name.` });
      continue;
    }
    const priceStr = obj['selling_price'] || obj['price'] || '0';
    const sellingPrice = parseFloat(priceStr);
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      errors.push({ row: i + 1, message: `Row ${i + 1}: invalid Selling Price (${priceStr}).` });
      continue;
    }

    rows.push({
      sku: obj['sku'],
      name: obj['name'],
      hsn_sac: obj['hsn_sac'] || undefined,
      unit: obj['unit'] || 'PCS',
      purchase_price: parseFloat(obj['purchase_price'] || '0') || 0,
      selling_price: sellingPrice,
      mrp: parseFloat(obj['mrp'] || '0') || 0,
      tax_rate: parseFloat(obj['tax_rate'] || '18') || 18,
      stock_qty: parseInt(obj['stock_qty'] || '0', 10) || 0,
    });
  }

  return { rows, errors };
}

/**
 * Upsert parsed rows into the products table.
 * @param rows Product rows to upsert
 * @param stockMode 'replace' sets stock_qty to CSV value (default for bulk edit); 'add' adds to existing stock_qty
 */
export function upsertProducts(rows: CsvProductRow[], stockMode: 'replace' | 'add' = 'replace'): ImportResult {
  const db = getDb();
  let inserted = 0;
  let updated = 0;
  const errors: Array<{ row: number; message: string }> = [];

  const checkExisting = db.prepare(`SELECT id FROM products WHERE sku = ?`);
  const insertStmt = db.prepare(`
    INSERT INTO products (id, sku, name, hsn_sac, unit, purchase_price, selling_price, mrp, tax_rate, stock_qty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateStmt = stockMode === 'add'
    ? db.prepare(`
        UPDATE products SET
          name = ?, hsn_sac = ?, unit = ?, purchase_price = ?, selling_price = ?, mrp = ?, tax_rate = ?,
          stock_qty = stock_qty + ?, updated_at = CURRENT_TIMESTAMP
        WHERE sku = ?
      `)
    : db.prepare(`
        UPDATE products SET
          name = ?, hsn_sac = ?, unit = ?, purchase_price = ?, selling_price = ?, mrp = ?, tax_rate = ?,
          stock_qty = ?, updated_at = CURRENT_TIMESTAMP
        WHERE sku = ?
      `);

  withTransaction(() => {
    rows.forEach((row, idx) => {
      try {
        const existing = checkExisting.get(row.sku) as { id: string } | undefined;
        if (existing) {
          updateStmt.run(
            row.name,
            row.hsn_sac || null,
            row.unit || 'PCS',
            row.purchase_price || 0,
            row.selling_price,
            row.mrp || 0,
            row.tax_rate ?? 18,
            row.stock_qty || 0,
            row.sku
          );
          updated++;
        } else {
          insertStmt.run(
            randomUUID(),
            row.sku,
            row.name,
            row.hsn_sac || null,
            row.unit || 'PCS',
            row.purchase_price || 0,
            row.selling_price,
            row.mrp || 0,
            row.tax_rate ?? 18,
            row.stock_qty || 0
          );
          inserted++;
        }
      } catch (e: any) {
        errors.push({ row: idx + 2, message: e.message });
      }
    });
  });

  return { inserted, updated, errors, totalRows: rows.length };
}

/**
 * Exports all products as an RFC 4180-compliant CSV string.
 */
export function generateInventoryCsv(): string {
  const db = getDb();
  const rows = db.prepare(`
    SELECT sku, name, hsn_sac, unit, purchase_price, selling_price, mrp, tax_rate, stock_qty
    FROM products
    ORDER BY name COLLATE NOCASE
  `).all() as any[];

  const headers = ['SKU', 'Name', 'HSN/SAC', 'Unit', 'Purchase Price', 'Selling Price', 'MRP', 'GST %', 'Stock Qty'];

  const escapeCsv = (val: any) => {
    if (val == null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [headers.join(',')];
  for (const r of rows) {
    csvLines.push([
      escapeCsv(r.sku),
      escapeCsv(r.name),
      escapeCsv(r.hsn_sac || ''),
      escapeCsv(r.unit || 'PCS'),
      escapeCsv(r.purchase_price ?? 0),
      escapeCsv(r.selling_price ?? 0),
      escapeCsv(r.mrp ?? 0),
      escapeCsv(r.tax_rate ?? 18),
      escapeCsv(r.stock_qty ?? 0),
    ].join(','));
  }

  return csvLines.join('\r\n');
}
