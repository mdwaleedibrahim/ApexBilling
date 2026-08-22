// components/history/RecordsHistoryTab.tsx — Invoice/Quotation history table
import { useEffect, useState } from 'react'
import { Search, Eye, Edit, XCircle, Printer, ChevronDown } from 'lucide-react'
import { api } from '../../utils/api'
import { formatINR, formatDate } from '../../utils/upiHelper'
import { useBillingStore } from '../../store/useBillingStore'
import A4InvoiceTemplate from '../print/A4InvoiceTemplate'

interface Props { onEdit: (doc: any) => void }

const STATUS_BADGE: Record<string, string> = {
  PAID: 'badge-paid', UNPAID: 'badge-unpaid', PARTIAL: 'badge-partial',
  CANCELLED: 'badge-cancelled',
}

export default function RecordsHistoryTab({ onEdit }: Props) {
  const [docs, setDocs] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [printDoc, setPrintDoc] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const store = useBillingStore()

  const load = async () => {
    setLoading(true)
    const [d, p] = await Promise.all([
      api.documents.list({ type: typeFilter || undefined, status: statusFilter || undefined, search: search || undefined }),
      api.settings.getProfile()
    ])
    setDocs(d); setProfile(p.profile); setLoading(false)
  }

  useEffect(() => { load() }, [search, typeFilter, statusFilter])

  const handleEdit = async (doc: any) => {
    const full = await api.documents.get(doc.id)
    store.loadFromDoc(full)
    onEdit(full)
  }

  const handleCancel = async (doc: any) => {
    if (!confirm(`Cancel ${doc.doc_number}? Stock will be restored.`)) return
    await api.documents.cancel(doc.id)
    load()
  }

  const handlePrint = async (doc: any) => {
    const full = await api.documents.get(doc.id)
    setPrintDoc(full)
    setTimeout(() => window.print(), 300)
  }

  return (
    <div className="p-6 space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-8" placeholder="Search by number or customer…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input !w-36" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="INVOICE">Invoice</option>
          <option value="QUOTATION">Quotation</option>
        </select>
        <select className="input !w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="PAID">Paid</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIAL">Partial</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/10">
              <th className="th">Number</th>
              <th className="th">Type</th>
              <th className="th">Date</th>
              <th className="th">Customer</th>
              <th className="th text-right">Amount</th>
              <th className="th">Status</th>
              <th className="th">Rev</th>
              <th className="th">Actions</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="td text-center text-gray-500 py-8">Loading…</td></tr>}
              {!loading && docs.length === 0 && (
                <tr><td colSpan={8} className="td text-center text-gray-500 py-8">No records found.</td></tr>
              )}
              {docs.map(doc => {
                const snap = (() => { try { return JSON.parse(doc.customer_snapshot) } catch { return {} } })()
                return (
                  <tr key={doc.id} className="tr">
                    <td className="td font-mono text-xs text-brand-300">{doc.doc_number}</td>
                    <td className="td">
                      <span className={doc.doc_type === 'INVOICE' ? 'badge-paid' : 'badge-draft'}>{doc.doc_type}</span>
                    </td>
                    <td className="td text-gray-400">{formatDate(doc.doc_date)}</td>
                    <td className="td">{snap.name || '—'}<br/><span className="text-xs text-gray-500">{doc.customer_phone || ''}</span></td>
                    <td className="td text-right font-medium text-emerald-400">{formatINR(doc.grand_total)}</td>
                    <td className="td"><span className={STATUS_BADGE[doc.payment_status] || 'badge-draft'}>{doc.payment_status}</span></td>
                    <td className="td text-center text-gray-500 text-xs">v{doc.revision_number}</td>
                    <td className="td">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handlePrint(doc)} className="btn-ghost p-1.5" title="Print"><Printer size={14} /></button>
                        {doc.payment_status !== 'CANCELLED' && (
                          <button onClick={() => handleEdit(doc)} className="btn-ghost p-1.5 text-brand-400" title="Edit"><Edit size={14} /></button>
                        )}
                        {doc.payment_status !== 'CANCELLED' && (
                          <button onClick={() => handleCancel(doc)} className="btn-ghost p-1.5 text-red-400" title="Cancel"><XCircle size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hidden print target */}
      {printDoc && (
        <div className="print-only fixed inset-0 bg-white z-[999]">
          <A4InvoiceTemplate doc={printDoc} profile={profile} />
        </div>
      )}
    </div>
  )
}
