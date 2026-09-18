// components/billing/SellerProfileSelector.tsx — Top bar Seller Profile dropdown & switcher
import { useState, useRef, useEffect } from 'react'
import { Building2, ChevronDown, Check, Star } from 'lucide-react'
import { useBillingStore } from '../../store/useBillingStore'

interface Props {
  profiles: any[]
  activeProfile: any
  onSelectProfile: (profile: any) => void
}

export default function SellerProfileSelector({ profiles, activeProfile, onSelectProfile }: Props) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const store = useBillingStore()

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  if (!profiles || profiles.length === 0) return null

  const current = activeProfile || profiles.find(p => p.is_default) || profiles[0]

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-brand-500/40 text-gray-200 text-xs font-medium transition-all shadow-sm group"
        title="Switch Seller GST Profile"
      >
        <div className="w-6 h-6 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
          <Building2 size={13} />
        </div>
        <div className="flex flex-col text-left leading-tight">
          <span className="font-semibold text-gray-100 flex items-center gap-1.5">
            <span className="max-w-[140px] truncate">{current?.business_name || 'Select Seller'}</span>
            {current?.is_default && (
              <span className="text-[10px] text-amber-400 flex items-center gap-0.5" title="Default Profile">
                <Star size={10} fill="currentColor" />
              </span>
            )}
          </span>
          <span className="text-[10px] font-mono text-gray-400">
            {current?.gstin || 'No GSTIN'}
          </span>
        </div>
        <ChevronDown size={14} className={`text-gray-400 ml-0.5 transition-transform duration-200 ${open ? 'rotate-180 text-brand-400' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-gray-900/95 backdrop-blur-xl border border-white/15 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Seller GST Profiles</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-semibold">{profiles.length} Available</span>
          </div>

          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
            {profiles.map((p) => {
              const isSelected = p.id === current?.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    store.setSellerProfileId(p.id)
                    onSelectProfile(p)
                    setOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-start justify-between transition-all ${
                    isSelected
                      ? 'bg-brand-600/20 border border-brand-500/40 text-white'
                      : 'hover:bg-white/5 border border-transparent text-gray-300'
                  }`}
                >
                  <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-100 truncate">{p.business_name}</span>
                      {p.is_default && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-medium">Default</span>
                      )}
                    </div>
                    {p.trade_name && (
                      <p className="text-[11px] text-gray-400 truncate">{p.trade_name}</p>
                    )}
                    <div className="flex items-center gap-2 pt-0.5 text-[10px] font-mono text-gray-400">
                      <span>{p.gstin}</span>
                      {p.state_code && <span>· State: {p.state_code}</span>}
                    </div>
                    {p.bank_name && (
                      <p className="text-[10px] text-gray-500 truncate pt-0.5">
                        🏦 {p.bank_name} {p.bank_account_no ? `(••••${p.bank_account_no.slice(-4)})` : ''}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
