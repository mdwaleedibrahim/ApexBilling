// components/dashboard/SalesDashboard.tsx
import { useEffect, useState } from 'react'
import { TrendingUp, Receipt, Users, AlertCircle, ArrowUpRight, BarChart2 } from 'lucide-react'
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
  const [breakdown, setBreakdown] = useState(false)
  const [topProducts, setTopProducts] = useState<any[]>([])

  const load = async () => {
    const [m, tp] = await Promise.all([api.dashboard.metrics(), api.dashboard.topProducts(period)])
    setMetrics(m)
    setTopProducts(tp)
  }

  useEffect(() => { load() }, [period])

  const monthly: any[] = metrics?.monthly || []
  const maxRev = Math.max(...monthly.map((m: any) => m.revenue), 1)

  return (
    <div className="p-6 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Today"      revenue={metrics?.today?.revenue}     count={metrics?.today?.count}     icon={TrendingUp} color="bg-brand-600" />
        <MetricCard label="This Week"  revenue={metrics?.thisWeek?.revenue}   count={metrics?.thisWeek?.count}  icon={BarChart2}  color="bg-emerald-600" />
        <MetricCard label="This Month" revenue={metrics?.thisMonth?.revenue}  count={metrics?.thisMonth?.count} icon={Receipt}    color="bg-amber-600" />
        <MetricCard label="This Year"  revenue={metrics?.thisYear?.revenue}   count={metrics?.thisYear?.count}  icon={ArrowUpRight} color="bg-purple-600" />
      </div>

      {/* Outstanding */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={15} className="text-red-400" />
            <span className="text-xs font-medium text-gray-400">Unpaid / Outstanding</span>
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

      {/* Revenue Chart */}
      <div className="glass-card p-5">
        <h2 className="section-title mb-4">12-Month Revenue</h2>
        <div className="flex items-end gap-1.5 h-36">
          {monthly.map((m: any, i: number) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
              <div
                className="w-full bg-brand-600/60 hover:bg-brand-500 rounded-t transition-all"
                style={{ height: `${Math.max(4, (m.revenue / maxRev) * 100)}%` }}
                title={`${m.month}: ${formatINR(m.revenue)}`}
              />
              <span className="text-[10px] text-gray-500 rotate-45 origin-left hidden group-hover:block absolute">{m.month?.slice(5)}</span>
            </div>
          ))}
          {monthly.length === 0 && <p className="text-gray-500 text-sm m-auto">No data yet</p>}
        </div>
        <div className="flex gap-1 mt-2 overflow-x-auto">
          {monthly.map((m: any) => (
            <span key={m.month} className="flex-1 text-center text-[10px] text-gray-500 min-w-[20px]">{m.month?.slice(5)}</span>
          ))}
        </div>
      </div>

      {/* Top Products + Customer Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Top Products</h2>
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
