/**
 * dashboard.routes.ts - Phase 7: Sales Dashboard & Analytics
 */
import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/database.js';

export async function dashboardRoutes(app: FastifyInstance) {
  // GET /api/dashboard/metrics
  app.get('/api/dashboard/metrics', (_req, reply) => {
    const db = getDb();

    const today = new Date().toISOString().slice(0, 10);
    const dayOfWeek = new Date().getDay(); // 0=Sun
    const monday = new Date();
    monday.setDate(monday.getDate() - ((dayOfWeek + 6) % 7));
    const weekStart = monday.toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';
    const yearStart = today.slice(0, 4) + '-01-01';

    const metricQuery = (from: string, to?: string) => {
      const sql = to
        ? `SELECT COALESCE(SUM(grand_total),0) as revenue, COUNT(*) as count FROM documents WHERE doc_type='INVOICE' AND payment_status != 'CANCELLED' AND doc_date BETWEEN ? AND ?`
        : `SELECT COALESCE(SUM(grand_total),0) as revenue, COUNT(*) as count FROM documents WHERE doc_type='INVOICE' AND payment_status != 'CANCELLED' AND doc_date = ?`;
      return to ? db.prepare(sql).get(from, to) : db.prepare(sql).get(from);
    };

    // Generate last 12 months list: ['2025-09', ..., '2026-08']
    const last12Months: { month: string; label: string; revenue: number; count: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      last12Months.push({ month: mStr, label, revenue: 0, count: 0 });
    }

    const dbMonthly = db.prepare(`
      SELECT substr(doc_date, 1, 7) as month,
             COALESCE(SUM(grand_total),0) as revenue,
             COUNT(*) as count
      FROM documents
      WHERE doc_type='INVOICE' AND payment_status != 'CANCELLED'
      GROUP BY month
    `).all() as any[];

    const monthlyMap = new Map(dbMonthly.map((r: any) => [r.month, r]));

    const monthly = last12Months.map(m => {
      const found = monthlyMap.get(m.month);
      return {
        month: m.month,
        label: m.label,
        revenue: found ? found.revenue : 0,
        count: found ? found.count : 0,
      };
    });

    // Outstanding balance
    const outstanding = (db.prepare(
      `SELECT COALESCE(SUM(outstanding_balance),0) as total FROM customers`
    ).get() as any).total;

    const unpaidTotal = (db.prepare(
      `SELECT COALESCE(SUM(grand_total),0) as total FROM documents WHERE doc_type='INVOICE' AND payment_status IN ('UNPAID','PARTIAL')`
    ).get() as any).total;

    const pnlQuery = (from: string, to?: string) => {
      const filter = to ? `doc_date BETWEEN ? AND ?` : `doc_date = ?`;
      const params = to ? [from, to] : [from];
      
      const docTotals = db.prepare(`
        SELECT
          COALESCE(SUM(grand_total), 0) as gross_revenue,
          COALESCE(SUM(taxable_amount), 0) as taxable_revenue,
          COALESCE(SUM(cgst_total + sgst_total), 0) as total_gst
        FROM documents
        WHERE doc_type='INVOICE' AND payment_status != 'CANCELLED' AND ${filter}
      `).get(...params) as any;

      const cogsRow = db.prepare(`
        SELECT COALESCE(SUM(di.quantity * COALESCE(NULLIF(di.purchase_price, 0), p.purchase_price, 0)), 0) as cogs
        FROM document_items di
        JOIN documents d ON d.id = di.document_id
        LEFT JOIN products p ON p.id = di.product_id
        WHERE d.doc_type='INVOICE' AND d.payment_status != 'CANCELLED' AND ${filter.replace(/doc_date/g, 'd.doc_date')}
      `).get(...params) as any;

      const grossRevenue = docTotals?.gross_revenue || 0;
      const taxableRevenue = docTotals?.taxable_revenue || 0;
      const cogs = cogsRow?.cogs || 0;
      const grossProfit = taxableRevenue - cogs;
      const profitMarginPct = taxableRevenue > 0 ? (grossProfit / taxableRevenue) * 100 : 0;

      return {
        grossRevenue,
        taxableRevenue,
        totalGst: docTotals?.total_gst || 0,
        cogs,
        grossProfit,
        profitMarginPct,
      };
    };

    return reply.send({
      today: metricQuery(today),
      thisWeek: metricQuery(weekStart, today),
      thisMonth: metricQuery(monthStart, today),
      thisYear: metricQuery(yearStart, today),
      pnl: {
        today: pnlQuery(today),
        thisWeek: pnlQuery(weekStart, today),
        thisMonth: pnlQuery(monthStart, today),
        thisYear: pnlQuery(yearStart, today),
      },
      monthly,
      outstandingBalance: outstanding,
      unpaidInvoicesTotal: unpaidTotal,
    });
  });

  // GET /api/dashboard/customer-breakdown?period=today|week|month|year
  app.get<{ Querystring: { period?: string } }>('/api/dashboard/customer-breakdown', (req, reply) => {
    const db = getDb();
    const period = req.query.period || 'month';
    const today = new Date().toISOString().slice(0, 10);

    const dateFilter: Record<string, string> = {
      today: `doc_date = '${today}'`,
      week: `doc_date >= date('now', 'weekday 1', '-7 days')`,
      month: `doc_date >= date('now', 'start of month')`,
      year: `doc_date >= date('now', 'start of year')`,
    };
    const filter = dateFilter[period] || dateFilter.month;

    const rows = db.prepare(`
      SELECT customer_phone, customer_snapshot,
             SUM(grand_total) as total_spend,
             COUNT(*) as invoice_count
      FROM documents
      WHERE doc_type='INVOICE' AND payment_status != 'CANCELLED' AND ${filter}
      GROUP BY customer_phone
      ORDER BY total_spend DESC
      LIMIT 50
    `).all();

    return reply.send(rows);
  });

  // GET /api/dashboard/top-products?period=month
  app.get<{ Querystring: { period?: string } }>('/api/dashboard/top-products', (req, reply) => {
    const db = getDb();
    const period = req.query.period || 'month';
    const dateFilter: Record<string, string> = {
      today: `d.doc_date = date('now')`,
      week: `d.doc_date >= date('now', 'weekday 1', '-7 days')`,
      month: `d.doc_date >= date('now', 'start of month')`,
      year: `d.doc_date >= date('now', 'start of year')`,
    };
    const filter = dateFilter[period] || dateFilter.month;

    const rows = db.prepare(`
      SELECT di.product_name, SUM(di.quantity) as total_qty, SUM(di.total_amount) as total_revenue
      FROM document_items di
      JOIN documents d ON d.id = di.document_id
      WHERE d.doc_type='INVOICE' AND d.payment_status != 'CANCELLED' AND ${filter}
      GROUP BY di.product_name ORDER BY total_revenue DESC LIMIT 10
    `).all();

    return reply.send(rows);
  });
}
