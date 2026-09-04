// components/dashboard/SalesDashboard.tsx — PnL analytics & export report
import { useEffect, useState } from 'react'
import {
  TrendingUp, Receipt, Users, AlertCircle, ArrowUpRight,
  BarChart2, DollarSign, Download, PieChart, ShieldCheck
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
  const [profile, setProfile] = useState<any>(null)

  const load = async () => {
    const [m, tp, p] = await Promise.all([
      api.dashboard.metrics(),
      api.dashboard.topProducts(period),
      api.settings.getProfile(),
    ])
    setMetrics(m)
    setTopProducts(tp)
    setProfile(p?.profile || null)
  }

  useEffect(() => { load() }, [period])

  const monthly: any[] = metrics?.monthly || []
  const maxRev = Math.max(...monthly.map((m: any) => m.revenue), 1)

  // Selected PnL object based on pnlPeriod
  const pnlKey = pnlPeriod === 'today' ? 'today' : pnlPeriod === 'week' ? 'thisWeek' : pnlPeriod === 'month' ? 'thisMonth' : 'thisYear'
  const activePnl = metrics?.pnl?.[pnlKey] || { grossRevenue: 0, taxableRevenue: 0, totalGst: 0, cogs: 0, grossProfit: 0, profitMarginPct: 0 }

  // Export CSV Report Generator
  const exportCsvReport = () => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const bizName = profile?.business_name || 'ApexBill Merchant'
    
    let csv = `ApexBill Sales & Profit/Loss Report\n`
    csv += `Business Name,${bizName}\n`
    csv += `GSTIN,${profile?.gstin || 'N/A'}\n`
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
      {/* Header Banner with Business Name & Export Button */}
      <div className="glass-card p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-brand-900/40 via-brand-800/20 to-transparent border-brand-500/20">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{profile?.business_name || 'My Business'}</h1>
          <p className="text-xs text-brand-300 mt-1">
            {profile?.gstin ? `GSTIN: ${profile.gstin} · ` : ''}Sales Performance & PnL Analytics Dashboard
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {profile?.trade_name && (
            <span className="px-3 py-1 bg-brand-500/20 border border-brand-500/30 text-brand-300 rounded-full text-xs font-semibold">
              {profile.trade_name}
            </span>
          )}
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
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Profit & Loss (PnL) Analysis
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {activePnl.profitMarginPct.toFixed(1)}% Margin
                </span>
              </h2>
              <p className="text-xs text-gray-400">Revenue, Cost of Goods Sold (COGS), Tax & Net Profit Breakdown</p>
            </div>
          </div>

          {/* PnL Period Selector */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
            {(['today', 'week', 'month', 'year'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPnlPeriod(p)}
                className={`px-3 py-1 rounded-lg capitalize transition-all ${
                  pnlPeriod === p ? 'bg-emerald-600 text-white font-semibold shadow-md' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : p === 'year' ? 'This Year' : 'Today'}
              </button>
            ))}
          </div>
        </div>

        {/* PnL Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <span className="text-xs font-medium text-gray-400">Gross Sales Revenue</span>
            <p className="text-xl font-bold text-white mt-1">{formatINR(activePnl.grossRevenue)}</p>
            <span className="text-[10px] text-gray-500 mt-1 block">Total Invoiced (Tax Incl.)</span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <span className="text-xs font-medium text-gray-400">Cost of Goods Sold (COGS)</span>
            <p className="text-xl font-bold text-amber-400 mt-1">{formatINR(activePnl.cogs)}</p>
            <span className="text-[10px] text-gray-500 mt-1 block">Inventory Purchase Cost</span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <span className="text-xs font-medium text-gray-400">GST Tax Collected</span>
            <p className="text-xl font-bold text-brand-400 mt-1">{formatINR(activePnl.totalGst)}</p>
            <span className="text-[10px] text-gray-500 mt-1 block">CGST + SGST Liability</span>
          </div>

          <div className={`border rounded-xl p-4 ${
            activePnl.grossProfit >= 0
              ? 'bg-emerald-600/10 border-emerald-500/30'
              : 'bg-red-600/10 border-red-500/30'
          }`}>
            <span className="text-xs font-medium text-gray-300">Gross Net Profit</span>
            <p className={`text-2xl font-black mt-1 ${activePnl.grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatINR(activePnl.grossProfit)}
            </p>
            <span className="text-[10px] text-emerald-300/80 mt-1 block font-semibold">
              Margin: {activePnl.profitMarginPct.toFixed(1)}% (Taxable Sales − COGS)
            </span>
          </div>
        </div>
      </div>

      {/* Outstanding Balances */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={15} className="text-red-400" />
            <span className="text-xs font-medium text-gray-400">Unpaid / Outstanding Invoices</span>
          </div>
          <p className="text-xl font-bold text-red-400">{formatINR(metrics?.unpaidInvoicesTotal || 0)}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Users size={15} className="text-brand-400" />
            <span className="text-xs font-medium text-gray-400">Customer Balance Due</span>
          </div>
          <p className="text-xl font-bold text-brand-400">{formatINR(metrics?.outstandingBalance || 0)}</p>
        </div>
      </div>

      {/* 12-Month Revenue Chart */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">12-Month Revenue Breakdown</h2>
          <span className="text-xs text-gray-400">Total Sales Trend</span>
        </div>
        <div className="flex items-end gap-1.5 h-36 pt-4 border-b border-white/10">
          {monthly.map((m: any, i: number) => {
            const heightPct = maxRev > 0 ? (m.revenue / maxRev) * 100 : 0
            const hasSales = m.revenue > 0
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                <div
                  className={`w-full rounded-t transition-all ${
                    hasSales
                      ? 'bg-brand-500 hover:bg-brand-400 shadow-md shadow-brand-500/20'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                  style={{ height: `${Math.max(6, heightPct)}%` }}
                  title={`${m.label || m.month}: ${formatINR(m.revenue)} (${m.count || 0} invoices)`}
                />
              </div>
            )
          })}
        </div>
        <div className="flex gap-1 mt-2">
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
          <CustomerBreakdownSummary period={period} />
        </div>
      </div>

      {breakdown && <CustomerBreakdownModal period={period} onClose={() => setBreakdown(false)} />}
    </div>
  )
}

function CustomerBreakdownSummary({ period }: { period: Period }) {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { api.dashboard.customerBreakdown(period).then(setRows) }, [period])
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
