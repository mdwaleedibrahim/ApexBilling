// components/customers/CustomerDirectory.tsx
import { useEffect, useState } from 'react'
import { Search, Plus, Edit, Trash2, Receipt, X, Save } from 'lucide-react'
import { api } from '../../utils/api'
import { formatINR, formatDate } from '../../utils/upiHelper'
import { INDIAN_STATES } from '../../utils/gstEngine'

const EMPTY = { phone: '', name: '', email: '', gstin: '', billing_address: '', state_code: '36' }

export default function CustomerDirectory() {
  const [customers, setCustomers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editPhone, setEditPhone] = useState<string | null>(null)
  const [form, setForm] = useState<any>(EMPTY)
  const [selected, setSelected] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    const q = search.trim()
    const data = q ? await api.customers.search(q) : await api.customers.list()
    setCustomers(data)
  }

  useEffect(() => { load() }, [search])

  const save = async () => {
    setLoading(true)
    try {
      if (editPhone) await api.customers.update(editPhone, form)
      else await api.customers.upsert(form)
      setShowForm(false); setEditPhone(null); setForm(EMPTY); load()
    } finally { setLoading(false) }
  }

  const del = async (phone: string) => {
    if (!confirm('Delete this customer?')) return
    await api.customers.delete(phone); load(); if (selected?.phone === phone) setSelected(null)
  }

  const startEdit = (c: any) => {
    setForm({ phone: c.phone, name: c.name, email: c.email || '', gstin: c.gstin || '', billing_address: c.billing_address || '', state_code: c.state_code || '36' })
    setEditPhone(c.phone); setShowForm(true)
  }

  const viewInvoices = async (c: any) => {
    setSelected(c)
    const inv = await api.customers.invoices(c.phone)
    setInvoices(inv)
  }

  const f = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }))

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-8" placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => { setShowForm(true); setEditPhone(null); setForm(EMPTY) }} className="btn-primary">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="section-title">{editPhone ? 'Edit Customer' : 'New Customer'}</h3>
            <button onClick={() => { setShowForm(false); setEditPhone(null) }} className="btn-ghost p-1"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className="label">Phone *</label><input className="input" value={form.phone} onChange={e => f('phone', e.target.value)} disabled={!!editPhone} placeholder="9876543210" /></div>
            <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Customer Name" /></div>
            <div><label className="label">Email</label><input className="input" value={form.email} onChange={e => f('email', e.target.value)} placeholder="email@example.com" /></div>
            <div><label className="label">GSTIN</label><input className="input" value={form.gstin} onChange={e => f('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" /></div>
            <div><label className="label">State</label>
              <select className="input" value={form.state_code} onChange={e => f('state_code', e.target.value)}>
                {Object.entries(INDIAN_STATES).map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}
              </select>
            </div>
            <div className="col-span-2 md:col-span-1"><label className="label">Billing Address</label><input className="input" value={form.billing_address} onChange={e => f('billing_address', e.target.value)} placeholder="Full address" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={loading} className="btn-primary"><Save size={16} />{loading ? 'Saving…' : 'Save Customer'}</button>
            <button onClick={() => { setShowForm(false); setEditPhone(null) }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
        {/* Customer Table */}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-white/10">
                <th className="th">Name</th><th className="th">Phone</th>
                <th className="th">GSTIN</th><th className="th">State</th>
                <th className="th text-right">Balance</th><th className="th">Actions</th>
              </tr></thead>
              <tbody>
                {customers.length === 0 && <tr><td colSpan={6} className="td text-center text-gray-500 py-8">No customers yet.</td></tr>}
                {customers.map(c => (
                  <tr key={c.phone} className={`tr cursor-pointer ${selected?.phone === c.phone ? 'bg-brand-600/10' : ''}`} onClick={() => viewInvoices(c)}>
                    <td className="td font-medium">{c.name}</td>
                    <td className="td text-gray-400">{c.phone}</td>
                    <td className="td text-xs text-gray-500">{c.gstin || '—'}</td>
                    <td className="td text-xs text-gray-500">{INDIAN_STATES[c.state_code] || c.state_code}</td>
                    <td className={`td text-right font-medium ${c.outstanding_balance > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {formatINR(c.outstanding_balance || 0)}
                    </td>
                    <td className="td">
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => startEdit(c)} className="btn-ghost p-1.5 text-brand-400"><Edit size={14} /></button>
                        <button onClick={() => del(c.phone)} className="btn-ghost p-1.5 text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invoice History Panel */}
        {selected && (
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-200">{selected.name}</p>
                <p className="text-xs text-gray-400">{selected.phone}</p>
              </div>
              <button onClick={() => setSelected(null)} className="btn-ghost p-1"><X size={14} /></button>
            </div>
            <div className="flex items-center gap-2">
              <Receipt size={14} className="text-brand-400" />
              <span className="text-xs font-medium text-gray-400">Invoice History</span>
            </div>
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {invoices.length === 0 && <p className="text-sm text-gray-500">No invoices yet.</p>}
              {invoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-xl text-sm">
                  <div>
                    <p className="font-mono text-xs text-brand-300">{inv.doc_number}</p>
                    <p className="text-xs text-gray-500">{formatDate(inv.doc_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-emerald-400">{formatINR(inv.grand_total)}</p>
                    <span className={`text-xs ${inv.payment_status === 'PAID' ? 'text-emerald-400' : 'text-red-400'}`}>{inv.payment_status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
