import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Receipt, Users, Package,
  Settings, ChevronRight, Zap, Menu, X, Clock
} from 'lucide-react'
import SalesDashboard from './components/dashboard/SalesDashboard'
import BillingWorkspace from './components/billing/BillingWorkspace'
import RecordsHistoryTab from './components/history/RecordsHistoryTab'
import InventoryTable from './components/inventory/InventoryTable'
import CustomerDirectory from './components/customers/CustomerDirectory'
import SellerSettingsModal from './components/settings/SellerSettingsModal'
import pkg from '../package.json'

type Tab = 'dashboard' | 'billing' | 'history' | 'inventory' | 'customers' | 'settings'

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'billing',    label: 'POS Billing', icon: Zap },
  { id: 'history',    label: 'Records',     icon: Receipt },
  { id: 'customers',  label: 'Customers',   icon: Users },
  { id: 'inventory',  label: 'Inventory',   icon: Package },
] as const

function TopHeaderClock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-brand-600/10 border border-brand-500/30 rounded-xl text-xs text-brand-300 font-mono shadow-sm">
      <Clock size={13} className="text-brand-400 animate-pulse" />
      <span>{dateStr} · {timeStr}</span>
    </div>
  )
}

export default function App() {
  const [tab, setTab]           = useState<Tab>('dashboard')
  const [sidebarOpen, setSidebar] = useState(true)
  const [settingsOpen, setSettings] = useState(false)

  // Global keyboard: Alt+1..5 handled in BillingWorkspace
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'b') { e.preventDefault(); setTab('billing') }
      if (e.altKey && e.key === 'd') { e.preventDefault(); setTab('dashboard') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-56' : 'w-16'} flex-shrink-0 flex flex-col bg-gray-900 border-r border-white/5 transition-all duration-200`}>
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-5 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
            <Zap size={16} className="text-white" />
          </div>
          {sidebarOpen && (
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-base tracking-tight">ApexBill</span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-brand-600/20 text-brand-300 border border-brand-500/30">v{pkg.version}</span>
            </div>
          )}
          <button onClick={() => setSidebar(!sidebarOpen)} className="ml-auto text-gray-500 hover:text-gray-300">
            {sidebarOpen ? <X size={15} /> : <Menu size={15} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id as Tab)}
              className={`nav-item w-full ${tab === id ? 'active' : ''}`}
              title={!sidebarOpen ? label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{label}</span>}
              {sidebarOpen && tab === id && <ChevronRight size={14} className="ml-auto opacity-50" />}
            </button>
          ))}
        </nav>

        {/* Settings */}
        <div className="p-2 border-t border-white/5">
          <button
            onClick={() => setSettings(true)}
            className={`nav-item w-full ${settingsOpen ? 'active' : ''}`}
            title={!sidebarOpen ? 'Settings' : undefined}
          >
            <Settings size={18} className="flex-shrink-0" />
            {sidebarOpen && <span>Settings</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Top bar */}
        <header className="h-12 flex items-center px-6 border-b border-white/5 bg-gray-900/50 backdrop-blur-sm flex-shrink-0">
          <h1 className="text-sm font-semibold text-gray-300 capitalize flex items-center gap-2">
            <span>{NAV.find(n => n.id === tab)?.label ?? tab}</span>
            <span className="text-[11px] font-mono text-gray-500 font-normal">· ApexBill v{pkg.version}</span>
          </h1>
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
            <div className="hidden sm:flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400">Alt+B</kbd> Billing
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400">Alt+D</kbd> Dashboard
            </div>
            <TopHeaderClock />
          </div>
        </header>

        {/* Views */}
        <div className="flex-1 overflow-auto">
          {tab === 'dashboard'  && <SalesDashboard />}
          {tab === 'billing'    && <BillingWorkspace />}
          {tab === 'history'    && <RecordsHistoryTab onEdit={(doc) => { setTab('billing') }} />}
          {tab === 'customers'  && <CustomerDirectory />}
          {tab === 'inventory'  && <InventoryTable />}
        </div>
      </main>

      {/* Settings Modal */}
      {settingsOpen && <SellerSettingsModal onClose={() => { setSettings(false); window.dispatchEvent(new Event('focus')) }} />}
    </div>
  )
}
