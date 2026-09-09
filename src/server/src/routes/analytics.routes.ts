/**
 * analytics.routes.ts - Customer Analytics & Metrics
 */
import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/database.js';

export async function analyticsRoutes(app: FastifyInstance) {
  // GET /api/analytics/customer/:phone
  app.get<{ Params: { phone: string } }>('/api/analytics/customer/:phone', (req, reply) => {
    const db = getDb();
    const phone = req.params.phone;

    // 1. Fetch Customer Master Profile
    let customer = db.prepare(`SELECT * FROM customers WHERE phone = ?`).get(phone) as any;
    if (!customer) {
      // Fallback: look for phone in customer_snapshot of documents
      const snapDoc = db.prepare(`
        SELECT customer_snapshot FROM documents 
        WHERE (customer_phone = ? OR customer_snapshot LIKE ?)
        ORDER BY doc_date DESC LIMIT 1
      `).get(phone, `%"phone":"${phone}"%`) as any;

      if (snapDoc?.customer_snapshot) {
        try {
          const snap = JSON.parse(snapDoc.customer_snapshot);
          customer = {
            phone: snap.phone || phone,
            name: snap.name || 'Unknown Customer',
            email: snap.email || '',
            gstin: snap.gstin || '',
            billing_address: snap.billing_address || '',
            state_code: snap.state_code || '36',
            outstanding_balance: 0,
          };
        } catch {
          customer = { phone, name: 'Unknown Customer', outstanding_balance: 0 };
        }
      } else {
        customer = { phone, name: 'Unknown Customer', outstanding_balance: 0 };
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const dayOfWeek = new Date().getDay(); // 0 = Sun
    const monday = new Date();
    monday.setDate(monday.getDate() - ((dayOfWeek + 6) % 7));
    const weekStart = monday.toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';
    const yearStart = today.slice(0, 4) + '-01-01';

    // Helper for sales count and revenue
    const metricQuery = (dateCondition: string, extraParams: any[] = []) => {
      const sql = `
        SELECT 
          COALESCE(SUM(grand_total), 0) as revenue,
          COUNT(*) as sales_count
        FROM documents 
        WHERE (customer_phone = ? OR customer_snapshot LIKE ?)
          AND doc_type = 'INVOICE' 
          AND payment_status != 'CANCELLED'
          AND ${dateCondition}
      `;
      const res = db.prepare(sql).get(phone, `%"phone":"${phone}"%`, ...extraParams) as any;
      return {
        revenue: res?.revenue || 0,
        salesCount: res?.sales_count || 0,
      };
    };

    const todayMetrics = metricQuery(`doc_date = ?`, [today]);
    const weekMetrics = metricQuery(`doc_date BETWEEN ? AND ?`, [weekStart, today]);
    const monthMetrics = metricQuery(`doc_date BETWEEN ? AND ?`, [monthStart, today]);
    const yearMetrics = metricQuery(`doc_date BETWEEN ? AND ?`, [yearStart, today]);

    // All-time Metrics (including paid, unpaid, quotations)
    const allTimeInvoiceRes = db.prepare(`
      SELECT 
        COALESCE(SUM(grand_total), 0) as revenue,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COUNT(*) as sales_count
      FROM documents 
      WHERE (customer_phone = ? OR customer_snapshot LIKE ?)
        AND doc_type = 'INVOICE' 
        AND payment_status != 'CANCELLED'
    `).get(phone, `%"phone":"${phone}"%`) as any;

    const quotationsRes = db.prepare(`
      SELECT 
        COALESCE(SUM(grand_total), 0) as total,
        COUNT(*) as count
      FROM documents 
      WHERE (customer_phone = ? OR customer_snapshot LIKE ?)
        AND doc_type = 'QUOTATION' 
        AND payment_status != 'CANCELLED'
    `).get(phone, `%"phone":"${phone}"%`) as any;

    const allTime = {
      revenue: allTimeInvoiceRes?.revenue || 0,
      totalPaid: allTimeInvoiceRes?.total_paid || 0,
      totalOutstanding: Math.max(0, (allTimeInvoiceRes?.revenue || 0) - (allTimeInvoiceRes?.total_paid || 0)),
      salesCount: allTimeInvoiceRes?.sales_count || 0,
      quotationCount: quotationsRes?.count || 0,
      quotationTotal: quotationsRes?.total || 0,
    };

    // 2. All items purchased aggregated in descending order
    const purchasedItems = db.prepare(`
      SELECT 
        di.product_name,
        di.hsn_sac,
        di.unit,
        SUM(di.quantity) as total_quantity,
        SUM(di.total_amount) as total_amount,
        ROUND(AVG(di.unit_price), 2) as avg_price,
        MAX(d.doc_date) as last_purchased_date,
        COUNT(DISTINCT d.id) as order_count
      FROM document_items di
      JOIN documents d ON d.id = di.document_id
      WHERE (d.customer_phone = ? OR d.customer_snapshot LIKE ?)
        AND d.doc_type = 'INVOICE' 
        AND d.payment_status != 'CANCELLED'
      GROUP BY di.product_name, di.hsn_sac, di.unit
      ORDER BY total_quantity DESC
    `).all(phone, `%"phone":"${phone}"%`) as any[];

    return reply.send({
      customer,
      metrics: {
        today: todayMetrics,
        thisWeek: weekMetrics,
        thisMonth: monthMetrics,
        thisYear: yearMetrics,
        allTime,
      },
      purchasedItems,
    });
  });
}
