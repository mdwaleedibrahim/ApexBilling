// components/billing/SummaryCheckoutCard.tsx — Totals + Checkout panel
import { useState, useEffect, useRef } from 'react'
import { CreditCard, Banknote, QrCode, Landmark, Clock, X, CheckCircle2 } from 'lucide-react'
import { useBillingStore } from '../../store/useBillingStore'
import { formatINR } from '../../utils/upiHelper'
import { api } from '../../utils/api'
import { useDialogStore } from '../../store/useDialogStore'

const MODE_ICONS: Record<string, any> = {
  CASH: Banknote, UPI: QrCode, CREDIT: Clock
}

interface Props {
  onSuccess: (doc: any) => void
  sellerProfile: any
}

export default function SummaryCheckoutCard({ onSuccess, sellerProfile }: Props) {
  const store = useBillingStore()
  const { totals, discountPct, setDiscountPct, additionalDiscount, setAdditionalDiscount,
          paymentMode, setPaymentMode, paymentStatus, setPaymentStatus, docType, setDocType,
          notes, setNotes, items, customer, docDate, setDocDate, editingDocId, editingDocNumber,
          paidAmount, setPaidAmount, partialPaymentMode, setPartialPaymentMode,
          convertingFromQuotationId, qrAmountType, setQrAmountType } = store
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showUpiModal, setShowUpiModal] = useState(false)
  const [discountMode, setDiscountMode] = useState<'PCT' | 'RUPEE'>('PCT')
  const submittingRef = useRef(false)

  const upiAccounts = sellerProfile?.upiAccounts || []

  const totalPurchaseCost = items.reduce((sum, i) => sum + (i.quantity * (i.purchasePrice || 0)), 0)
  const isLoss = totalPurchaseCost > 0 && totals.grandTotal < (totalPurchaseCost - 0.01)
  const isRegisteredCustomer = !!(customer?.phone && !customer.phone.startsWith('NO_PHONE_') && customer.phone.trim().length >= 7)

  // Tracking edit mode and previous payment status
  const isEditing = !!editingDocId
  const isOriginallyPaid = isEditing && docType === 'INVOICE' && (
    store.originalPaymentStatus === 'PAID' ||
    (store.originalPaymentMode !== 'CREDIT' && (store.originalPaidAmount || 0) >= (store.originalGrandTotal || 0) - 0.01)
  )
  const isTotalChanged = isEditing && Math.abs(totals.grandTotal - (store.originalGrandTotal || 0)) > 0.01
  const isTotalIncreased = isEditing && totals.grandTotal > (store.originalGrandTotal || 0) + 0.01
  const deltaAmount = isEditing ? Math.max(0, totals.grandTotal - (store.originalGrandTotal || 0)) : totals.grandTotal

  const handleSubmit = async (mode?: string, status?: string) => {
    if (submittingRef.current) return
    if (!items.length) { setError('Add at least one item'); return }

    const pm = mode || paymentMode
    const ps = status || paymentStatus

    // Requirement 2: Credit should only be given to a registered user. No walk-in
    if (pm === 'CREDIT' && !isRegisteredCustomer) {
      await useDialogStore.getState().show(
        'Credit can only be extended to a registered customer. Please select or add a customer with a valid phone number before selecting Credit mode.',
        false
      )
      return
    }

    // Enforce loss prevention rule: discount should never cause bill to be sold at a loss
    if (isLoss) {
      await useDialogStore.getState().show(
        `Discounts cannot cause net loss: Grand total (${formatINR(totals.grandTotal)}) is lower than total purchase cost (${formatINR(totalPurchaseCost)}). Please reduce discount.`,
        false
      )
      return
    }

    const belowCostItem = items.find(item => item.purchasePrice && (item.unitPrice * (1 - discountPct / 100)) < item.purchasePrice)
    if (belowCostItem) {
      await useDialogStore.getState().show(
        `Order price of "${belowCostItem.productName}" is lesser than purchase price. Increase price.`,
        false
      )
      return
    }

    submittingRef.current = true
    setLoading(true); setError('')
    try {
      const pm = mode || paymentMode
      const ps = status || paymentStatus
      const defaultUpi = upiAccounts.find((a: any) => a.is_default)?.upi_id || upiAccounts[0]?.upi_id || sellerProfile?.active_upi_id
      const selectedUpi = store.selectedUpiId || defaultUpi

      // Safety check: ensure quotation terms are submitted for quotations, and invoice terms for invoices
      let finalTerms = store.selectedTerms || []
      if (!editingDocId) {
        const isQuotation = docType === 'QUOTATION'
        let invTerms: string[] = []
        let quotTerms: string[] = []
        try {
          const invParsed = typeof sellerProfile?.invoice_terms === 'string' ? JSON.parse(sellerProfile.invoice_terms) : sellerProfile?.invoice_terms
          invTerms = Array.isArray(invParsed) && invParsed.length ? invParsed : ["Goods once sold can't be returned", "Goods can be exchanged with valid bill within 7 days of purchase"]
        } catch { invTerms = ["Goods once sold can't be returned", "Goods can be exchanged with valid bill within 7 days of purchase"] }
        try {
          const quotParsed = typeof sellerProfile?.quotation_terms === 'string' ? JSON.parse(sellerProfile.quotation_terms) : sellerProfile?.quotation_terms
          quotTerms = Array.isArray(quotParsed) && quotParsed.length ? quotParsed : ["Quotation valid for 3 days only"]
        } catch { quotTerms = ["Quotation valid for 3 days only"] }

        if (isQuotation && (finalTerms.length === 0 || finalTerms.every((t: string) => invTerms.includes(t) && !quotTerms.includes(t)))) {
          finalTerms = quotTerms
        } else if (!isQuotation && (finalTerms.length === 0 || finalTerms.every((t: string) => quotTerms.includes(t) && !invTerms.includes(t)))) {
          finalTerms = invTerms
        }
      }

      let finalPaidAmount = 0
      let finalPartialMode = null
      let finalPaymentStatus = ps

      if (isOriginallyPaid && !isTotalIncreased) {
        // Requirement 3: Total is same on previously settled invoice
        finalPaidAmount = totals.grandTotal
        finalPaymentStatus = 'PAID'
        finalPartialMode = null
      } else if (isOriginallyPaid && isTotalIncreased) {
        // Requirement 3: Total increased on previously settled invoice
        if (pm === 'CASH' || pm === 'UPI') {
          finalPaidAmount = totals.grandTotal
          finalPaymentStatus = 'PAID'
          finalPartialMode = pm === 'UPI' ? 'UPI' : 'CASH'
        } else if (pm === 'CREDIT') {
          if (ps === 'PAID') {
            finalPaidAmount = totals.grandTotal
            finalPaymentStatus = 'PAID'
            finalPartialMode = partialPaymentMode || 'CASH'
          } else if (ps === 'PARTIAL') {
            const added = Math.min(deltaAmount, Math.max(0, paidAmount))
            finalPaidAmount = (store.originalGrandTotal || 0) + added
            finalPaymentStatus = finalPaidAmount >= totals.grandTotal - 0.01 ? 'PAID' : 'PARTIAL'
            finalPartialMode = partialPaymentMode || 'CASH'
          } else {
            // UNPAID on the delta:
            finalPaidAmount = store.originalGrandTotal || 0
            finalPaymentStatus = 'PARTIAL'
            finalPartialMode = null
          }
        }
      } else if (pm === 'CREDIT') {
        if (ps === 'PARTIAL') {
          finalPaidAmount = Math.min(totals.grandTotal, (store.previouslyPaidAmount || 0) + Math.max(0, paidAmount))
          finalPartialMode = partialPaymentMode || 'CASH'
          // Requirement 4: If credit is fully paid, set status as PAID
          if (finalPaidAmount >= totals.grandTotal - 0.01) {
            finalPaymentStatus = 'PAID'
          }
        } else if (ps === 'PAID') {
          finalPaidAmount = totals.grandTotal
          finalPartialMode = partialPaymentMode || 'CASH'
          finalPaymentStatus = 'PAID'
        } else {
          finalPaidAmount = 0
          finalPartialMode = null
          finalPaymentStatus = 'UNPAID'
        }
      } else if (ps === 'PAID') {
        finalPaidAmount = totals.grandTotal
      }

      const body = {
        doc_type: docType,
        doc_date: docDate,
        customer_phone: customer?.phone || null,
        customer_snapshot: JSON.stringify(customer || {}),
        items: items.map(i => ({
          productId: i.productId, productName: i.productName, hsnSac: i.hsnSac, unit: i.unit,
          purchasePrice: i.purchasePrice, quantity: i.quantity, unitPrice: i.unitPrice, mrp: i.mrp, gstRate: i.gstRate,
        })),
        discount_pct: discountPct,
        additional_discount: totals.additionalDiscount || additionalDiscount || 0,
        payment_mode: pm,
        payment_status: finalPaymentStatus,
        paid_amount: finalPaidAmount,
        partial_payment_mode: finalPartialMode,
        converting_quotation_id: convertingFromQuotationId || undefined,
        notes,
        terms_and_conditions: finalTerms,
        selected_upi_id: selectedUpi,
        hide_tax_on_invoice: store.hideTaxOnInvoice ? 1 : 0,
        qr_amount_type: qrAmountType || 'DELTA',
      }
      const doc = editingDocId
        ? await api.documents.update(editingDocId, body)
        : await api.documents.create(body)
      store.clearCart()
      onSuccess(doc)
    } catch (e: any) {
      setError(e.message)
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  const handleUpiCheckout = () => {
    // If payment mode is already UPI, checkout directly with current selection.
    // Only prompt to select UPI account if clicking from Cash payment.
    if (paymentMode === 'CASH' && upiAccounts.length >= 2) {
      setShowUpiModal(true)
    } else {
      handleSubmit('UPI', 'PAID')
    }
  }

  const handleSubmitRef = useRef(handleSubmit)
  handleSubmitRef.current = handleSubmit
  const handleUpiCheckoutRef = useRef(handleUpiCheckout)
  handleUpiCheckoutRef.current = handleUpiCheckout

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (submittingRef.current) return
      // Hide & disable F7/F8 quick checkouts when in CREDIT payment mode
      if (paymentMode === 'CREDIT') return
      // Requirement 4: disable F7/F8 if total <= 0 (new) or total unchanged (editing paid invoice)
      if (!isEditing && totals.grandTotal <= 0) return
      if (isEditing && isOriginallyPaid && !isTotalIncreased) return

      if (e.key === 'F7') {
        e.preventDefault()
        handleSubmitRef.current('CASH', 'PAID')
      } else if (e.key === 'F8') {
        if (!editingDocId && docType === 'INVOICE') {
          e.preventDefault()
          handleUpiCheckoutRef.current()
        }
      } else if (e.key === 'F4') {
        e.preventDefault()
        if (docType === 'INVOICE') {
          setDocType('QUOTATION')
        } else {
          handleSubmitRef.current('CASH', 'UNPAID')
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [docType, editingDocId, paymentMode, totals.grandTotal, isEditing, isOriginallyPaid, isTotalIncreased])

  const row = (label: string, value: string, cls = '') => (
    <div className={`flex items-center justify-between text-sm ${cls}`}>
      <span className="text-gray-400">{label}</span>
      <span className="font-medium text-gray-200">{value}</span>
    </div>
  )

  const showProfitLoss = sellerProfile?.show_profit_loss_in_pos !== 0 && sellerProfile?.show_profit_loss_in_pos !== false
  const netRevenue = totals.rawGrandTotal
  const profitAmount = netRevenue - totalPurchaseCost
  const profitPct = totalPurchaseCost > 0 ? (profitAmount / totalPurchaseCost) * 100 : (netRevenue > 0 ? 100 : 0)

  return (
    <div className="glass-card p-5 space-y-4 sticky top-4">
      {/* Requirement 5: Cancel button beside editing Invoice */}
      {editingDocNumber && (
        <div className="flex items-center justify-between px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-400">
          <span className="font-medium">✏️ Editing {editingDocNumber} (Rev {store.revisionNumber + 1})</span>
          <button
            type="button"
            onClick={async () => {
              const ok = await useDialogStore.getState().show('Discard changes and cancel editing?', true, 'Discard Changes')
              if (ok) {
                store.clearCart()
              }
            }}
            className="flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-red-500/40 px-2 py-0.5 rounded-lg transition-colors border border-amber-500/30 hover:border-red-500/50"
            title="Discard changes and exit edit mode"
          >
            <X size={13} /> Cancel Edit
          </button>
        </div>
      )}

      {/* Doc type toggle */}
      <div className="flex rounded-xl overflow-hidden border border-white/10">
        {(['INVOICE','QUOTATION'] as const).map(t => (
          <button key={t} onClick={() => setDocType(t)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors
              ${docType === t ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Date */}
      <div>
        <label className="label">Date</label>
        <input type="date" className="input" value={docDate} onChange={e => setDocDate(e.target.value)} />
      </div>

      {/* Clubbed Discount Controls (% Discount and Discount ₹) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="label !mb-0 font-medium">Discount</span>
          <div className="flex rounded-lg overflow-hidden border border-white/10 text-[11px] p-0.5 bg-white/5">
            <button
              type="button"
              onClick={() => setDiscountMode('PCT')}
              className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                discountMode === 'PCT' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              % Discount
            </button>
            <button
              type="button"
              onClick={() => setDiscountMode('RUPEE')}
              className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                discountMode === 'RUPEE' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              Discount ₹
            </button>
          </div>
        </div>

        {discountMode === 'PCT' ? (
          <div className="relative">
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              className="input pr-8"
              placeholder="0.0"
              value={discountPct || ''}
              onChange={e => setDiscountPct(parseFloat(e.target.value) || 0)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs pointer-events-none">%</span>
          </div>
        ) : (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs pointer-events-none">₹</span>
            <input
              type="number"
              min={0}
              step={1}
              className="input pl-7 font-medium"
              placeholder="0.00"
              value={additionalDiscount || ''}
              onChange={e => setAdditionalDiscount(parseFloat(e.target.value) || 0)}
            />
          </div>
        )}

        {(discountPct > 0 || additionalDiscount > 0) && (
          <div className="flex items-center justify-between text-[11px] text-amber-400/90 pt-0.5 px-0.5">
            <span>
              Applied: {discountPct > 0 ? `${discountPct}%` : ''}
              {discountPct > 0 && additionalDiscount > 0 ? ' + ' : ''}
              {additionalDiscount > 0 ? formatINR(additionalDiscount) : ''}
              {' '}(Total −{formatINR((totals.discountAmount || 0) + (totals.additionalDiscount || 0))})
            </span>
            <button
              type="button"
              onClick={() => { setDiscountPct(0); setAdditionalDiscount(0); }}
              className="text-gray-400 hover:text-red-400 transition-colors underline text-[10px]"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Loss Guardrail Banner */}
      {isLoss && (
        <div className="p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-xs text-red-300 space-y-1">
          <div className="font-bold flex items-center gap-1 text-red-400">
            ⚠️ Revenue Loss Guardrail Active
          </div>
          <p>Discounts cannot cause bill to sell at a loss! Grand total ({formatINR(totals.grandTotal)}) cannot drop below total purchase cost ({formatINR(totalPurchaseCost)}).</p>
        </div>
      )}

      {/* Totals */}
      <div className="space-y-2 py-3 border-y border-white/10">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 pb-1 border-b border-white/5">
          <input type="checkbox" checked={store.hideTaxOnInvoice} onChange={e => store.setHideTaxOnInvoice(e.target.checked)} className="w-3.5 h-3.5 rounded accent-brand-500" />
          <span>Hide Tax breakdown on Invoice</span>
        </label>
        {row('Subtotal',       formatINR(totals.grossSubtotal))}
        {discountPct > 0 && row(`Discount (${discountPct}%)`, `− ${formatINR(totals.discountAmount)}`, 'text-amber-400')}
        {totals.additionalDiscount > 0 && row('Additional discount', `− ${formatINR(totals.additionalDiscount)}`, 'text-amber-400')}
        {!store.hideTaxOnInvoice && (
          <>
            {row('Taxable Amount', formatINR(totals.taxableAmount))}
            {row(`CGST`,           formatINR(totals.cgstTotal))}
            {row(`SGST`,           formatINR(totals.sgstTotal))}
          </>
        )}
        {totals.roundOff !== 0 && row('Round Off', (totals.roundOff >= 0 ? '+' : '') + formatINR(Math.abs(totals.roundOff)))}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <span className="text-base font-bold text-white">Total</span>
          <span className={`text-xl font-bold ${isLoss ? 'text-red-400' : 'text-emerald-400'}`}>{formatINR(totals.grandTotal)}</span>
        </div>
      </div>

      {/* Bill Profit / Loss Indicator (POS internal only) */}
      {showProfitLoss && items.length > 0 && (
        <div className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
          profitAmount >= 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          <span>{profitAmount >= 0 ? '📈 Est. Bill Profit' : '📉 Est. Bill Loss'}</span>
          <span className="font-bold text-sm">
            {profitAmount >= 0 ? '+' : ''}{formatINR(profitAmount)} ({profitPct.toFixed(1)}%)
          </span>
        </div>
      )}

      {/* Payment Mode (Invoices only) */}
      {docType === 'INVOICE' && (
        <>
          {/* Requirement 3: If invoice was fully paid and total is unchanged, disable payment modes */}
          {isOriginallyPaid && !isTotalIncreased ? (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                <CheckCircle2 size={16} /> Invoice Fully Settled ({formatINR(store.originalGrandTotal || totals.grandTotal)})
              </div>
              <p className="text-[11px] text-gray-400">
                All payments are complete. Payment modes are disabled because the invoice total has not increased.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label !mb-0 font-medium">
                  {isOriginallyPaid && isTotalIncreased
                    ? `Payment Mode for Extra Amount (${formatINR(deltaAmount)})`
                    : 'Payment Mode'}
                </label>
                {isOriginallyPaid && isTotalIncreased && (
                  <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    + {formatINR(deltaAmount)} New Due
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['CASH','UPI','CREDIT'] as const).map(m => {
                  const Icon = MODE_ICONS[m] || Banknote
                  const isCreditDisabled = m === 'CREDIT' && !isRegisteredCustomer
                  return (
                    <button key={m}
                      onClick={() => {
                        if (isCreditDisabled) {
                          setError('Credit is only allowed for registered customers with a phone number.')
                          return
                        }
                        setError('')
                        setPaymentMode(m)
                      }}
                      title={isCreditDisabled ? 'Credit is only allowed for registered customers' : m}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs transition-all font-medium
                        ${paymentMode === m ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30' : isCreditDisabled ? 'bg-white/5 text-gray-600 opacity-60 cursor-not-allowed' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                      <Icon size={16} />
                      <span className="text-[11px]">{m}</span>
                    </button>
                  )
                })}
              </div>
              {paymentMode === 'CREDIT' && !isRegisteredCustomer && (
                <div className="mt-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                  ⚠️ Credit is only allowed for registered customers. Please select or add a customer with a valid phone number.
                </div>
              )}
            </div>
          )}

          {/* UPI Account Selector if 2 or more accounts exist */}
          {paymentMode === 'UPI' && (
            upiAccounts.length >= 2 ? (
              <div>
                <label className="label">Select Scan to Pay UPI Account</label>
                <select
                  className="input text-xs font-mono !bg-[#111827] !border-gray-700 text-gray-100"
                  style={{ backgroundColor: '#111827', opacity: 1 }}
                  value={store.selectedUpiId || upiAccounts.find((a: any) => a.is_default)?.upi_id || upiAccounts[0]?.upi_id}
                  onChange={e => store.setSelectedUpiId(e.target.value)}
                >
                  {upiAccounts.map((a: any) => (
                    <option key={a.id} value={a.upi_id} style={{ backgroundColor: '#111827', color: '#f3f4f6' }}>
                      {a.label} — {a.upi_id} ({a.payee_name}) {a.is_default ? '★ Default' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="text-xs text-brand-300 bg-[#111827] border border-gray-700 rounded-xl p-2.5 flex items-center justify-between" style={{ backgroundColor: '#111827', opacity: 1 }}>
                <span>Scan to Pay UPI:</span>
                <span className="font-mono font-semibold text-emerald-400">
                  {sellerProfile?.active_upi_id || upiAccounts.find((a: any) => a.is_default)?.upi_id || upiAccounts[0]?.upi_id || (sellerProfile?.phone ? `${sellerProfile.phone}@upi` : 'Configured in Settings')}
                </span>
              </div>
            )
          )}

          {/* Requirement 1: Toggle for QR code (delta or full) for updated invoice with cash or UPI when total changes */}
          {isEditing && (paymentMode === 'CASH' || paymentMode === 'UPI') && isTotalChanged && deltaAmount > 0 && (
            <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="label !mb-0 text-brand-300 font-semibold flex items-center gap-1.5">
                  <QrCode size={14} /> Generate QR Code For:
                </label>
                <span className="text-[11px] text-gray-400">
                  {(qrAmountType || 'DELTA') === 'DELTA' ? `Delta: ${formatINR(deltaAmount)}` : `Full: ${formatINR(totals.grandTotal)}`}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setQrAmountType('DELTA')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    (qrAmountType || 'DELTA') === 'DELTA'
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-1 ring-brand-400'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  ⚡ Delta ({formatINR(deltaAmount)})
                </button>
                <button
                  type="button"
                  onClick={() => setQrAmountType('FULL')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    qrAmountType === 'FULL'
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-1 ring-brand-400'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Full Amount ({formatINR(totals.grandTotal)})
                </button>
              </div>
            </div>
          )}

          {/* Payment Status & Partial Mode Controls for Credit Invoices */}
          {paymentMode === 'CREDIT' && (!isOriginallyPaid || isTotalIncreased) && (
            <div className="space-y-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <div>
                <label className="label text-amber-300 font-medium">Payment Status</label>
                <select
                  className="input !bg-[#111827] !border-gray-700 text-gray-100"
                  style={{ backgroundColor: '#111827', opacity: 1 }}
                  value={paymentStatus}
                  onChange={e => setPaymentStatus(e.target.value)}
                >
                  {/* Requirement 2: Once partial payment is done, hide Unpaid (Full credit) */}
                  {(!editingDocId || (store.previouslyPaidAmount || 0) === 0) && (
                    <option value="UNPAID" style={{ backgroundColor: '#111827', color: '#f3f4f6' }}>Unpaid (Full Credit)</option>
                  )}
                  <option value="PARTIAL" style={{ backgroundColor: '#111827', color: '#f3f4f6' }}>Partial Payment</option>
                  <option value="PAID" style={{ backgroundColor: '#111827', color: '#f3f4f6' }}>Paid in Full</option>
                </select>
              </div>

              {/* Requirement 6: Partial Payment Details (Amount + Cash/UPI Options + Aggregate Paid) */}
              {paymentStatus === 'PARTIAL' && (
                <div className="space-y-3 pt-2 border-t border-amber-500/20">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="label !mb-0 text-gray-300 font-semibold">
                        {editingDocId ? 'Additional Partial Payment' : 'Partial Amount Paid'}
                      </label>
                      <span className="text-xs text-gray-400">Total: {formatINR(totals.grandTotal)}</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">₹</span>
                      <input
                        type="number"
                        min={0}
                        max={Math.max(0, totals.grandTotal - (store.previouslyPaidAmount || 0))}
                        step={1}
                        className="input pl-7 font-semibold text-emerald-400"
                        placeholder="Enter amount paid"
                        value={paidAmount || ''}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0
                          const maxPayable = Math.max(0, totals.grandTotal - (store.previouslyPaidAmount || 0))
                          setPaidAmount(Math.min(maxPayable, Math.max(0, val)))
                        }}
                      />
                    </div>

                    {/* Requirement 6: Total Partial amount paid (aggregate of all partial amounts) shown above Remaining balance in green */}
                    {editingDocId && store.previouslyPaidAmount > 0 && (
                      <div className="flex items-center justify-between text-xs mt-2 px-2 py-1 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-300 font-medium">
                        <span>Total Partial Amount Paid:</span>
                        <span className="font-bold">{formatINR(store.previouslyPaidAmount)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs mt-1.5 px-1">
                      <span className="text-gray-400">Remaining Balance:</span>
                      <span className="font-bold text-amber-400">
                        {formatINR(Math.max(0, totals.grandTotal - ((store.previouslyPaidAmount || 0) + (paidAmount || 0))))}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="label text-gray-300 font-semibold">Partial Payment Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPartialPaymentMode('CASH')}
                        className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all ${
                          partialPaymentMode === 'CASH'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-1 ring-emerald-400'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <Banknote size={15} /> Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setPartialPaymentMode('UPI')}
                        className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all ${
                          partialPaymentMode === 'UPI'
                            ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-1 ring-brand-400'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <QrCode size={15} /> UPI / QR
                      </button>
                    </div>
                  </div>

                  {partialPaymentMode === 'UPI' && (
                    upiAccounts.length >= 2 ? (
                      <div>
                        <label className="label text-xs">UPI Account for Partial Payment</label>
                        <select
                          className="input text-xs font-mono !bg-[#111827] !border-gray-700 text-gray-100"
                          style={{ backgroundColor: '#111827', opacity: 1 }}
                          value={store.selectedUpiId || upiAccounts.find((a: any) => a.is_default)?.upi_id || upiAccounts[0]?.upi_id}
                          onChange={e => store.setSelectedUpiId(e.target.value)}
                        >
                          {upiAccounts.map((a: any) => (
                            <option key={a.id} value={a.upi_id} style={{ backgroundColor: '#111827', color: '#f3f4f6' }}>
                              {a.label} — {a.upi_id} ({a.payee_name})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="text-xs text-brand-300 bg-[#111827] border border-gray-700 rounded-xl p-2 flex items-center justify-between" style={{ backgroundColor: '#111827' }}>
                        <span>UPI Payee:</span>
                        <span className="font-mono font-semibold text-emerald-400">
                          {sellerProfile?.active_upi_id || upiAccounts[0]?.upi_id || (sellerProfile?.phone ? `${sellerProfile.phone}@upi` : 'Default')}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Requirement 7: Paid in full should display Cash & UPI payment modes same as partial payment mode */}
              {paymentStatus === 'PAID' && (
                <div className="space-y-3 pt-2 border-t border-amber-500/20">
                  {editingDocId && store.previouslyPaidAmount > 0 && (
                    <div className="flex items-center justify-between text-xs px-2 py-1 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-300 font-medium">
                      <span>Total Partial Amount Paid:</span>
                      <span className="font-bold">{formatINR(store.previouslyPaidAmount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-gray-400">Final Payment Amount:</span>
                    <span className="font-bold text-emerald-400">
                      {formatINR(Math.max(0, totals.grandTotal - (store.previouslyPaidAmount || 0)))}
                    </span>
                  </div>

                  <div>
                    <label className="label text-gray-300 font-semibold">Payment Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPartialPaymentMode('CASH')}
                        className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all ${
                          partialPaymentMode === 'CASH'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-1 ring-emerald-400'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <Banknote size={15} /> Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setPartialPaymentMode('UPI')}
                        className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all ${
                          partialPaymentMode === 'UPI'
                            ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-1 ring-brand-400'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        <QrCode size={15} /> UPI / QR
                      </button>
                    </div>
                  </div>

                  {partialPaymentMode === 'UPI' && (
                    upiAccounts.length >= 2 ? (
                      <div>
                        <label className="label text-xs">UPI Account for Full Payment</label>
                        <select
                          className="input text-xs font-mono !bg-[#111827] !border-gray-700 text-gray-100"
                          style={{ backgroundColor: '#111827', opacity: 1 }}
                          value={store.selectedUpiId || upiAccounts.find((a: any) => a.is_default)?.upi_id || upiAccounts[0]?.upi_id}
                          onChange={e => store.setSelectedUpiId(e.target.value)}
                        >
                          {upiAccounts.map((a: any) => (
                            <option key={a.id} value={a.upi_id} style={{ backgroundColor: '#111827', color: '#f3f4f6' }}>
                              {a.label} — {a.upi_id} ({a.payee_name})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="text-xs text-brand-300 bg-[#111827] border border-gray-700 rounded-xl p-2 flex items-center justify-between" style={{ backgroundColor: '#111827' }}>
                        <span>UPI Payee:</span>
                        <span className="font-mono font-semibold text-emerald-400">
                          {sellerProfile?.active_upi_id || upiAccounts[0]?.upi_id || (sellerProfile?.phone ? `${sellerProfile.phone}@upi` : 'Default')}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Notes */}
      <div>
        <label className="label">Notes</label>
        <textarea className="input resize-none h-16" placeholder="Payment terms, remarks…"
          value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{error}</p>}

      {/* Action Buttons */}
      <div className="space-y-2">
        {docType === 'INVOICE' ? (
          /* Case 1: Fresh bill and cart total is zero */
          (!editingDocId && totals.grandTotal <= 0) ? (
            <button disabled className="btn-primary w-full justify-center py-3 text-sm font-semibold opacity-50 cursor-not-allowed bg-gray-800 text-gray-400 border-gray-700">
              Add items to bill to checkout
            </button>
          ) : /* Case 2: Editing settled invoice and total is unchanged */
          (isOriginallyPaid && !isTotalIncreased) ? (
            <button
              onClick={() => handleSubmit(store.originalPaymentMode || 'CASH', 'PAID')}
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base font-semibold"
            >
              {loading ? 'Saving…' : 'Update Invoice'}
            </button>
          ) : /* Case 3: Editing settled invoice with increased total */
          (isOriginallyPaid && isTotalIncreased) ? (
            paymentMode === 'CREDIT' ? (
              <button
                onClick={() => handleSubmit('CREDIT', paymentStatus)}
                disabled={loading}
                className="btn-primary w-full justify-center py-3 text-base font-semibold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 border-0 shadow-lg shadow-amber-600/30"
              >
                <Clock size={18} />{' '}
                {loading
                  ? 'Saving…'
                  : paymentStatus === 'PARTIAL'
                  ? `Update Invoice (Paid ${formatINR(paidAmount || 0)} via ${partialPaymentMode})`
                  : paymentStatus === 'PAID'
                  ? `Update & Settle ${formatINR(deltaAmount)} via ${partialPaymentMode}`
                  : `Update Invoice (Extra ${formatINR(deltaAmount)} on Credit)`}
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleSubmit(paymentMode === 'UPI' ? 'UPI' : 'CASH', 'PAID')}
                  disabled={loading}
                  className="btn-primary w-full justify-center py-3 text-base font-semibold"
                >
                  {paymentMode === 'UPI' ? <QrCode size={18} /> : <Banknote size={18} />}
                  {' '}{loading ? 'Saving…' : `Update & Collect ${formatINR(deltaAmount)} via ${paymentMode} (${paymentMode === 'UPI' ? 'F8' : 'F7'})`}
                </button>
                {paymentMode === 'CASH' && (
                  <button onClick={handleUpiCheckout} disabled={loading} className="btn-secondary w-full justify-center py-2.5">
                    <QrCode size={16} /> UPI / QR Checkout ({formatINR(deltaAmount)}) (F8)
                  </button>
                )}
                {paymentMode === 'UPI' && (
                  <button onClick={() => handleSubmit('CASH', 'PAID')} disabled={loading} className="btn-secondary w-full justify-center py-2.5">
                    <Banknote size={16} /> Pay Extra via Cash (F7)
                  </button>
                )}
              </>
            )
          ) : /* Case 4: Standard invoice (New with total > 0, or editing un-settled invoice) */
          paymentMode === 'CREDIT' ? (
            <>
              {/* Credit Invoice Save Action (Requirement 3: Quick cash & UPI F7/F8 hidden on Credit mode) */}
              <button
                onClick={() => handleSubmit('CREDIT', paymentStatus)}
                disabled={loading}
                className="btn-primary w-full justify-center py-3 text-base font-semibold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 border-0 shadow-lg shadow-amber-600/30"
              >
                <Clock size={18} />{' '}
                {loading
                  ? 'Saving…'
                  : editingDocId
                  ? (paymentStatus === 'PARTIAL'
                      ? `Update Invoice (Paid ${formatINR(paidAmount || 0)} via ${partialPaymentMode})`
                      : paymentStatus === 'PAID'
                      ? `Update Credit Invoice (Paid via ${partialPaymentMode})`
                      : 'Update Credit Invoice (Unpaid)')
                  : paymentStatus === 'PARTIAL'
                  ? `Save Invoice (Paid ${formatINR(paidAmount || 0)} via ${partialPaymentMode})`
                  : paymentStatus === 'PAID'
                  ? `Save Credit Invoice (Paid via ${partialPaymentMode})`
                  : 'Save Credit Invoice (Unpaid)'}
              </button>
            </>
          ) : (
            <>
              {/* F7: Cash Checkout */}
              <button onClick={() => handleSubmit('CASH', 'PAID')} disabled={loading}
                className="btn-primary w-full justify-center py-3 text-base font-semibold">
                <Banknote size={18} /> {loading ? 'Saving…' : (editingDocId ? 'Update Invoice' : '⚡ Cash Checkout (F7)')}
              </button>
              {/* F8: UPI Checkout */}
              {!editingDocId && (
                <button onClick={handleUpiCheckout} disabled={loading}
                  className="btn-secondary w-full justify-center py-2.5">
                  <QrCode size={16} /> UPI / QR Checkout (F8)
                </button>
              )}
              {/* F4: Switch to Quotation */}
              {!editingDocId && (
                <button onClick={() => setDocType('QUOTATION')} disabled={loading}
                  className="btn-ghost w-full justify-center py-2 text-xs">
                  💾 Switch to Quotation Mode (F4)
                </button>
              )}
            </>
          )
        ) : (
          <>
            {/* Quotation Action: Save Quotation */}
            <button onClick={() => handleSubmit('CASH', 'UNPAID')} disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base font-semibold">
              💾 {loading ? 'Saving…' : (editingDocId ? 'Update Quotation' : 'Save Quotation (F4)')}
            </button>
          </>
        )}
      </div>

      {/* Multi-UPI Account Chooser Modal (when >= 2 accounts exist) */}
      {showUpiModal && (
        <div className="modal-backdrop" onClick={() => setShowUpiModal(false)}>
          <div className="bg-[#111827] border border-gray-700 rounded-2xl shadow-2xl p-5 max-w-md w-full space-y-4" style={{ backgroundColor: '#111827', opacity: 1 }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="section-title text-base flex items-center gap-2 mb-0 text-white">
                <QrCode size={18} className="text-brand-400" /> Select UPI Account
              </h3>
              <button onClick={() => setShowUpiModal(false)} className="btn-ghost p-1"><X size={16} /></button>
            </div>
            <p className="text-xs text-gray-400">Select which UPI account to generate the payment QR code for:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {upiAccounts.map((a: any) => (
                <div
                  key={a.id}
                  onClick={() => {
                    store.setSelectedUpiId(a.upi_id)
                    setShowUpiModal(false)
                    handleSubmit('UPI', 'PAID')
                  }}
                  className="p-3 rounded-xl border border-gray-700 bg-gray-800 hover:bg-brand-900/40 hover:border-brand-500 cursor-pointer transition-all flex items-center justify-between"
                  style={{ backgroundColor: '#1f2937' }}
                >
                  <div>
                    <p className="font-medium text-sm text-gray-100">{a.label} {a.is_default ? <span className="text-xs text-brand-400 ml-1">★ Default</span> : ''}</p>
                    <p className="text-xs font-mono text-brand-300">{a.upi_id}</p>
                    <p className="text-[11px] text-gray-400">{a.payee_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
