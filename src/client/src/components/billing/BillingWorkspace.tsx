import { useEffect, useState, useRef } from 'react'
import { CheckCircle, Eye, X } from 'lucide-react'
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
import { calcTotals } from '../../utils/gstEngine'

export default function BillingWorkspace({ onEdit }: { onEdit?: (doc: any) => void } = {}) {
  const [profiles, setProfiles] = useState<any[]>([])
  const [storeSettings, setStoreSettings] = useState<any>(null)
  const [upiAccounts, setUpiAccounts] = useState<any[]>([])
  const [successDoc, setSuccessDoc] = useState<any>(null)
  const [showPrint, setShowPrint] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const printTemplateRef = useRef<HTMLDivElement>(null)
  const store = useBillingStore()
  // null = follow Settings; true = force show; false = force hide
  const [showPricingOverride, setShowPricingOverride] = useState<boolean | null>(null)

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

  /** Build a preview-doc from the live cart — mirrors the server's saved doc shape */
  const buildPreviewDoc = () => {
    const s = store
    const totals = calcTotals(s.items, s.discountPct, s.additionalDiscount)

    let terms: string[] = s.selectedTerms || []
    if (terms.length === 0 && combinedProfile) {
      try {
        const key = s.docType === 'QUOTATION' ? 'quotation_terms' : 'invoice_terms'
        const raw = combinedProfile[key]
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (Array.isArray(parsed)) terms = parsed
      } catch {}
    }

    return {
      doc_type: s.docType,
      doc_number: `PREVIEW-${s.docType === 'QUOTATION' ? 'QT' : 'INV'}`,
      doc_date: s.docDate,
      created_at: new Date().toISOString(),
      payment_mode: s.paymentMode,
      payment_status: s.paymentStatus,
      paid_amount: s.paidAmount || 0,
      hide_tax_on_invoice: s.hideTaxOnInvoice ? 1 : 0,
      hide_price_on_invoice: (s.hideTaxOnInvoice && s.hidePriceOnInvoice) ? 1 : 0,
      notes: s.notes,
      terms_and_conditions: JSON.stringify(terms),
      customer_snapshot: JSON.stringify(s.customer || {}),
      seller_profile_id: s.sellerProfileId,
      selected_upi_id: s.selectedUpiId || null,
      // Totals
      gross_subtotal: totals.grossSubtotal,
      discount_pct: totals.discountPct,
      discount_amount: totals.discountAmount,
      additional_discount: totals.additionalDiscount,
      taxable_amount: totals.taxableAmount,
      cgst_total: totals.cgstTotal,
      sgst_total: totals.sgstTotal,
      grand_total: totals.grandTotal,
      round_off: totals.roundOff,
      // Items mapped to snake_case with computed tax fields
      items: totals.items.map(i => ({
        product_id: i.productId,
        sku: i.sku || '',
        product_name: i.productName,
        hsn_sac: i.hsnSac || '',
        unit: i.unit || 'PCS',
        purchase_price: i.purchasePrice || 0,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        mrp: i.mrp || 0,
        gst_rate: i.gstRate,
        taxable_value: i.taxableValue,
        cgst_rate: i.cgstRate,
        cgst_amount: i.cgstAmount,
        sgst_rate: i.sgstRate,
        sgst_amount: i.sgstAmount,
        total_amount: i.totalAmount,
      })),
    }
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
            <ItemEntryTable sellerProfile={combinedProfile} showPricingOverride={showPricingOverride} />
          </div>
          {/* Terms & Conditions Section */}
          <TermsAndConditionsCard
            sellerProfile={combinedProfile}
            onProfileUpdated={() => loadProfiles()}
          />
        </div>

        {/* Right: Summary + Checkout */}
        <div className="overflow-y-auto">
          <SummaryCheckoutCard
            onSuccess={handleSuccess}
            sellerProfile={combinedProfile}
            showPricingOverride={showPricingOverride}
            onTogglePricing={(effectiveShow: boolean) => setShowPricingOverride(!effectiveShow)}
            onPreview={() => setShowPreview(true)}
          />
        </div>
      </div>

      {/* Pre-checkout Preview Modal */}
      {showPreview && (
        <div className="modal-backdrop" onClick={() => setShowPreview(false)}>
          <div
            className="w-full max-w-3xl max-h-[95vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="no-print flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Eye size={20} className="text-brand-400" />
                <span className="font-semibold text-gray-800">Preview</span>
                <span className="text-xs text-amber-600 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full font-medium ml-1">
                  Draft — not saved
                </span>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-200 transition-colors"
                title="Close preview"
              >
                <X size={18} />
              </button>
            </div>
            <A4InvoiceTemplate doc={buildPreviewDoc()} profile={combinedProfile} />
          </div>
        </div>
      )}

      {/* Post-save Print Preview Modal */}
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
