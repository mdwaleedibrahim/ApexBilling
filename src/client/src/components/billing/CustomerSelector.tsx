import { useState, useEffect, useRef } from 'react'
import { Search, UserPlus, X, Edit, Sparkles, CheckCircle2 } from 'lucide-react'
import { api } from '../../utils/api'
import { useBillingStore } from '../../store/useBillingStore'
import { INDIAN_STATES } from '../../utils/gstEngine'
import { normalizePhone } from '../../utils/phoneHelper'

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
  const blurTimerRef = useRef<any>(null)

  const loadAll = async () => {
    try {
      const list = await api.customers.list()
      setAllCustomers(list || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadAll()
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    }
  }, [])

  const filterCustomers = (q: string) => {
    setQuery(q)
    setOpen(true)
    setHighlighted(0)
    if (!q.trim()) {
      setResults(allCustomers)
    } else {
      const lower = q.toLowerCase()
      const norm = normalizePhone(q)
      setResults(allCustomers.filter(c =>
        (c.phone && (c.phone.toLowerCase().includes(lower) || (norm.length >= 4 && normalizePhone(c.phone).includes(norm)))) ||
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
    setCustomer({
      phone: c.phone || '',
      name: c.name || '',
      email: c.email || '',
      gstin: c.gstin || '',
      billing_address: c.billing_address || '',
      state_code: c.state_code || '36'
    })
    setQuery(''); setOpen(false)
  }

  const selectDraftFromQuery = (qText: string) => {
    const trimmed = qText.trim()
    if (!trimmed) return
    const isPhone = /^[\d\s+\-()]{7,15}$/.test(trimmed)
    const norm = isPhone ? normalizePhone(trimmed) : ''

    // Always check if this customer already exists before drafting
    const existing = isPhone
      ? allCustomers.find(c => normalizePhone(c.phone) === norm)
      : allCustomers.find(c => c.name?.trim().toLowerCase() === trimmed.toLowerCase())

    if (existing) {
      select(existing)
      return
    }

    setCustomer({
      phone: norm || (isPhone ? trimmed : ''),
      name: isPhone ? '' : trimmed,
      email: '',
      gstin: '',
      billing_address: '',
      state_code: '36'
    })
    setQuery('')
    setOpen(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    const hasDraftOption = query.trim().length > 0
    const totalOptions = results.length + (hasDraftOption ? 1 : 0)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, totalOptions - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlighted < results.length && results[highlighted]) {
        select(results[highlighted])
      } else if (hasDraftOption) {
        selectDraftFromQuery(query)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Real-time lookup for existing customer by phone or name
  const normFormPhone = normalizePhone(form.phone)
  const existingPhoneMatch = normFormPhone && normFormPhone.length >= 7
    ? allCustomers.find(c => normalizePhone(c.phone) === normFormPhone)
    : null

  const existingNameMatches = (!existingPhoneMatch && form.name.trim().length >= 2)
    ? allCustomers.filter(c =>
        c.name &&
        c.name.toLowerCase().includes(form.name.trim().toLowerCase()) &&
        !c.phone?.startsWith('NO_PHONE_')
      ).slice(0, 3)
    : []

  const saveFormDraft = () => {
    const rawPhone = form.phone.trim()
    const norm = normalizePhone(rawPhone)
    const name = form.name.trim()
    if (!rawPhone && !name) return

    // Ensure we reuse existing customer details if this phone or exact name exists
    const matched = (norm ? allCustomers.find(c => normalizePhone(c.phone) === norm) : null) ||
      (!norm && name ? allCustomers.find(c => c.name?.trim().toLowerCase() === name.toLowerCase()) : null)

    setCustomer({
      phone: norm || (matched ? matched.phone : ''),
      name: name || (matched ? matched.name : ''),
      email: form.email.trim() || (matched?.email || ''),
      gstin: form.gstin.trim() || (matched?.gstin || ''),
      billing_address: form.billing_address.trim() || (matched?.billing_address || ''),
      state_code: form.state_code || matched?.state_code || '36'
    })
    setAddMode(false)
    setForm({ phone: '', name: '', email: '', gstin: '', billing_address: '', state_code: '36' })
  }

  const startEditCurrent = () => {
    if (customer) {
      setForm({
        phone: customer.phone && !customer.phone.startsWith('NO_PHONE_') ? customer.phone : '',
        name: customer.name || '',
        email: customer.email || '',
        gstin: customer.gstin || '',
        billing_address: customer.billing_address || '',
        state_code: customer.state_code || '36'
      })
    }
    setAddMode(true)
  }

  if (addMode) return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-200">
          {customer ? 'Edit Customer Details' : 'Customer Details (New or Unregistered)'}
        </p>
        <span className="text-[11px] text-gray-400">Phone or Name is required</span>
      </div>

      {/* Duplicate / Existing Customer Alerts */}
      {existingPhoneMatch && (
        <div className="flex items-center justify-between p-2.5 bg-brand-500/15 border border-brand-500/30 rounded-xl text-xs text-brand-200">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-brand-400 shrink-0" />
            <div>
              <p className="font-semibold">{existingPhoneMatch.name} is registered with this phone.</p>
              <p className="text-[10px] text-gray-400">Primary Key: {existingPhoneMatch.phone} (Always one customer per phone)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setForm({
                phone: existingPhoneMatch.phone,
                name: existingPhoneMatch.name,
                email: existingPhoneMatch.email || '',
                gstin: existingPhoneMatch.gstin || '',
                billing_address: existingPhoneMatch.billing_address || '',
                state_code: existingPhoneMatch.state_code || '36'
              })
            }}
            className="btn-secondary text-xs py-1 px-2.5 shrink-0"
          >
            Autofill Details
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
                onClick={() => {
                  setForm({
                    phone: m.phone,
                    name: m.name,
                    email: m.email || '',
                    gstin: m.gstin || '',
                    billing_address: m.billing_address || '',
                    state_code: m.state_code || '36'
                  })
                }}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-gray-200 transition-colors flex items-center gap-1.5"
              >
                <span className="font-semibold">{m.name}</span>
                <span className="text-gray-400 font-mono text-[10px]">({m.phone})</span>
                <span className="text-brand-300 text-[10px] underline">Select</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <div>
          <label className="label">Phone Number (Primary Key)</label>
          <input
            className="input font-mono"
            placeholder="e.g. 9876543210"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Customer Name</label>
          <input
            className="input"
            placeholder="e.g. Rahul Sharma"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" placeholder="email@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <label className="label">GSTIN</label>
          <input className="input uppercase" placeholder="22AAAAA0000A1Z5" value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} />
        </div>
        <div>
          <label className="label">State</label>
          <select className="input" value={form.state_code} onChange={e => setForm(f => ({ ...f, state_code: e.target.value }))}>
            {Object.entries(INDIAN_STATES).map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}
          </select>
        </div>
        <div className="col-span-2 md:col-span-1">
          <label className="label">Billing Address</label>
          <input className="input" placeholder="Address, City, State" value={form.billing_address} onChange={e => setForm(f => ({ ...f, billing_address: e.target.value }))} />
        </div>
      </div>
      <p className="text-[11px] text-gray-400 italic">
        💡 Details will be displayed on this bill and automatically saved to your customer directory once payment is complete.
      </p>
      <div className="flex gap-2">
        <button onClick={saveFormDraft} disabled={!form.phone.trim() && !form.name.trim()} className="btn-primary text-sm">
          {customer ? 'Update Customer' : 'Use for Bill'}
        </button>
        <button onClick={() => setAddMode(false)} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  )

  if (customer) return (
    <div className="flex items-center gap-3 px-3 py-2 bg-brand-600/10 border border-brand-500/30 rounded-xl">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-brand-300">
            {customer.name || (customer.phone ? `Customer (${customer.phone})` : 'Walk-in Customer')}
          </p>
          {!allCustomers.some(c => c.phone === customer.phone) && (
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded-full font-medium">
              ✨ Auto-saves on payment
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400">
          {customer.phone && !customer.phone.startsWith('NO_PHONE_') ? customer.phone : (customer.name ? 'No phone' : '')}
          {customer.gstin ? ` · GST: ${customer.gstin}` : ''}
          {customer.billing_address ? ` · ${customer.billing_address}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={startEditCurrent} className="btn-ghost p-1.5 text-gray-400 hover:text-white" title="Edit Customer Details">
          <Edit size={14} />
        </button>
        <button onClick={() => setCustomer(null)} className="btn-ghost p-1.5 text-gray-400 hover:text-red-400" title="Remove Customer">
          <X size={14} />
        </button>
      </div>
    </div>
  )

  const showDraftItem = query.trim().length > 0
  const isDigits = /^[\d\s+\-()]{7,15}$/.test(query.trim())

  return (
    <div className="relative z-30">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            ref={inputRef}
            className="input pl-8"
            placeholder="Search customer or type new name / phone… (Enter)"
            value={query}
            onChange={e => filterCustomers(e.target.value)}
            onKeyDown={handleKey}
            onFocus={handleFocus}
            onBlur={() => {
              if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
              blurTimerRef.current = setTimeout(() => {
                if (query.trim() && !customer) {
                  selectDraftFromQuery(query)
                }
                setOpen(false)
              }, 250)
            }}
          />
        </div>
        <button
          onClick={() => {
            setForm({
              phone: isDigits ? query.trim() : '',
              name: !isDigits ? query.trim() : '',
              email: '', gstin: '', billing_address: '', state_code: '36'
            })
            setAddMode(true)
          }}
          className="btn-secondary px-3"
          title="Add Customer Details"
        >
          <UserPlus size={16} />
        </button>
      </div>

      {open && (results.length > 0 || showDraftItem) && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 bg-[#111827] border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto divide-y divide-gray-800"
          style={{ backgroundColor: '#111827', opacity: 1 }}
        >
          {results.map((r, i) => (
            <div
              key={r.phone}
              className={`px-4 py-3 cursor-pointer text-sm transition-colors ${i === highlighted ? 'bg-brand-600 text-white' : 'hover:bg-gray-800 text-gray-200'}`}
              style={{ backgroundColor: i === highlighted ? '#2563eb' : '#111827' }}
              onMouseDown={() => select(r)}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{r.name}</span>
                <span className={i === highlighted ? 'text-blue-100 text-xs font-mono' : 'text-gray-400 text-xs font-mono'}>
                  {r.phone && !r.phone.startsWith('NO_PHONE_') ? r.phone : ''}
                </span>
              </div>
              {r.billing_address && (
                <p className={`text-xs truncate mt-0.5 ${i === highlighted ? 'text-blue-200' : 'text-gray-400'}`}>{r.billing_address}</p>
              )}
            </div>
          ))}

          {showDraftItem && (
            <div
              className={`px-4 py-3 cursor-pointer text-sm transition-colors border-t border-brand-500/30 ${highlighted === results.length ? 'bg-brand-600 text-white' : 'hover:bg-brand-950/40 text-brand-300'}`}
              style={{ backgroundColor: highlighted === results.length ? '#2563eb' : '#172554' }}
              onMouseDown={() => selectDraftFromQuery(query)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-400" />
                  Use &quot;{query.trim()}&quot; as {isDigits ? 'Phone' : 'Customer Name'}
                </span>
                <span className="text-xs bg-brand-500/30 text-brand-200 px-2 py-0.5 rounded-full font-mono">
                  New Customer
                </span>
              </div>
              <p className="text-[11px] text-gray-300 mt-0.5">
                Displays on bill · Auto-saves to directory once payment is complete
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
