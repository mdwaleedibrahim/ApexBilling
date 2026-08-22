// components/billing/CustomerSelector.tsx
// Displays all customers on focus/click and dynamically filters as user types name/phone
import { useState, useEffect, useRef } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import { api } from '../../utils/api'
import { useBillingStore } from '../../store/useBillingStore'

export default function CustomerSelector() {
  const { customer, setCustomer } = useBillingStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [allCustomers, setAllCustomers] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [addMode, setAddMode] = useState(false)
  const [form, setForm] = useState({ phone: '', name: '', email: '', gstin: '', billing_address: '', state_code: '36' })
  const inputRef = useRef<HTMLInputElement>(null)

  const loadAll = async () => {
    try {
      const list = await api.customers.list()
      setAllCustomers(list || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => { loadAll() }, [])

  const filterCustomers = (q: string) => {
    setQuery(q)
    setOpen(true)
    setHighlighted(0)
    if (!q.trim()) {
      setResults(allCustomers)
    } else {
      const lower = q.toLowerCase()
      setResults(allCustomers.filter(c =>
        c.phone.toLowerCase().includes(lower) ||
        (c.name && c.name.toLowerCase().includes(lower))
      ))
    }
  }

  const handleFocus = async () => {
    const list = await api.customers.list()
    setAllCustomers(list || [])
    if (!query.trim()) {
      setResults(list || [])
    } else {
      filterCustomers(query)
    }
    setOpen(true)
  }

  const select = (c: any) => {
    setCustomer({ phone: c.phone, name: c.name, email: c.email, gstin: c.gstin, billing_address: c.billing_address, state_code: c.state_code })
    setQuery(''); setOpen(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter' && results[highlighted]) { select(results[highlighted]) }
    if (e.key === 'Escape') { setOpen(false) }
  }

  const saveNew = async () => {
    if (!form.phone || !form.name) return
    const c = await api.customers.upsert(form)
    select(c); setAddMode(false); setForm({ phone: '', name: '', email: '', gstin: '', billing_address: '', state_code: '36' })
  }

  if (customer) return (
    <div className="flex items-center gap-3 px-3 py-2 bg-brand-600/10 border border-brand-500/30 rounded-xl">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-brand-300">{customer.name}</p>
        <p className="text-xs text-gray-400">{customer.phone}{customer.gstin ? ` · GST: ${customer.gstin}` : ''}</p>
      </div>
      <button onClick={() => setCustomer(null)} className="btn-ghost p-1"><X size={14} /></button>
    </div>
  )

  if (addMode) return (
    <div className="glass-card p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-200">New Customer</p>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Phone *</label><input className="input" placeholder="9876543210" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
        <div><label className="label">Name *</label><input className="input" placeholder="Customer Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div><label className="label">Email</label><input className="input" placeholder="email@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
        <div><label className="label">GSTIN</label><input className="input" placeholder="22AAAAA0000A1Z5" value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} /></div>
        <div className="col-span-2"><label className="label">Billing Address</label><input className="input" placeholder="Address" value={form.billing_address} onChange={e => setForm(f => ({ ...f, billing_address: e.target.value }))} /></div>
      </div>
      <div className="flex gap-2">
        <button onClick={saveNew} className="btn-primary text-sm">Save & Select</button>
        <button onClick={() => setAddMode(false)} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  )

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            ref={inputRef}
            className="input pl-8"
            placeholder="Click to view all customers or search by name/phone…"
            value={query}
            onChange={e => filterCustomers(e.target.value)}
            onKeyDown={handleKey}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
          />
        </div>
        <button onClick={() => setAddMode(true)} className="btn-secondary px-3" title="New Customer"><UserPlus size={16} /></button>
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 glass-card z-30 overflow-hidden max-h-60 overflow-y-auto">
          {results.map((r, i) => (
            <div key={r.phone}
              className={`px-4 py-2.5 cursor-pointer text-sm transition-colors border-b border-white/5 last:border-0 ${i === highlighted ? 'bg-brand-600/30 text-brand-300' : 'hover:bg-white/5 text-gray-200'}`}
              onMouseDown={() => select(r)}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.name}</span>
                <span className="text-gray-400 text-xs font-mono">{r.phone}</span>
              </div>
              {r.billing_address && <p className="text-xs text-gray-500 truncate">{r.billing_address}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
