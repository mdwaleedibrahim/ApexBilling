import { useEffect, useState, useRef } from 'react'
import ReactDOM from 'react-dom'
import {
  Search, Users, Calendar, ShoppingBag, DollarSign, Package,
  Eye, Edit, XCircle, Printer, X, FileCheck, ArrowDownWideNarrow,
  Clock, ShieldAlert, CheckCircle2, ChevronRight, Hash
} from 'lucide-react'
import { api } from '../../utils/api'
import { formatINR, formatDate } from '../../utils/upiHelper'
import { useBillingStore } from '../../store/useBillingStore'
import A4InvoiceTemplate from '../print/A4InvoiceTemplate'
import { WhatsAppIcon, shareInvoiceViaWhatsApp } from '../../utils/whatsappHelper'

interface Props {
  initialPhone?: string | null
  onEdit: (doc: any) => void
}

const STATUS_BADGE: Record<string, string> = {
  PAID: 'badge-paid',
  UNPAID: 'badge-unpaid',
  PARTIAL: 'badge-partial',
  CANCELLED: 'badge-cancelled',
}

export default function CustomerAnalyticsTab({ initialPhone, onEdit }: Props) {
  const [customers, setCustomers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPhone, setSelectedPhone] = useState<string | null>(initialPhone || null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Analytics state
  const [loading, setLoading] = useState(false)
  const [analyticsData, setAnalyticsData] = useState<any>(null)

  // Records / Documents state
  const [docs, setDocs] = useState<any[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docSearch, setDocSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modals & Refs
  const [profile, setProfile] = useState<any>(null)
  const [viewDoc, setViewDoc] = useState<any>(null)
  const [printDoc, setPrintDoc] = useState<any>(null)
  const [sharingDoc, setSharingDoc] = useState<any>(null)
  const hiddenPdfRef = useRef<HTMLDivElement>(null)
  const viewModalPdfRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const store = useBillingStore()

  // Load customer list and seller profile
  useEffect(() => {
    api.customers.list().then(list => {
      setCustomers(list || [])
      if (!selectedPhone && list && list.length > 0) {
        setSelectedPhone(list[0].phone)
      }
    }).catch(console.error)

    api.settings.getProfile().then(p => {
      setProfile(p?.profile ? { ...p.profile, upiAccounts: p.upiAccounts || [] } : null)
    }).catch(console.error)
  }, [])

  // When initialPhone prop changes from outside (e.g. shortcut clicked)
  useEffect(() => {
    if (initialPhone) {
      setSelectedPhone(initialPhone)
    }
  }, [initialPhone])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load Analytics Data when selectedPhone changes
  const loadAnalytics = async (phone: string) => {
    if (!phone) return
    setLoading(true)
    try {
      const data = await api.analytics.customer(phone)
      setAnalyticsData(data)
    } catch (e) {
      console.error('Failed to load customer analytics:', e)
    } finally {
      setLoading(false)
    }
  }

  // Load Customer Invoices & Quotations
  const loadCustomerDocs = async (phone: string) => {
    if (!phone) return
    setDocsLoading(true)
    try {
      const list = await api.documents.list({
        customer_phone: phone,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        search: docSearch.trim() || undefined,
      })
      setDocs(list || [])
    } catch (e) {
      console.error('Failed to load customer documents:', e)
    } finally {
      setDocsLoading(false)
    }
  }

  useEffect(() => {
    if (selectedPhone) {
      loadAnalytics(selectedPhone)
      loadCustomerDocs(selectedPhone)
    }
  }, [selectedPhone, typeFilter, statusFilter, docSearch])

  useEffect(() => {
    if (analyticsData?.customer) {
      setSearchTerm(`${analyticsData.customer.name} (${analyticsData.customer.phone})`)
    }
  }, [analyticsData?.customer])

  // Document actions matching RecordsHistoryTab
  const handleView = async (doc: any) => {
    const full = await api.documents.get(doc.id)
    setViewDoc(full)
  }

  const handleEdit = async (doc: any) => {
    const full = await api.documents.get(doc.id)
    store.loadFromDoc(full)
    onEdit(full)
  }

  const handleCancel = async (doc: any) => {
    if (!confirm(`Cancel ${doc.doc_number}? Stock will be restored.`)) return
    await api.documents.cancel(doc.id)
    if (selectedPhone) {
      loadAnalytics(selectedPhone)
      loadCustomerDocs(selectedPhone)
    }
  }

  const handleConvert = async (doc: any) => {
    const full = await api.documents.get(doc.id)
    store.convertQuotationToInvoice(full)
    if (viewDoc) setViewDoc(null)
    onEdit(full)
  }

  const handlePrint = async (doc: any) => {
    const full = await api.documents.get(doc.id)
    setPrintDoc(full)
    setTimeout(() => window.print(), 300)
  }

  const handleWhatsAppShare = async (doc: any) => {
    let targetElement: HTMLElement | null = null
    let fullDoc = doc
    if (viewDoc && viewDoc.id === doc.id && viewModalPdfRef.current) {
      targetElement = viewModalPdfRef.current
      fullDoc = viewDoc
    } else {
      fullDoc = (doc.items && doc.items.length) ? doc : await api.documents.get(doc.id)
      setSharingDoc(fullDoc)
      await new Promise(r => setTimeout(r, 120))
      targetElement = hiddenPdfRef.current
    }
    await shareInvoiceViaWhatsApp(targetElement, fullDoc, profile)
  }

  const customer = analyticsData?.customer
  const metrics = analyticsData?.metrics
  const purchasedItems: any[] = analyticsData?.purchasedItems || []
  const maxQty = purchasedItems.length > 0 ? Math.max(...purchasedItems.map(i => i.total_quantity || 0)) : 1

  const isExactSelected = !!(customer && searchTerm.trim() === `${customer.name} (${customer.phone})`)
  const filteredCustomers = (searchTerm.trim() && !isExactSelected)
    ? customers.filter(c =>
        (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.phone && c.phone.includes(searchTerm))
      )
    : customers

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── Top Header & Customer Autocomplete Combobox ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-4 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
            <Users size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">Customer Analytics</h2>
            <p className="text-xs text-gray-400">Sales, revenue, item purchase history and document records</p>
          </div>
        </div>

        {/* Autocomplete Customer Combobox */}
        <div className="relative min-w-[340px] max-w-lg w-full" ref={dropdownRef} style={{ position: 'relative' }}>
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3.5 text-gray-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              className="input !pl-9 !pr-16 !py-2 w-full text-sm font-medium bg-[#111827] focus:border-brand-500 rounded-xl"
              style={{ backgroundColor: '#111827' }}
              placeholder="Search or select client by name / phone…"
              value={searchTerm}
              onFocus={() => {
                if (inputRef.current) setDropdownRect(inputRef.current.getBoundingClientRect())
                setDropdownOpen(true)
              }}
              onChange={(e) => {
                if (inputRef.current) setDropdownRect(inputRef.current.getBoundingClientRect())
                setSearchTerm(e.target.value)
                setDropdownOpen(true)
              }}
            />

            <div className="absolute right-2.5 flex items-center gap-1">
              {(searchTerm || selectedPhone) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPhone(null)
                    setAnalyticsData(null)
                    setDocs([])
                    setSearchTerm('')
                    setDropdownOpen(true)
                    inputRef.current?.focus()
                  }}
                  className="p-1 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded-full transition-colors"
                  title="Clear customer"
                >
                  <X size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const next = !dropdownOpen
                  setDropdownOpen(next)
                  if (next) inputRef.current?.focus()
                }}
                className="text-xs text-brand-400 hover:text-brand-300 font-semibold p-1"
                title="Toggle client list"
              >
                {dropdownOpen ? '▲' : '▼'}
              </button>
            </div>
          </div>

          {dropdownOpen && dropdownRect && ReactDOM.createPortal(
            <div
              style={{
                position: 'fixed',
                top: dropdownRect.bottom + 6,
                left: dropdownRect.left,
                width: dropdownRect.width,
                zIndex: 9999,
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#0f172a',
                border: '1px solid #334155',
                boxShadow: '0 25px 70px rgba(0,0,0,0.95)',
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#1e293b',
                  borderBottom: '1px solid #334155',
                  color: '#94a3b8',
                }}
              >
                <span>{searchTerm.trim() && !isExactSelected ? 'Matching Clients' : 'All Clients'}</span>
                <span style={{ color: '#818cf8', fontFamily: 'monospace' }}>{filteredCustomers.length} clients</span>
              </div>

              {/* Scrollable list */}
              <div style={{ maxHeight: '320px', overflowY: 'auto', background: '#0f172a' }}>
                {filteredCustomers.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                    No clients found matching &ldquo;{searchTerm}&rdquo;
                  </div>
                ) : (
                  filteredCustomers.map(c => {
                    const isSelected = selectedPhone === c.phone
                    return (
                      <div
                        key={c.phone}
                        onClick={() => {
                          setSelectedPhone(c.phone)
                          setSearchTerm(`${c.name} (${c.phone})`)
                          setDropdownOpen(false)
                        }}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid #1e293b',
                          background: isSelected ? '#1d4ed8' : '#0f172a',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#1e293b' }}
                        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#0f172a' }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{c.name}</div>
                          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: isSelected ? '#bfdbfe' : '#64748b', marginTop: '2px' }}>{c.phone}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {c.outstanding_balance > 0 ? (
                            <>
                              <span style={{ fontSize: '10px', color: '#f87171', display: 'block', fontWeight: 500 }}>Due</span>
                              <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#f87171' }}>{formatINR(c.outstanding_balance)}</span>
                            </>
                          ) : (
                            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#34d399' }}>Clear</span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>

      {/* ── Empty state when no customer selected ── */}
      {!customer && (
        <div className="glass-card p-12 text-center rounded-2xl border border-white/10 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto">
            <Users size={28} />
          </div>
          <h3 className="text-lg font-bold text-white">No Customer Selected</h3>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Select a customer from the dropdown above or click the analytics shortcut beside any customer in the Customers tab to inspect their sales analytics, purchased items, and invoices.
          </p>
          <button
            onClick={() => setDropdownOpen(true)}
            className="btn-primary inline-flex items-center gap-2 mt-2"
          >
            <Search size={14} /> Select Customer
          </button>
        </div>
      )}

      {/* ── Selected Customer Profile Card ── */}
      {customer && (
        <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white">{customer.name}</h3>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  {customer.phone}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 mt-1">
                {customer.email && <span>✉️ {customer.email}</span>}
                {customer.gstin && <span>🏛️ GSTIN: {customer.gstin}</span>}
                {customer.billing_address && <span>📍 {customer.billing_address}</span>}
              </div>
            </div>

            {/* Quick Balance Status */}
            <div className="flex items-center gap-3">
              <div className="text-right px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Outstanding Due</span>
                <span className={`text-sm font-bold font-mono ${metrics?.allTime?.totalOutstanding > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {formatINR(metrics?.allTime?.totalOutstanding || customer.outstanding_balance || 0)}
                </span>
              </div>
              <div className="text-right px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Lifetime Spend</span>
                <span className="text-sm font-bold font-mono text-emerald-400">
                  {formatINR(metrics?.allTime?.revenue || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Metric Cards: Day, Week, Month, Year ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Day */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-600/15 to-blue-900/10 border border-blue-500/30 space-y-2">
              <div className="flex items-center justify-between text-blue-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Today (Day)</span>
                <Clock size={16} />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-white">
                  {formatINR(metrics?.today?.revenue || 0)}
                </div>
                <div className="text-xs text-blue-300/80 mt-0.5 flex items-center gap-1.5">
                  <ShoppingBag size={12} />
                  <span>{metrics?.today?.salesCount || 0} {metrics?.today?.salesCount === 1 ? 'sale' : 'sales'} today</span>
                </div>
              </div>
            </div>

            {/* Week */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-600/15 to-purple-900/10 border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between text-purple-400">
                <span className="text-xs font-semibold uppercase tracking-wider">This Week</span>
                <Calendar size={16} />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-white">
                  {formatINR(metrics?.thisWeek?.revenue || 0)}
                </div>
                <div className="text-xs text-purple-300/80 mt-0.5 flex items-center gap-1.5">
                  <ShoppingBag size={12} />
                  <span>{metrics?.thisWeek?.salesCount || 0} {metrics?.thisWeek?.salesCount === 1 ? 'sale' : 'sales'} this week</span>
                </div>
              </div>
            </div>

            {/* Month */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-600/15 to-emerald-900/10 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between text-emerald-400">
                <span className="text-xs font-semibold uppercase tracking-wider">This Month</span>
                <DollarSign size={16} />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-white">
                  {formatINR(metrics?.thisMonth?.revenue || 0)}
                </div>
                <div className="text-xs text-emerald-300/80 mt-0.5 flex items-center gap-1.5">
                  <ShoppingBag size={12} />
                  <span>{metrics?.thisMonth?.salesCount || 0} {metrics?.thisMonth?.salesCount === 1 ? 'sale' : 'sales'} this month</span>
                </div>
              </div>
            </div>

            {/* Year */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-600/15 to-amber-900/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between text-amber-400">
                <span className="text-xs font-semibold uppercase tracking-wider">This Year</span>
                <Package size={16} />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-white">
                  {formatINR(metrics?.thisYear?.revenue || 0)}
                </div>
                <div className="text-xs text-amber-300/80 mt-0.5 flex items-center gap-1.5">
                  <ShoppingBag size={12} />
                  <span>{metrics?.thisYear?.salesCount || 0} {metrics?.thisYear?.salesCount === 1 ? 'sale' : 'sales'} this year</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Section 2: All Items Purchased (Aggregated in Descending Order) ── */}
      <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowDownWideNarrow size={18} className="text-brand-400" />
            <h3 className="text-base font-bold text-white">All Items Purchased</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/30">
              Aggregated by Quantity (Descending)
            </span>
          </div>
          <span className="text-xs text-gray-400 font-mono">{purchasedItems.length} unique items</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-gray-400 text-xs">
                <th className="th w-10 text-center">#</th>
                <th className="th">Item Name</th>
                <th className="th w-24">HSN/SAC</th>
                <th className="th w-20">Unit</th>
                <th className="th w-44 text-right">Total Qty Purchased</th>
                <th className="th w-28 text-right">Avg Rate</th>
                <th className="th w-32 text-right">Total Spend</th>
                <th className="th w-24 text-center">Orders</th>
                <th className="th w-28 text-right">Last Ordered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {purchasedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="td text-center text-gray-500 py-8">
                    No items purchased yet by this customer.
                  </td>
                </tr>
              ) : (
                purchasedItems.map((item, idx) => {
                  const pct = Math.min(100, Math.round((item.total_quantity / maxQty) * 100))
                  return (
                    <tr key={idx} className="tr hover:bg-white/5">
                      <td className="td text-center font-mono text-xs text-gray-500">{idx + 1}</td>
                      <td className="td font-semibold text-white">
                        {item.product_name}
                      </td>
                      <td className="td font-mono text-xs text-gray-400">{item.hsn_sac || '—'}</td>
                      <td className="td text-xs text-gray-400">{item.unit || 'PCS'}</td>
                      <td className="td text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-bold font-mono text-emerald-400 text-sm">
                            {item.total_quantity} {item.unit || 'PCS'}
                          </span>
                          <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="td text-right font-mono text-xs text-gray-300">
                        {formatINR(item.avg_price)}
                      </td>
                      <td className="td text-right font-mono font-medium text-emerald-400 text-sm">
                        {formatINR(item.total_amount)}
                      </td>
                      <td className="td text-center font-mono text-xs text-gray-400">
                        {item.order_count}
                      </td>
                      <td className="td text-right font-mono text-xs text-gray-400">
                        {item.last_purchased_date ? formatDate(item.last_purchased_date) : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 3: All Customer Invoices & Quotations (Records with full actions) ── */}
      <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-brand-400" />
            <h3 className="text-base font-bold text-white">Invoices & Quotations</h3>
            <span className="text-xs text-gray-400">Filtered for this customer</span>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-36">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className="input !py-1 !pl-7 text-xs"
                placeholder="Search number…"
                value={docSearch}
                onChange={e => setDocSearch(e.target.value)}
              />
            </div>
            <select
              className="input !py-1 !w-32 text-xs"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="INVOICE">Invoice</option>
              <option value="QUOTATION">Quotation</option>
            </select>
            <select
              className="input !py-1 !w-32 text-xs"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="PAID">Paid</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIAL">Partial</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-gray-400 text-xs">
                <th className="th">Number</th>
                <th className="th">Date</th>
                <th className="th">Type</th>
                <th className="th text-center">Items</th>
                <th className="th text-right">Total</th>
                <th className="th text-right">Pending</th>
                <th className="th">Payment Status</th>
                <th className="th text-center">Rev</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="td text-center text-gray-500 py-8">
                    No documents found matching the filters for this customer.
                  </td>
                </tr>
              ) : (
                docs.map(doc => {
                  const pendingAmount = doc.doc_type === 'INVOICE' && doc.payment_status !== 'CANCELLED'
                    ? Math.max(0, doc.grand_total - (doc.paid_amount || 0))
                    : 0

                  return (
                    <tr key={doc.id} className="tr hover:bg-white/5">
                      <td className="td font-mono font-medium text-brand-300">
                        {doc.doc_number}
                      </td>
                      <td className="td text-xs text-gray-400 font-mono">
                        {formatDate(doc.doc_date)}
                      </td>
                      <td className="td">
                        <span className={doc.doc_type === 'INVOICE' ? 'badge-invoice' : 'badge-quotation'}>
                          {doc.doc_type}
                        </span>
                      </td>
                      <td className="td text-center font-mono text-xs text-gray-400">
                        {doc.item_count || '—'}
                      </td>
                      <td className="td text-right">
                        <span className="font-medium text-emerald-400 block font-mono">
                          {formatINR(doc.grand_total)}
                        </span>
                        {doc.payment_status === 'PARTIAL' && (
                          <span className="text-[11px] text-amber-400 block font-mono">
                            Paid: {formatINR(doc.paid_amount || 0)}
                          </span>
                        )}
                      </td>
                      <td className="td text-right">
                        {pendingAmount > 0 ? (
                          <span className="font-semibold text-red-400 font-mono text-xs block">
                            {formatINR(pendingAmount)}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs font-mono">—</span>
                        )}
                      </td>
                      <td className="td">
                        <span className={STATUS_BADGE[doc.payment_status] || 'badge-draft'}>
                          {doc.payment_status}
                        </span>
                      </td>
                      <td className="td text-center text-gray-500 text-xs font-mono">
                        v{doc.revision_number}
                      </td>
                    <td className="td text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleView(doc)}
                          className="btn-ghost p-1.5 text-blue-400"
                          title="View Document"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleWhatsAppShare(doc)}
                          className="btn-ghost p-1.5 text-emerald-400 hover:bg-emerald-500/20"
                          title="Share via WhatsApp"
                        >
                          <WhatsAppIcon size={15} className="text-emerald-400" />
                        </button>
                        <button
                          onClick={() => handlePrint(doc)}
                          className="btn-ghost p-1.5 text-gray-300"
                          title="Print"
                        >
                          <Printer size={14} />
                        </button>
                        {doc.doc_type === 'QUOTATION' && doc.payment_status !== 'CANCELLED' && (
                          <button
                            onClick={() => handleConvert(doc)}
                            className="btn-ghost p-1.5 text-emerald-400 hover:bg-emerald-500/20"
                            title="Convert to Tax Invoice"
                          >
                            <FileCheck size={14} />
                          </button>
                        )}
                        {doc.payment_status !== 'CANCELLED' && (
                          <button
                            onClick={() => handleEdit(doc)}
                            className="btn-ghost p-1.5 text-brand-400"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                        )}
                        {doc.payment_status !== 'CANCELLED' && (
                          <button
                            onClick={() => handleCancel(doc)}
                            className="btn-ghost p-1.5 text-red-400"
                            title="Cancel"
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── View Document Modal (Exact A4 Preview Parity) ── */}
      {viewDoc && (
        <div className="modal-backdrop" onClick={() => setViewDoc(null)}>
          <div className="w-full max-w-3xl max-h-[95vh] overflow-y-auto bg-white rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="no-print flex items-center justify-between p-4 border-b bg-gray-900 text-white rounded-t-2xl">
              <div>
                <span className="font-semibold text-lg">{viewDoc.doc_number}</span>
                <span className="ml-2 text-xs text-gray-400">({viewDoc.doc_type})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleWhatsAppShare(viewDoc)}
                  className="btn-primary text-xs py-1.5 bg-emerald-600 hover:bg-emerald-500 border-0 flex items-center gap-1.5 shadow-sm shadow-emerald-600/30"
                  title="Share generated PDF via WhatsApp"
                >
                  <WhatsAppIcon size={14} className="text-white" /> WhatsApp
                </button>
                {viewDoc.doc_type === 'QUOTATION' && viewDoc.payment_status !== 'CANCELLED' && (
                  <button onClick={() => handleConvert(viewDoc)} className="btn-primary text-xs py-1.5 bg-emerald-600 hover:bg-emerald-500 border-0">
                    <FileCheck size={14} /> Convert to Invoice
                  </button>
                )}
                <button onClick={() => { setPrintDoc(viewDoc); setTimeout(() => window.print(), 300) }} className="btn-primary text-xs py-1.5">
                  <Printer size={14} /> Print
                </button>
                <button onClick={() => setViewDoc(null)} className="btn-ghost text-gray-400 hover:text-white p-1">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div ref={viewModalPdfRef}>
              <A4InvoiceTemplate doc={viewDoc} profile={profile} />
            </div>
          </div>
        </div>
      )}

      {/* ── Hidden Print Container ── */}
      <div className="print-only">
        {printDoc && <A4InvoiceTemplate doc={printDoc} profile={profile} />}
      </div>

      {/* ── Hidden target for generating PDF when sharing directly from table row ── */}
      <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '800px', opacity: 0, pointerEvents: 'none' }}>
        <div ref={hiddenPdfRef}>
          {sharingDoc && <A4InvoiceTemplate doc={sharingDoc} profile={profile} />}
        </div>
      </div>
    </div>
  )
}
