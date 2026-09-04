// components/billing/BillingWorkspace.tsx — Main POS layout
import { useEffect, useState } from 'react'
import { CheckCircle } from 'lucide-react'
import CustomerSelector from './CustomerSelector'
import ItemEntryTable from './ItemEntryTable'
import SummaryCheckoutCard from './SummaryCheckoutCard'
import TermsAndConditionsCard from './TermsAndConditionsCard'
import MemorySlotBar from './MemorySlotBar'
import A4InvoiceTemplate from '../print/A4InvoiceTemplate'
import { api } from '../../utils/api'
import { useBillingStore } from '../../store/useBillingStore'

export default function BillingWorkspace({ onEdit }: { onEdit?: (doc: any) => void } = {}) {
  const [profile, setProfile] = useState<any>(null)
  const [successDoc, setSuccessDoc] = useState<any>(null)
  const [showPrint, setShowPrint] = useState(false)
  const store = useBillingStore()

  const loadProfile = () => {
    api.settings.getProfile().then(r => setProfile({ ...r?.profile, upiAccounts: r?.upiAccounts || [] }))
  }

  useEffect(() => {
    loadProfile()
    window.addEventListener('focus', loadProfile)
    document.addEventListener('visibilitychange', loadProfile)
    return () => {
      window.removeEventListener('focus', loadProfile)
      document.removeEventListener('visibilitychange', loadProfile)
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

  return (
    <div className="p-4 h-full flex flex-col gap-4">
      {/* Slot bar + edit banner */}
      <div className="flex items-center justify-between flex-shrink-0">
        <MemorySlotBar />
        {store.editingDocNumber && (
          <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-full">
            ✏️ Editing {store.editingDocNumber}
          </span>
        )}
      </div>

      {/* Main split */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 overflow-hidden">
        {/* Left: Customer + Items */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-1">
          <div className="glass-card p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Customer</h3>
            <CustomerSelector />
          </div>
          <div className="glass-card p-4 flex-1">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Items</h3>
            <ItemEntryTable sellerProfile={profile} />
          </div>
          {/* Terms & Conditions Section */}
          <TermsAndConditionsCard
            sellerProfile={profile}
            onProfileUpdated={(updated) => setProfile((prev: any) => ({ ...prev, ...updated }))}
          />
        </div>

        {/* Right: Summary + Checkout */}
        <div className="overflow-y-auto">
          <SummaryCheckoutCard onSuccess={handleSuccess} sellerProfile={profile} />
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
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-500">
                  🖨️ Print
                </button>
                <button onClick={() => { setShowPrint(false); setSuccessDoc(null) }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200">
                  Close
                </button>
              </div>
            </div>
            <A4InvoiceTemplate doc={successDoc} profile={profile} />
          </div>
        </div>
      )}
    </div>
  )
}
