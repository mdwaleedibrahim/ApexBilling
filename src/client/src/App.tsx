import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Receipt, Users, Package,
  Settings, ChevronRight, Zap, Menu, X, Clock, BarChart3
} from 'lucide-react'
import SalesDashboard from './components/dashboard/SalesDashboard'
import BillingWorkspace from './components/billing/BillingWorkspace'
import RecordsHistoryTab from './components/history/RecordsHistoryTab'
import InventoryTable from './components/inventory/InventoryTable'
import CustomerDirectory from './components/customers/CustomerDirectory'
import CustomerAnalyticsTab from './components/analytics/CustomerAnalyticsTab'
import SellerSettingsModal from './components/settings/SellerSettingsModal'
import { useDialogStore } from './store/useDialogStore'
import { WhatsAppShareModal } from './utils/whatsappHelper'

function CustomDialog() {
  const { isOpen, title, message, isConfirm, isPrompt, promptPlaceholder, close } = useDialogStore()
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    if (isOpen) setInputValue('')
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-gray-900 border border-white/10 rounded-2xl max-w-md w-full shadow-2xl p-6 flex flex-col gap-4">
        <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">{title}</h3>
        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{message}</p>
        {isPrompt && (
          <div>
            <input
              type="text"
              autoFocus
              className="input w-full font-mono text-sm !bg-gray-950 !border-gray-700 text-gray-100"
              placeholder={promptPlaceholder || ''}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); close(inputValue) }
                else if (e.key === 'Escape') { e.preventDefault(); close(null) }
              }}
            />
          </div>
        )}
        <div className="flex justify-end gap-3 mt-2">
          {(isConfirm || isPrompt) && (
            <button
              type="button"
              onClick={() => close(isPrompt ? null : false)}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl transition-all text-sm font-medium"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={() => close(isPrompt ? inputValue : true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl shadow-lg shadow-brand-500/20 transition-all text-sm font-medium"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

type Tab = 'dashboard' | 'billing' | 'history' | 'customers' | 'inventory' | 'analytics' | 'settings'

const NAV = [
  { id: 'dashboard', label: 'Dashboard',          icon: LayoutDashboard },
  { id: 'billing',   label: 'POS Billing',         icon: Zap },
  { id: 'history',   label: 'Records',             icon: Receipt },
  { id: 'customers', label: 'Customers',           icon: Users },
  { id: 'inventory', label: 'Inventory',           icon: Package },
  { id: 'analytics', label: 'Customer Analytics',  icon: BarChart3 },
] as const

function TopHeaderClock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Explicitly render in IST (Asia/Kolkata) regardless of browser timezone setting
  const dateStr = now.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  })

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-brand-600/10 border border-brand-500/30 rounded-xl text-xs text-brand-300 font-mono shadow-sm">
      <Clock size={13} className="text-brand-400 animate-pulse" />
      <span>{dateStr} · {timeStr} IST</span>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('tab')
    if (t && ['dashboard', 'billing', 'history', 'inventory', 'customers', 'analytics'].includes(t)) {
      return t as Tab
    }
    return 'dashboard'
  })
  const [analyticsCustomerPhone, setAnalyticsCustomerPhone] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('customer') || null
  })

  // sidebarPinned: true = always expanded, false = collapsed to icon rail
  const [sidebarPinned, setSidebarPinned] = useState(true)
  // sidebarHovered: temporarily expand on hover when collapsed
  const [sidebarHovered, setSidebarHovered] = useState(false)

  const [settingsOpen, setSettings] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('settings') === 'true'
  })

  // Derived: sidebar is visually open if pinned OR hovered while collapsed
  const sidebarOpen = sidebarPinned || sidebarHovered

  // Global keyboard shortcuts
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

      {/* ── Sidebar ── */}
      <aside
        className={`${sidebarOpen ? 'w-56' : 'w-14'} no-print flex-shrink-0 flex flex-col bg-gray-900 border-r border-white/5 transition-[width] duration-200 ease-in-out overflow-hidden z-20`}
        onMouseEnter={() => { if (!sidebarPinned) setSidebarHovered(true) }}
        onMouseLeave={() => setSidebarHovered(false)}
      >
        {/* Logo / toggle row */}
        <div className="flex items-center gap-2 px-3 py-5 border-b border-white/5 min-h-[64px]">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
            <Zap size={16} className="text-white" />
          </div>
          {/* Brand name — fade in/out */}
          <div className={`flex items-center gap-1.5 overflow-hidden transition-all duration-200 ${sidebarOpen ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0'}`}>
            <span className="font-bold text-white text-base tracking-tight whitespace-nowrap">ApexBill</span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-brand-600/20 text-brand-300 border border-brand-500/30 whitespace-nowrap">
              v{__APP_VERSION__}
            </span>
          </div>
          {/* Pin/collapse toggle — always visible */}
          <button
            onClick={() => { setSidebarPinned(p => !p); setSidebarHovered(false) }}
            className="ml-auto text-gray-500 hover:text-gray-300 flex-shrink-0 transition-colors"
            title={sidebarPinned ? 'Collapse sidebar' : 'Pin sidebar open'}
          >
            {sidebarPinned ? <X size={15} /> : <Menu size={15} />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id as Tab)}
              className={`nav-item w-full ${tab === id ? 'active' : ''} ${!sidebarOpen ? 'justify-center !px-0' : ''}`}
              title={!sidebarOpen ? label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className={`truncate transition-all duration-200 ${sidebarOpen ? 'opacity-100 max-w-xs ml-2' : 'opacity-0 max-w-0 ml-0'}`}>
                {label}
              </span>
              {sidebarOpen && tab === id && <ChevronRight size={14} className="ml-auto opacity-50 flex-shrink-0" />}
            </button>
          ))}
        </nav>

        {/* Settings pinned at bottom */}
        <div className="p-2 border-t border-white/5">
          <button
            onClick={() => setSettings(true)}
            className={`nav-item w-full ${settingsOpen ? 'active' : ''} ${!sidebarOpen ? 'justify-center !px-0' : ''}`}
            title={!sidebarOpen ? 'Settings' : undefined}
          >
            <Settings size={18} className="flex-shrink-0" />
            <span className={`truncate transition-all duration-200 ${sidebarOpen ? 'opacity-100 max-w-xs ml-2' : 'opacity-0 max-w-0 ml-0'}`}>
              Settings
            </span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Top bar */}
        <header className="no-print h-12 flex items-center px-6 border-b border-white/5 bg-gray-900/50 backdrop-blur-sm flex-shrink-0">
          <h1 className="text-sm font-semibold text-gray-300 capitalize flex items-center gap-2">
            <span>{NAV.find(n => n.id === tab)?.label ?? tab}</span>
            <span className="text-[11px] font-mono text-gray-500 font-normal">· ApexBill v{__APP_VERSION__}</span>
          </h1>
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
            <div className="hidden sm:flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400">Alt+B</kbd> Billing
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400">Alt+D</kbd> Dashboard
            </div>
            <TopHeaderClock />
          </div>
        </header>

        {/* Tab views */}
        <div className="flex-1 overflow-auto">
          {tab === 'dashboard' && <SalesDashboard />}
          {tab === 'billing'   && <BillingWorkspace />}
          {tab === 'history'   && <RecordsHistoryTab onEdit={() => setTab('billing')} />}
          {tab === 'customers' && (
            <CustomerDirectory
              onViewAnalytics={(phone) => {
                setAnalyticsCustomerPhone(phone)
                setTab('analytics')
              }}
            />
          )}
          {tab === 'inventory' && <InventoryTable />}
          {tab === 'analytics' && (
            <CustomerAnalyticsTab
              initialPhone={analyticsCustomerPhone}
              onEdit={() => setTab('billing')}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      {settingsOpen && (
        <SellerSettingsModal onClose={() => { setSettings(false); window.dispatchEvent(new Event('focus')) }} />
      )}
      <CustomDialog />
      <WhatsAppShareModal />
    </div>
  )
}
