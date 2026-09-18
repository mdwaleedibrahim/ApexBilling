import { useEffect, useState, useRef } from 'react'
import { CheckCircle } from 'lucide-react'
import CustomerSelector from './CustomerSelector'
import ItemEntryTable from './ItemEntryTable'
import SummaryCheckoutCard from './SummaryCheckoutCard'
import TermsAndConditionsCard from './TermsAndConditionsCard'
import MemorySlotBar from './MemorySlotBar'
import SellerProfileSelector from './SellerProfileSelector'
import A4InvoiceTemplate from '../print/A4InvoiceTemplate'
import { api } from '../../utils/api'
import { useBillingStore } from '../../store/useBillingStore'
import { WhatsAppIcon, shareInvoiceViaWhatsApp } from '../../utils/whatsappHelper'

export default function BillingWorkspace({ onEdit }: { onEdit?: (doc: any) => void } = {}) {
  const [profiles, setProfiles] = useState<any[]>([])
  const [storeSettings, setStoreSettings] = useState<any>(null)
  const [upiAccounts, setUpiAccounts] = useState<any[]>([])
  const [successDoc, setSuccessDoc] = useState<any>(null)
  const [showPrint, setShowPrint] = useState(false)
  const printTemplateRef = useRef<HTMLDivElement>(null)
  const store = useBillingStore()

  const loadProfiles = () => {
    api.settings.getProfiles().then(r => {
      const profs = r?.profiles || []
      setProfiles(profs)
      setStoreSettings(r?.storeSettings || null)
      setUpiAccounts(r?.upiAccounts || [])

      if (!useBillingStore.getState().sellerProfileId && profs.length > 0) {
        const def = profs.find((p: any) => p.is_default) || profs[0]
        useBillingStore.getState().setSellerProfileId(def.id)
      }
    }).catch(err => console.error('Failed loading profiles in BillingWorkspace:', err))
  }

  useEffect(() => {
    loadProfiles()
    window.addEventListener('focus', loadProfiles)
    document.addEventListener('visibilitychange', loadProfiles)
    return () => {
      window.removeEventListener('focus', loadProfiles)
      document.removeEventListener('visibilitychange', loadProfiles)
    }
  }, [])

  // F2 focuses item search, F4 saves quotation, F7 cash checkout, F8 UPI
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); document.getElementById('item-search')?.focus() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSuccess = (doc: any) => {
    setSuccessDoc(doc)
    setShowPrint(true)
  }

  const activeProfile = profiles.find(p => p.id === store.sellerProfileId) ||
                        profiles.find(p => p.is_default) ||
                        profiles[0] || null

  const combinedProfile = activeProfile ? {
    ...storeSettings,
    ...activeProfile,
    upiAccounts,
  } : null

  const handleWhatsAppShare = async () => {
    if (!successDoc) return
    await shareInvoiceViaWhatsApp(printTemplateRef.current, successDoc, combinedProfile)
  }

  return (
    <div className="p-4 h-full flex flex-col gap-4">
      {/* Slot bar + Seller Profile Selector + edit banner */}
      <div className="no-print flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <MemorySlotBar />
          <SellerProfileSelector
            profiles={profiles}
            activeProfile={activeProfile}
            onSelectProfile={(p) => store.setSellerProfileId(p.id)}
          />
        </div>
        {store.editingDocNumber && (
          <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-full">
            ✏️ Editing {store.editingDocNumber}
          </span>
        )}
      </div>

      {/* Main split */}
      <div className="no-print flex-1 grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 overflow-hidden">
        {/* Left: Customer + Items */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-1">
          <div className="glass-card p-4 relative z-30">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Customer</h3>
            <CustomerSelector />
          </div>
          <div className="glass-card p-4 flex-1 relative z-10">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Items</h3>
            <ItemEntryTable sellerProfile={combinedProfile} />
          </div>
          {/* Terms & Conditions Section */}
          <TermsAndConditionsCard
            sellerProfile={combinedProfile}
            onProfileUpdated={() => loadProfiles()}
          />
        </div>

        {/* Right: Summary + Checkout */}
        <div className="overflow-y-auto">
          <SummaryCheckoutCard onSuccess={handleSuccess} sellerProfile={combinedProfile} />
        </div>
      </div>

      {/* Print Preview Modal */}
      {showPrint && successDoc && (
        <div className="modal-backdrop">
          <div className="w-full max-w-3xl max-h-[95vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
            <div className="no-print flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle size={20} />
                <span className="font-semibold">{successDoc.doc_type === 'QUOTATION' ? 'Quotation' : 'Invoice'} saved!</span>
                <span className="text-gray-500 text-sm ml-1">{successDoc.doc_number}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleWhatsAppShare}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-500 flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                  title="Share generated PDF via WhatsApp"
                >
                  <WhatsAppIcon size={16} className="text-white" /> WhatsApp
                </button>
                <button onClick={() => window.print()} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-500">
                  🖨️ Print
                </button>
                <button onClick={() => { setShowPrint(false); setSuccessDoc(null) }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200">
                  Close
                </button>
              </div>
            </div>
            <div ref={printTemplateRef}>
              <A4InvoiceTemplate doc={successDoc} profile={combinedProfile} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
