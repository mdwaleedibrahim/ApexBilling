import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Receipt, Users, Package,
  Settings, ChevronRight, Zap, Menu, X
} from 'lucide-react'
import SalesDashboard from './components/dashboard/SalesDashboard'
import BillingWorkspace from './components/billing/BillingWorkspace'
import RecordsHistoryTab from './components/history/RecordsHistoryTab'
import InventoryTable from './components/inventory/InventoryTable'
import CustomerDirectory from './components/customers/CustomerDirectory'
import SellerSettingsModal from './components/settings/SellerSettingsModal'

type Tab = 'dashboard' | 'billing' | 'history' | 'inventory' | 'customers' | 'settings'

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'billing',    label: 'POS Billing', icon: Zap },
  { id: 'history',    label: 'Records',     icon: Receipt },
  { id: 'customers',  label: 'Customers',   icon: Users },
  { id: 'inventory',  label: 'Inventory',   icon: Package },
] as const

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
          {sidebarOpen && <span className="font-bold text-white text-base tracking-tight">ApexBill</span>}
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
          <h1 className="text-sm font-semibold text-gray-300 capitalize">
            {NAV.find(n => n.id === tab)?.label ?? tab}
          </h1>
          <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400">Alt+B</kbd> Billing
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400">Alt+D</kbd> Dashboard
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
      {settingsOpen && <SellerSettingsModal onClose={() => setSettings(false)} />}
    </div>
  )
}
