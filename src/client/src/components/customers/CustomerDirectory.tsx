// components/customers/CustomerDirectory.tsx
import { useEffect, useState } from 'react'
import { Search, Plus, Edit, Trash2, Receipt, X, Save, Sparkles } from 'lucide-react'
import { api } from '../../utils/api'
import { formatINR, formatDate } from '../../utils/upiHelper'
import { INDIAN_STATES } from '../../utils/gstEngine'
import { normalizePhone } from '../../utils/phoneHelper'

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
    const cleanPhone = normalizePhone(form.phone)
    if (!cleanPhone && !form.name.trim()) return
    setLoading(true)
    try {
      const payload = { ...form, phone: cleanPhone }
      if (editPhone) await api.customers.update(editPhone, payload)
      else await api.customers.upsert(payload)
      setShowForm(false); setEditPhone(null); setForm(EMPTY); load()
    } finally { setLoading(false) }
  }

  const del = async (phone: string) => {
    if (!confirm('Delete this customer?')) return
    await api.customers.delete(phone); load(); if (selected?.phone === phone) setSelected(null)
  }

  const startEdit = (c: any) => {
    setForm({ phone: c.phone?.startsWith('NO_PHONE_') ? '' : c.phone, name: c.name, email: c.email || '', gstin: c.gstin || '', billing_address: c.billing_address || '', state_code: c.state_code || '36' })
    setEditPhone(c.phone); setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const viewInvoices = async (c: any) => {
    setSelected(c)
    const inv = await api.customers.invoices(c.phone)
    setInvoices(inv)
  }

  const f = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }))

  // Check for existing customer when adding
  const normFormPhone = normalizePhone(form.phone)
  const existingPhoneMatch = !editPhone && normFormPhone && normFormPhone.length >= 7
    ? customers.find(c => normalizePhone(c.phone) === normFormPhone)
    : null

  const existingNameMatches = (!editPhone && !existingPhoneMatch && form.name?.trim().length >= 2)
    ? customers.filter(c =>
        c.name &&
        c.name.toLowerCase().includes(form.name.trim().toLowerCase()) &&
        !c.phone?.startsWith('NO_PHONE_')
      ).slice(0, 3)
    : []

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

          {/* Existing Customer Lookup Alerts */}
          {existingPhoneMatch && (
            <div className="flex items-center justify-between p-2.5 bg-brand-500/15 border border-brand-500/30 rounded-xl text-xs text-brand-200">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-brand-400 shrink-0" />
                <div>
                  <p className="font-semibold">{existingPhoneMatch.name} is already registered with phone {existingPhoneMatch.phone}.</p>
                  <p className="text-[10px] text-gray-400">Primary Key is phone number. Load their profile to edit instead.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => startEdit(existingPhoneMatch)}
                className="btn-secondary text-xs py-1 px-2.5 shrink-0"
              >
                Edit This Customer
              </button>
            </div>
          )}

          {existingNameMatches.length > 0 && !form.phone && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-1.5">
              <p className="text-amber-300 font-medium flex items-center gap-1.5">
                <Search size={12} /> Existing customer(s) found with this name:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {existingNameMatches.map((m: any) => (
                  <button
                    key={m.phone}
                    type="button"
                    onClick={() => startEdit(m)}
                    className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-gray-200 transition-colors flex items-center gap-1.5"
                  >
                    <span className="font-semibold">{m.name}</span>
                    <span className="text-gray-400 font-mono text-[10px]">({m.phone})</span>
                    <span className="text-brand-300 text-[10px] underline">Edit</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="label">Phone {editPhone?.startsWith('NO_PHONE_') ? '(None)' : '* (Primary Key)'}</label>
              <input className="input font-mono" value={form.phone} onChange={e => f('phone', e.target.value)} disabled={!!editPhone} placeholder={editPhone?.startsWith('NO_PHONE_') ? 'No phone registered' : '9876543210'} />
            </div>
            <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Customer Name" /></div>
            <div><label className="label">Email</label><input className="input" value={form.email} onChange={e => f('email', e.target.value)} placeholder="email@example.com" /></div>
            <div><label className="label">GSTIN</label><input className="input uppercase" value={form.gstin} onChange={e => f('gstin', e.target.value)} placeholder="22AAAAA0000A1Z5" /></div>
            <div><label className="label">State</label>
              <select className="input" value={form.state_code} onChange={e => f('state_code', e.target.value)}>
                {Object.entries(INDIAN_STATES).map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}
              </select>
            </div>
            <div className="col-span-2 md:col-span-1"><label className="label">Billing Address</label><input className="input" value={form.billing_address} onChange={e => f('billing_address', e.target.value)} placeholder="Full address" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={loading || (!form.phone.trim() && !editPhone?.startsWith('NO_PHONE_')) || !form.name.trim()} className="btn-primary"><Save size={16} />{loading ? 'Saving…' : 'Save Customer'}</button>
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
                    <td className="td text-gray-400">{c.phone?.startsWith('NO_PHONE_') ? '—' : c.phone}</td>
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
                <p className="text-xs text-gray-400">{selected.phone?.startsWith('NO_PHONE_') ? 'No phone' : selected.phone}</p>
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
