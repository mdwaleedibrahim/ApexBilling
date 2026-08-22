// components/dashboard/CustomerBreakdownModal.tsx
import { useEffect, useState } from 'react'
import { X, Users } from 'lucide-react'
import { api } from '../../utils/api'
import { formatINR } from '../../utils/upiHelper'

export default function CustomerBreakdownModal({ period, onClose }: { period: string; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.dashboard.customerBreakdown(period).then(r => { setRows(r); setLoading(false) })
  }, [period])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-brand-400" />
            <h2 className="section-title mb-0">Customer Spend — {period}</h2>
          </div>
          <button onClick={onClose} className="btn-ghost"><X size={16} /></button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-500 text-sm">No customer data for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-white/10">
                <th className="th">#</th>
                <th className="th">Customer</th>
                <th className="th">Phone</th>
                <th className="th text-right">Invoices</th>
                <th className="th text-right">Total Spend</th>
              </tr></thead>
              <tbody>
                {rows.map((r: any, i: number) => {
                  const snap = (() => { try { return JSON.parse(r.customer_snapshot) } catch { return {} } })()
                  return (
                    <tr key={i} className="tr">
                      <td className="td text-gray-500">{i + 1}</td>
                      <td className="td font-medium">{snap.name || '—'}</td>
                      <td className="td text-gray-400">{r.customer_phone || '—'}</td>
                      <td className="td text-right">{r.invoice_count}</td>
                      <td className="td text-right font-semibold text-emerald-400">{formatINR(r.total_spend)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
