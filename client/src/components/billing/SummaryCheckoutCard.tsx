// components/billing/SummaryCheckoutCard.tsx — Totals + Checkout panel
import { useState } from 'react'
import { CreditCard, Banknote, QrCode, Landmark, Clock, X } from 'lucide-react'
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
  const { totals, discountPct, setDiscountPct, paymentMode, setPaymentMode,
          paymentStatus, setPaymentStatus, docType, setDocType, notes, setNotes,
          items, customer, docDate, setDocDate, editingDocId, editingDocNumber } = store
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showUpiModal, setShowUpiModal] = useState(false)

  const upiAccounts = sellerProfile?.upiAccounts || []

  const handleSubmit = async (mode?: string, status?: string) => {
    if (!items.length) { setError('Add at least one item'); return }

    const belowCostItem = items.find(item => item.purchasePrice && (item.unitPrice * (1 - discountPct / 100)) < item.purchasePrice)
    if (belowCostItem) {
      await useDialogStore.getState().show(
        `Order price of "${belowCostItem.productName}" is lesser than purchase price. Increase price.`,
        false
      )
      return
    }

    setLoading(true); setError('')
    try {
      const pm = mode || paymentMode
      const ps = status || paymentStatus
      const defaultUpi = upiAccounts.find((a: any) => a.is_default)?.upi_id || upiAccounts[0]?.upi_id || sellerProfile?.active_upi_id
      const selectedUpi = store.selectedUpiId || defaultUpi

      const body = {
        doc_type: docType,
        doc_date: docDate,
        customer_phone: customer?.phone || null,
        customer_snapshot: JSON.stringify(customer || {}),
        items: items.map(i => ({
          productId: i.productId, productName: i.productName, hsnSac: i.hsnSac, unit: i.unit,
          purchasePrice: i.purchasePrice, quantity: i.quantity, unitPrice: i.unitPrice, gstRate: i.gstRate,
        })),
        discount_pct: discountPct,
        payment_mode: pm,
        payment_status: ps,
        notes,
        terms_and_conditions: store.selectedTerms,
        selected_upi_id: selectedUpi,
        hide_tax_on_invoice: store.hideTaxOnInvoice ? 1 : 0,
      }
      const doc = editingDocId
        ? await api.documents.update(editingDocId, body)
        : await api.documents.create(body)
      store.clearCart()
      onSuccess(doc)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpiCheckout = () => {
    if (upiAccounts.length >= 2 && !store.selectedUpiId) {
      setShowUpiModal(true)
    } else {
      handleSubmit('UPI', 'PAID')
    }
  }

  const row = (label: string, value: string, cls = '') => (
    <div className={`flex items-center justify-between text-sm ${cls}`}>
      <span className="text-gray-400">{label}</span>
      <span className="font-medium text-gray-200">{value}</span>
    </div>
  )

  const showProfitLoss = sellerProfile?.show_profit_loss_in_pos !== 0 && sellerProfile?.show_profit_loss_in_pos !== false
  const totalPurchaseCost = items.reduce((sum, i) => sum + (i.quantity * (i.purchasePrice || 0)), 0)
  const netRevenue = totals.rawGrandTotal
  const profitAmount = netRevenue - totalPurchaseCost
  const profitPct = totalPurchaseCost > 0 ? (profitAmount / totalPurchaseCost) * 100 : (netRevenue > 0 ? 100 : 0)

  return (
    <div className="glass-card p-5 space-y-4 sticky top-4">
      {editingDocNumber && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-400">
          ✏️ Editing {editingDocNumber} (Rev {store.revisionNumber + 1})
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

      {/* Discount */}
      <div>
        <label className="label">Discount %</label>
        <input type="number" min={0} max={100} step={0.5} className="input"
          value={discountPct} onChange={e => setDiscountPct(parseFloat(e.target.value) || 0)} />
      </div>

      {/* Totals */}
      <div className="space-y-2 py-3 border-y border-white/10">
        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 pb-1 border-b border-white/5">
          <input type="checkbox" checked={store.hideTaxOnInvoice} onChange={e => store.setHideTaxOnInvoice(e.target.checked)} className="w-3.5 h-3.5 rounded accent-brand-500" />
          <span>Hide Tax breakdown on Invoice</span>
        </label>
        {row('Subtotal',       formatINR(totals.grossSubtotal))}
        {discountPct > 0 && row(`Discount (${discountPct}%)`, `− ${formatINR(totals.discountAmount)}`, 'text-amber-400')}
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
          <span className="text-xl font-bold text-emerald-400">{formatINR(totals.grandTotal)}</span>
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
          <div>
            <label className="label">Payment Mode</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['CASH','UPI','CREDIT'] as const).map(m => {
                const Icon = MODE_ICONS[m] || Banknote
                return (
                  <button key={m} onClick={() => setPaymentMode(m)} title={m}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs transition-all font-medium
                      ${paymentMode === m ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                    <Icon size={16} />
                    <span className="text-[11px]">{m}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* UPI Account Selector if 2 or more accounts exist */}
          {paymentMode === 'UPI' && (
            upiAccounts.length >= 2 ? (
              <div>
                <label className="label">Select Scan to Pay UPI Account</label>
                <select
                  className="input text-xs font-mono"
                  value={store.selectedUpiId || upiAccounts.find((a: any) => a.is_default)?.upi_id || upiAccounts[0]?.upi_id}
                  onChange={e => store.setSelectedUpiId(e.target.value)}
                >
                  {upiAccounts.map((a: any) => (
                    <option key={a.id} value={a.upi_id}>
                      {a.label} — {a.upi_id} ({a.payee_name}) {a.is_default ? '★ Default' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="text-xs text-brand-300 bg-brand-600/10 border border-brand-500/30 rounded-xl p-2.5 flex items-center justify-between">
                <span>Scan to Pay UPI:</span>
                <span className="font-mono font-semibold text-emerald-400">
                  {sellerProfile?.active_upi_id || upiAccounts.find((a: any) => a.is_default)?.upi_id || upiAccounts[0]?.upi_id || (sellerProfile?.phone ? `${sellerProfile.phone}@upi` : 'Configured in Settings')}
                </span>
              </div>
            )
          )}

          {/* Payment Status for Credit Invoices */}
          {paymentMode === 'CREDIT' && (
            <div>
              <label className="label">Payment Status</label>
              <select className="input" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIAL">Partial</option>
                <option value="PAID">Paid</option>
              </select>
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
          <div className="glass-card p-5 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="section-title text-base flex items-center gap-2 mb-0">
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
                  className="p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-brand-600/20 hover:border-brand-500/50 cursor-pointer transition-all flex items-center justify-between"
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
