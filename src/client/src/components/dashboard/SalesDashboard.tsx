// components/dashboard/SalesDashboard.tsx — PnL analytics & export report with Multi-Seller Filter
import { useEffect, useState } from 'react'
import {
  TrendingUp, Receipt, Users, ArrowUpRight,
  BarChart2, DollarSign, Download, Building2
} from 'lucide-react'
import { api } from '../../utils/api'
import { formatINR } from '../../utils/upiHelper'
import CustomerBreakdownModal from './CustomerBreakdownModal'

type Period = 'today' | 'week' | 'month' | 'year'

function MetricCard({ label, revenue, count, icon: Icon, color }: any) {
  return (
    <div className="glass-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{formatINR(revenue || 0)}</p>
        <p className="text-xs text-gray-400 mt-1">{count || 0} invoices</p>
      </div>
    </div>
  )
}

export default function SalesDashboard() {
  const [metrics, setMetrics] = useState<any>(null)
  const [period, setPeriod] = useState<Period>('month')
  const [pnlPeriod, setPnlPeriod] = useState<Period>('month')
  const [breakdown, setBreakdown] = useState(false)
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [selectedSellerId, setSelectedSellerId] = useState<string>('ALL')

  const load = async () => {
    try {
      const [m, tp, profs] = await Promise.all([
        api.dashboard.metrics(selectedSellerId),
        api.dashboard.topProducts(period, selectedSellerId),
        api.settings.getProfiles().catch(() => null),
      ])
      setMetrics(m)
      setTopProducts(tp || [])
      if (profs?.profiles) setProfiles(profs.profiles)
    } catch (e) {
      console.error('Error loading dashboard data:', e)
    }
  }

  useEffect(() => { load() }, [period, selectedSellerId])

  const monthly: any[] = metrics?.monthly || []
  const maxRev = Math.max(...monthly.map((m: any) => m.revenue), 1)

  // Selected PnL object based on pnlPeriod
  const pnlKey = pnlPeriod === 'today' ? 'today' : pnlPeriod === 'week' ? 'thisWeek' : pnlPeriod === 'month' ? 'thisMonth' : 'thisYear'
  const activePnl = metrics?.pnl?.[pnlKey] || { grossRevenue: 0, taxableRevenue: 0, totalGst: 0, cogs: 0, grossProfit: 0, profitMarginPct: 0 }

  const activeProfile = selectedSellerId !== 'ALL'
    ? profiles.find(p => p.id === selectedSellerId)
    : null

  // Export CSV Report Generator
  const exportCsvReport = () => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const bizName = activeProfile?.business_name || 'All Seller Profiles (Combined)'
    
    let csv = `ApexBill Sales & Profit/Loss Report\n`
    csv += `Business Name,${bizName}\n`
    csv += `GSTIN,${activeProfile?.gstin || 'Combined / Multiple GSTINs'}\n`
    csv += `Report Generated,${new Date().toLocaleString('en-IN')}\n\n`

    csv += `1. PROFIT AND LOSS (PnL) SUMMARY (${pnlPeriod.toUpperCase()})\n`
    csv += `Gross Sales Revenue (Tax Incl.),${activePnl.grossRevenue}\n`
    csv += `Net Taxable Sales,${activePnl.taxableRevenue}\n`
    csv += `GST Collected (CGST+SGST),${activePnl.totalGst}\n`
    csv += `Cost of Goods Sold (COGS),${activePnl.cogs}\n`
    csv += `Gross Profit,${activePnl.grossProfit}\n`
    csv += `Profit Margin (%),${activePnl.profitMarginPct.toFixed(2)}%\n\n`

    csv += `2. SALES PERFORMANCE METRICS\n`
    csv += `Period,Revenue,Invoice Count\n`
    csv += `Today,${metrics?.today?.revenue || 0},${metrics?.today?.count || 0}\n`
    csv += `This Week,${metrics?.thisWeek?.revenue || 0},${metrics?.thisWeek?.count || 0}\n`
    csv += `This Month,${metrics?.thisMonth?.revenue || 0},${metrics?.thisMonth?.count || 0}\n`
    csv += `This Year,${metrics?.thisYear?.revenue || 0},${metrics?.thisYear?.count || 0}\n`
    csv += `Unpaid / Outstanding Total,${metrics?.unpaidInvoicesTotal || 0}\n`
    csv += `Customer Balance Due Total,${metrics?.outstandingBalance || 0}\n\n`

    csv += `3. TOP PRODUCTS PERFORMANCE (${period.toUpperCase()})\n`
    csv += `Product Name,Units Sold,Total Revenue\n`
    topProducts.forEach((p: any) => {
      csv += `"${p.product_name}",${p.total_qty},${p.total_revenue}\n`
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ApexBill_Dashboard_Report_${todayStr}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header Banner with Seller Selector & Export Button */}
      <div className="glass-card p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-brand-900/40 via-brand-800/20 to-transparent border-brand-500/20">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {activeProfile?.business_name || 'Sales & PnL Analytics'}
          </h1>
          <p className="text-xs text-brand-300 mt-1">
            {activeProfile?.gstin ? `GSTIN: ${activeProfile.gstin} · ` : 'Combined Storewide · '}
            {selectedSellerId === 'ALL' ? 'Viewing combined performance across all Seller GST Profiles' : 'Filtered for selected Seller profile'}
          </p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {/* Seller GST profile filter dropdown */}
          <div className="flex items-center gap-2 bg-gray-900/80 border border-white/10 px-3 py-1.5 rounded-xl shadow-inner">
            <Building2 size={15} className="text-brand-400" />
            <span className="text-xs text-gray-400 font-medium">Seller:</span>
            <select
              value={selectedSellerId}
              onChange={(e) => setSelectedSellerId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-gray-100 focus:outline-none cursor-pointer pr-1"
            >
              <option value="ALL" className="bg-gray-900 text-gray-100">🏢 All Profiles (Combined)</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id} className="bg-gray-900 text-gray-100">
                  {p.business_name} ({p.gstin}){p.is_default ? ' ★' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={exportCsvReport}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all"
          >
            <Download size={14} />
            <span>Export Report (CSV)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Today"      revenue={metrics?.today?.revenue}     count={metrics?.today?.count}     icon={TrendingUp} color="bg-brand-600" />
        <MetricCard label="This Week"  revenue={metrics?.thisWeek?.revenue}   count={metrics?.thisWeek?.count}  icon={BarChart2}  color="bg-emerald-600" />
        <MetricCard label="This Month" revenue={metrics?.thisMonth?.revenue}  count={metrics?.thisMonth?.count} icon={Receipt}    color="bg-amber-600" />
        <MetricCard label="This Year"  revenue={metrics?.thisYear?.revenue}   count={metrics?.thisYear?.count}  icon={ArrowUpRight} color="bg-purple-600" />
      </div>

      {/* PROFIT & LOSS (PnL) SECTION */}
      <div className="glass-card p-6 border border-emerald-500/20 bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <DollarSign size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Profit & Loss Summary (PnL)</h2>
              <p className="text-xs text-emerald-400/80">Realized gross profit calculated from sales minus product purchase cost</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 bg-black/30 p-1 rounded-xl border border-white/10">
            {(['today', 'week', 'month', 'year'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPnlPeriod(p)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all capitalize ${
                  pnlPeriod === p
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'This Year'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[11px] font-medium text-gray-400">Gross Sales</span>
            <p className="text-base font-bold text-white mt-1">{formatINR(activePnl.grossRevenue)}</p>
          </div>
          <div className="p-3.5 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[11px] font-medium text-gray-400">Taxable Sales</span>
            <p className="text-base font-bold text-white mt-1">{formatINR(activePnl.taxableRevenue)}</p>
          </div>
          <div className="p-3.5 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[11px] font-medium text-gray-400">GST Collected</span>
            <p className="text-base font-bold text-amber-400 mt-1">{formatINR(activePnl.totalGst)}</p>
          </div>
          <div className="p-3.5 bg-white/5 rounded-xl border border-white/5">
            <span className="text-[11px] font-medium text-gray-400">Cost of Goods (COGS)</span>
            <p className="text-base font-bold text-rose-400 mt-1">{formatINR(activePnl.cogs)}</p>
          </div>
          <div className="p-3.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <span className="text-[11px] font-medium text-emerald-400">Gross Profit</span>
            <p className="text-base font-extrabold text-emerald-400 mt-1">{formatINR(activePnl.grossProfit)}</p>
          </div>
          <div className="p-3.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <span className="text-[11px] font-medium text-emerald-400">Profit Margin</span>
            <p className="text-base font-extrabold text-emerald-400 mt-1">{activePnl.profitMarginPct.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Monthly Sales Revenue Chart (12 Months) */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="section-title mb-0">Sales Trend (Last 12 Months)</h2>
            <p className="text-xs text-gray-500 mt-0.5">Monthly gross revenue comparison</p>
          </div>
        </div>

        <div className="h-44 flex items-end gap-2 pt-6 pb-2 px-2">
          {monthly.map((m: any, i: number) => {
            const heightPct = maxRev > 0 ? Math.round((m.revenue / maxRev) * 100) : 0
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                {m.revenue > 0 && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-gray-900 border border-white/20 text-[10px] px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-20 pointer-events-none text-brand-300">
                    {formatINR(m.revenue)} ({m.count} bills)
                  </div>
                )}
                <div
                  className={`w-full rounded-t-lg transition-all duration-300 ${
                    m.revenue > 0
                      ? 'bg-gradient-to-t from-brand-600 to-brand-400 hover:brightness-125'
                      : 'bg-white/5'
                  }`}
                  style={{ height: `${Math.max(heightPct, 4)}%` }}
                />
              </div>
            )
          })}
        </div>
        <div className="flex gap-2 pt-2 border-t border-white/5">
          {monthly.map((m: any, i: number) => (
            <span key={i} className={`flex-1 text-center text-[10px] font-mono ${m.revenue > 0 ? 'text-brand-300 font-bold' : 'text-gray-500'}`}>
              {m.label || m.month?.slice(5)}
            </span>
          ))}
        </div>
      </div>

      {/* Top Products + Customer Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Top Selling Products</h2>
            <select value={period} onChange={e => setPeriod(e.target.value as Period)}
              className="input !w-auto text-xs py-1 px-2">
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>
          <div className="space-y-2">
            {topProducts.slice(0, 6).map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-sm text-gray-200">{p.product_name}</p>
                  <p className="text-xs text-gray-500">{p.total_qty} units sold</p>
                </div>
                <span className="text-sm font-medium text-emerald-400">{formatINR(p.total_revenue)}</span>
              </div>
            ))}
            {topProducts.length === 0 && <p className="text-sm text-gray-500">No sales data yet.</p>}
          </div>
        </div>

        {/* Customer Breakdown */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Top Customers</h2>
            <button onClick={() => setBreakdown(true)} className="btn-ghost text-brand-400">View All</button>
          </div>
          <CustomerBreakdownSummary period={period} seller_profile_id={selectedSellerId} />
        </div>
      </div>

      {breakdown && <CustomerBreakdownModal period={period} seller_profile_id={selectedSellerId} onClose={() => setBreakdown(false)} />}
    </div>
  )
}

function CustomerBreakdownSummary({ period, seller_profile_id }: { period: Period; seller_profile_id?: string }) {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    api.dashboard.customerBreakdown(period, seller_profile_id).then(setRows).catch(() => setRows([]))
  }, [period, seller_profile_id])

  return (
    <div className="space-y-2">
      {rows.slice(0, 6).map((r: any, i: number) => {
        const snap = (() => { try { return JSON.parse(r.customer_snapshot) } catch { return {} } })()
        return (
          <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <div>
              <p className="text-sm text-gray-200">{snap.name || r.customer_phone || 'Walk-in'}</p>
              <p className="text-xs text-gray-500">{r.invoice_count} invoices</p>
            </div>
            <span className="text-sm font-medium text-brand-400">{formatINR(r.total_spend)}</span>
          </div>
        )
      })}
      {rows.length === 0 && <p className="text-sm text-gray-500">No data for this period.</p>}
    </div>
  )
}
