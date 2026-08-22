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

    // 12-month breakdown
    const monthly = db.prepare(`
      SELECT strftime('%Y-%m', doc_date) as month,
             COALESCE(SUM(grand_total),0) as revenue,
             COUNT(*) as count
      FROM documents
      WHERE doc_type='INVOICE' AND payment_status != 'CANCELLED'
        AND doc_date >= date('now', '-11 months', 'start of month')
      GROUP BY month ORDER BY month
    `).all();

    // Outstanding balance
    const outstanding = (db.prepare(
      `SELECT COALESCE(SUM(outstanding_balance),0) as total FROM customers`
    ).get() as any).total;

    const unpaidTotal = (db.prepare(
      `SELECT COALESCE(SUM(grand_total),0) as total FROM documents WHERE doc_type='INVOICE' AND payment_status IN ('UNPAID','PARTIAL')`
    ).get() as any).total;

    return reply.send({
      today: metricQuery(today),
      thisWeek: metricQuery(weekStart, today),
      thisMonth: metricQuery(monthStart, today),
      thisYear: metricQuery(yearStart, today),
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
