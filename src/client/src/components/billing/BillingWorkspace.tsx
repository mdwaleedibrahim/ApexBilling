import { useEffect, useState, useRef, useCallback } from 'react'
import { CheckCircle, Eye, X, Printer } from 'lucide-react'
import CustomerSelector from './CustomerSelector'
import ItemEntryTable from './ItemEntryTable'
import SummaryCheckoutCard from './SummaryCheckoutCard'
import TermsAndConditionsCard from './TermsAndConditionsCard'
import MemorySlotBar from './MemorySlotBar'
import SellerProfileSelector from './SellerProfileSelector'
import A4InvoiceTemplate from '../print/A4InvoiceTemplate'
import InvoicePreviewModal from '../print/InvoicePreviewModal'
import { api } from '../../utils/api'
import { useBillingStore } from '../../store/useBillingStore'
import { useDataStore } from '../../store/useDataStore'
import { WhatsAppIcon, shareInvoiceViaWhatsApp } from '../../utils/whatsappHelper'
import { calcTotals } from '../../utils/gstEngine'

export default function BillingWorkspace({ onEdit }: { onEdit?: (doc: any) => void } = {}) {
  const profiles = useDataStore(s => s.profiles)
  const storeSettings = useDataStore(s => s.storeSettings)
  const upiAccounts = useDataStore(s => s.upiAccounts)

  const [successDoc, setSuccessDoc] = useState<any>(null)
  const [showPrint, setShowPrint] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewDocNumber, setPreviewDocNumber] = useState<string | null>(null)
  const printTemplateRef = useRef<HTMLDivElement>(null)
  const store = useBillingStore()
  // null = follow Settings; true = force show; false = force hide
  const [showPricingOverride, setShowPricingOverride] = useState<boolean | null>(null)

  const loadProfiles = () => {
    useDataStore.getState().refreshProfiles()
  }

  useEffect(() => {
    if (!useBillingStore.getState().sellerProfileId && profiles.length > 0) {
      const def = profiles.find((p: any) => p.is_default) || profiles[0]
      useBillingStore.getState().setSellerProfileId(def.id)
    }
  }, [profiles])

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

  /** Fetch the next invoice/quotation number for Preview display */
  const fetchPreviewNumber = useCallback(async (type: 'INVOICE' | 'QUOTATION') => {
    try {
      const res = await api.documents.nextNumber(type)
      setPreviewDocNumber(res.suggested)
    } catch { setPreviewDocNumber(null) }
  }, [])

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
      doc_number: s.editingDocNumber || (s.docType === 'INVOICE' ? s.customDocNumber : undefined) || previewDocNumber || `PREVIEW-${s.docType === 'QUOTATION' ? 'QT' : 'INV'}`,
      doc_date: s.docDate,
      doc_time: s.docTime,
      created_at: (() => {
        if (s.docDate && s.docTime) {
          const [hh, mm] = s.docTime.split(':').map(Number)
          const [y, m, d] = s.docDate.split('-').map(Number)
          const dt = new Date(y, m - 1, d, hh || 0, mm || 0, 0)
          if (!isNaN(dt.getTime())) return dt.toISOString()
        }
        return new Date().toISOString()
      })(),
      payment_mode: s.paymentMode,
      payment_status: s.paymentStatus,
      paid_amount: s.paidAmount || 0,
      hide_tax_on_invoice: s.hideTaxOnInvoice ? 1 : 0,
      hide_price_on_invoice: (s.hideTaxOnInvoice && s.hidePriceOnInvoice) ? 1 : 0,
      hide_discount: s.hideDiscount ? 1 : 0,
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
            onPreview={async () => {
              // For editing, we already know the doc number. For new, fetch next number.
              if (!store.editingDocNumber && !store.customDocNumber) {
                await fetchPreviewNumber(store.docType)
              } else {
                setPreviewDocNumber(store.customDocNumber || null)
              }
              setShowPreview(true)
            }}
          />
        </div>
      </div>

      {/* Pre-checkout Preview Modal */}
      {showPreview && (
        <InvoicePreviewModal
          doc={buildPreviewDoc()}
          profile={combinedProfile}
          title="Preview"
          titleIcon={<Eye size={14} className="text-brand-400" />}
          titleBadge={
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
              Draft · not saved
            </span>
          }
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Post-save Print Modal */}
      {showPrint && successDoc && (
        <InvoicePreviewModal
          doc={successDoc}
          profile={combinedProfile}
          title={`${successDoc.doc_type === 'QUOTATION' ? 'Quotation' : 'Invoice'} Saved`}
          titleIcon={<CheckCircle size={14} className="text-emerald-400" />}
          titleBadge={
            <span className="text-[10px] text-gray-400 font-mono">{successDoc.doc_number}</span>
          }
          actions={
            <>
              <button
                onClick={handleWhatsAppShare}
                className="btn-primary text-xs py-1.5 bg-emerald-600 hover:bg-emerald-500 border-0 flex items-center gap-1.5 shadow-sm shadow-emerald-900/40"
                title="Share via WhatsApp"
              >
                <WhatsAppIcon size={13} className="text-white" /> WhatsApp
              </button>
              <button
                onClick={() => window.print()}
                className="btn-primary text-xs py-1.5 flex items-center gap-1.5"
              >
                <Printer size={13} /> Print
              </button>
            </>
          }
          onClose={() => { setShowPrint(false); setSuccessDoc(null) }}
          templateRef={printTemplateRef}
        />
      )}
    </div>
  )
}
