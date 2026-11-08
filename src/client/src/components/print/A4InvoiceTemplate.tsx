// components/print/A4InvoiceTemplate.tsx — Compact, minimalist, editorial GST A4/A5 print & view layout
import { Fragment } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { buildUpiLink, formatINR, formatDate, formatDateTime, amountInWords } from '../../utils/upiHelper'
import { checkFitsInA5 } from '../../utils/printHelper'

export { checkFitsInA5 }

export default function A4InvoiceTemplate({
  doc,
  profile,
  qrMode = 'default',
  fontScale = 1,
  pageSize = 'auto',
}: {
  doc: any
  profile?: any
  qrMode?: 'default' | 'balance'
  fontScale?: number
  pageSize?: 'auto' | 'A4' | 'A5'
}) {
  if (!doc) return null
  const sellerSnap = (() => {
    try {
      if (doc.seller_snapshot) {
        return typeof doc.seller_snapshot === 'string' ? JSON.parse(doc.seller_snapshot) : doc.seller_snapshot
      }
    } catch { }
    return null
  })()
  const seller = sellerSnap || profile || {}
  const items = doc.items || []
  const snap = (() => { try { return JSON.parse(doc.customer_snapshot) } catch { return {} } })()
  const defaultUpiAcc = profile?.upiAccounts?.find((a: any) => a.is_default) || profile?.upiAccounts?.[0]
  const upiId = doc.selected_upi_id || seller?.active_upi_id || profile?.active_upi_id || defaultUpiAcc?.upi_id || (seller?.phone ? `${seller.phone}@upi` : null)
  const payeeName = defaultUpiAcc?.payee_name || seller?.business_name || profile?.business_name || 'Merchant'

  const isQuotation = doc.doc_type === 'QUOTATION'
  const isPaid = !isQuotation && doc.payment_status === 'PAID'
  const isOverdue = !isQuotation && doc.payment_status === 'UNPAID'
  const isPartial = !isQuotation && doc.payment_status === 'PARTIAL'
  const isCredit = !isQuotation && doc.payment_mode === 'CREDIT'
  const balanceDue = Math.max(0, doc.grand_total - (doc.paid_amount || 0))

  // Parse payment history for credit invoices
  const paymentHistory: Array<{ date: string; amount: number; mode?: string }> = (() => {
    try {
      if (doc.payment_history) {
        const parsed = typeof doc.payment_history === 'string' ? JSON.parse(doc.payment_history) : doc.payment_history
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch { }
    if ((doc.paid_amount || 0) > 0 && isCredit) {
      return [{ date: doc.doc_date, amount: doc.paid_amount || 0, mode: doc.partial_payment_mode || 'CASH' }]
    }
    return []
  })()

  // Current partial payment: always use the current partial payment transaction amount, not total partial payments
  const currentPartialPayment = paymentHistory.length > 0
    ? (paymentHistory[paymentHistory.length - 1]?.amount || doc.paid_amount || 0)
    : (doc.paid_amount || 0)

  // QR amount calculation:
  // For partial payments: always show current partial payment
  // For updated invoices: show delta only if edited to change the total value and not set to FULL
  const isEditedWithChangedTotal = (doc.revision_number && doc.revision_number > 1) && paymentHistory.length > 1
  const isQrDelta = isEditedWithChangedTotal && doc.qr_amount_type !== 'FULL'
  const deltaAmount = isQrDelta ? (paymentHistory[paymentHistory.length - 1]?.amount || 0) : 0

  const qrAmount = (qrMode === 'balance' && balanceDue > 0)
    ? balanceDue
    : (isPartial
      ? currentPartialPayment
      : (isQrDelta && deltaAmount > 0 ? deltaAmount : doc.grand_total))

  const qrHeader = (qrMode === 'balance' && balanceDue > 0)
    ? `Scan to pay balance due (${formatINR(balanceDue)})`
    : (isPartial
      ? `Scan to pay partial (${formatINR(currentPartialPayment)})`
      : (isQrDelta && deltaAmount > 0
        ? `Scan to pay delta (${formatINR(deltaAmount)})`
        : 'Scan to pay'))

  const upiLink = upiId
    ? buildUpiLink({
      upiId,
      payeeName,
      amount: qrAmount,
      docNumber: doc.doc_number,
      note: qrMode === 'balance' ? `Invoice ${doc.doc_number} Balance Due` : undefined
    })
    : null
  const hideTax = !!doc.hide_tax_on_invoice
  const hidePrice = hideTax && !!doc.hide_price_on_invoice
  const hideDiscount = !!doc.hide_discount

  const formatPaymentDate = (dStr: string) => {
    if (!dStr) return ''
    const parts = dStr.split('T')[0].split('-')
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`
    }
    const d = new Date(dStr)
    if (isNaN(d.getTime())) return dStr
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}-${month}-${year}`
  }

  // Refined accents: Clean Indigo for Invoices, Crisp Ocean for Quotations
  const accentColor = isQuotation ? '#0284c7' : '#4338ca'

  const termsList: string[] = (() => {
    if (!doc.terms_and_conditions) return []
    try {
      const parsed = typeof doc.terms_and_conditions === 'string'
        ? JSON.parse(doc.terms_and_conditions)
        : doc.terms_and_conditions
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })()

  // Document discount percentage and rate (applied via discount % panel)
  const docDiscountPct = parseFloat(doc.discount_pct) || 0
  const pctDiscountRate = docDiscountPct > 0
    ? (docDiscountPct / 100)
    : (doc.gross_subtotal > 0 && (doc.discount_amount || 0) > 0
      ? ((doc.discount_amount || 0) / doc.gross_subtotal)
      : 0)
  const displayedDiscountPct = docDiscountPct > 0
    ? docDiscountPct
    : Math.round(pctDiscountRate * 100)

  // Additional flat rupee discount (applied via ₹ panel)
  const additionalRupeeDiscount = parseFloat(doc.additional_discount) || 0

  // Displayed subtotal: net after percentage discount, before flat rupee discount
  const pctDiscountAmount = doc.discount_amount != null
    ? parseFloat(doc.discount_amount)
    : ((doc.gross_subtotal || 0) * pctDiscountRate)
  const displayedSubtotal = Math.max(0, (doc.gross_subtotal || 0) - pctDiscountAmount)

  // Total customer savings across MRP markdown, percent discount, and rupee discount
  const totalSavings = items.reduce((sum: number, item: any) => {
    const mrp = parseFloat(item.mrp) || 0
    const origPrice = parseFloat(item.unit_price) || 0
    const qty = parseFloat(item.quantity) || 0
    const displayedPrice = origPrice * (1 - pctDiscountRate)
    const basePrice = mrp > origPrice ? mrp : origPrice
    const itemSaving = (basePrice - displayedPrice) * qty
    return itemSaving > 0.005 ? sum + itemSaving : sum
  }, 0) + additionalRupeeDiscount

  // Overall bill taxable amount, CGST, and SGST (recalculated after deducting additional_discount from Grand Total)
  const additionalDiscountRate = (additionalRupeeDiscount > 0 && displayedSubtotal > 0)
    ? (additionalRupeeDiscount / displayedSubtotal)
    : 0

  const summaryTax = items.reduce(
    (acc: { taxable: number; cgst: number; sgst: number }, item: any) => {
      const origPrice = parseFloat(item.unit_price) || 0
      const displayedPrice = origPrice * (1 - pctDiscountRate)
      const qty = parseFloat(item.quantity) || 1
      const lineTotal = qty * displayedPrice
      const gstRate = parseFloat(item.gst_rate) || 0
      const gstFactor = 1 + gstRate / 100

      if (additionalDiscountRate > 0) {
        const postAddlGross = lineTotal * (1 - additionalDiscountRate)
        const postTaxable = postAddlGross / gstFactor
        const postGst = postAddlGross - postTaxable
        acc.taxable += postTaxable
        acc.cgst += postGst / 2
        acc.sgst += postGst / 2
      } else {
        const lineTaxable = gstFactor > 0 ? (lineTotal / gstFactor) : lineTotal
        const lineGst = lineTotal - lineTaxable
        acc.taxable += lineTaxable
        acc.cgst += lineGst / 2
        acc.sgst += lineGst / 2
      }
      return acc
    },
    { taxable: 0, cgst: 0, sgst: 0 }
  )

  const docTaxableAmount = (doc.taxable_amount != null && additionalDiscountRate === 0)
    ? doc.taxable_amount
    : summaryTax.taxable
  const docCgstTotal = (doc.cgst_total != null && additionalDiscountRate === 0)
    ? doc.cgst_total
    : summaryTax.cgst
  const docSgstTotal = (doc.sgst_total != null && additionalDiscountRate === 0)
    ? doc.sgst_total
    : summaryTax.sgst

  const isA5 = pageSize === 'A5' || (pageSize === 'auto' && checkFitsInA5(doc, fontScale))
  const showQr = (((seller?.enable_scan_to_pay ?? profile?.enable_scan_to_pay) !== 0 && (seller?.enable_scan_to_pay ?? profile?.enable_scan_to_pay) !== false) || (qrMode === 'balance' && balanceDue > 0)) && !isQuotation && upiLink

  return (
    <div
      className={`print-container ${isA5 ? 'print-a5' : 'print-a4'} bg-white text-gray-900 relative`}
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: '#0f172a',
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
        margin: '0 auto',
        padding: isA5 ? '12px 16px' : '18px 24px',
        fontSize: `${fontScale * (isA5 ? 0.92 : 1)}em`,
        lineHeight: 1.35,
      }}
    >
      {/* Watermarks */}
      {isPaid && (
        <div style={{ position: 'absolute', top: '38%', left: '22%', opacity: 0.05, transform: 'rotate(-25deg)', fontSize: isA5 ? 75 : 110, fontWeight: 900, color: '#059669', pointerEvents: 'none', zIndex: 0, letterSpacing: '0.08em' }}>PAID</div>
      )}
      {isOverdue && (
        <div style={{ position: 'absolute', top: '38%', left: '16%', opacity: 0.05, transform: 'rotate(-25deg)', fontSize: isA5 ? 75 : 110, fontWeight: 900, color: '#dc2626', pointerEvents: 'none', zIndex: 0, letterSpacing: '0.08em' }}>OVERDUE</div>
      )}

      {/* ── 1. Compact Editorial Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isA5 ? 8 : 12, paddingBottom: isA5 ? 6 : 10, borderBottom: `1.5px solid ${accentColor}` }}>
        {/* Left: Seller identity */}
        <div style={{ maxWidth: '64%' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: isA5 ? '1.15em' : '1.25em', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {seller.business_name}
            </h1>
            {seller.trade_name && (
              <span style={{
                fontSize: '0.625em',
                fontWeight: 600,
                color: accentColor,
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                padding: '1px 5px',
                borderRadius: 3,
                lineHeight: 1.2,
              }}>
                {seller.trade_name}
              </span>
            )}
          </div>
          <p style={{ margin: '3px 0 0 0', color: '#475569', fontSize: '0.6875em', lineHeight: 1.35 }}>
            {seller.address_line1}{seller.address_line2 ? `, ${seller.address_line2}` : ''}
            {seller.city ? ` · ${seller.city} — ${seller.pincode}` : ''}
          </p>
          <div style={{ marginTop: 3, display: 'flex', gap: 10, fontSize: '0.65625em', color: '#64748b' }}>
            {seller.gstin && <span>GSTIN: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{seller.gstin}</strong></span>}
            {seller.phone && <span>Ph: <strong style={{ color: '#0f172a' }}>{seller.phone}</strong></span>}
          </div>
        </div>

        {/* Right: Document Identification */}
        <div style={{ textAlign: 'right', minWidth: isA5 ? 135 : 170 }}>
          <div style={{ fontSize: '0.8125em', fontWeight: 800, color: accentColor, letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.15 }}>
            {isQuotation ? 'Estimate / Quotation' : 'Tax Invoice'}
          </div>
          <div style={{ fontSize: '1em', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', letterSpacing: '-0.01em', marginTop: 2 }}>
            {doc.doc_number}
          </div>
          <div style={{ fontSize: '0.65625em', color: '#64748b', marginTop: 2 }}>
            <span>Date: </span>
            <strong style={{ color: '#334155' }}>{formatDateTime(doc.doc_date, doc.doc_time || doc.created_at)}</strong>
          </div>
          {doc.revision_number > 1 && (
            <span style={{ display: 'inline-block', marginTop: 2, fontSize: '0.59375em', fontWeight: 700, color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', padding: '1px 5px', borderRadius: 3 }}>
              Rev v{doc.revision_number}
            </span>
          )}
        </div>
      </div>

      {/* ── 2. Compact Bill To & Payment Summary (dynamically sized panels aligned left & right) ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: isA5 ? 6 : 10, tableLayout: 'auto' }}>
        <tbody>
          <tr>
            {/* Customer Panel: Left aligned, hugs content dynamically */}
            <td style={{ verticalAlign: 'top', padding: 0, textAlign: 'left' }}>
              <div style={{
                display: 'inline-block',
                padding: isA5 ? '4px 8px' : '6px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                background: '#f8fafc',
                textAlign: 'left',
                minWidth: isA5 ? 130 : 160,
                maxWidth: isQuotation ? '100%' : '56%',
                boxSizing: 'border-box'
              }}>
                <div style={{ fontSize: '0.59375em', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                  {isQuotation ? 'Quotation Issued To' : 'Billed To (Customer)'}
                </div>
                <div style={{ fontSize: '0.8125em', fontWeight: 700, color: '#0f172a' }}>
                  {snap.name || (snap.phone && !snap.phone.startsWith('NO_PHONE_') ? `Customer (${snap.phone})` : 'Walk-in Customer')}
                </div>
                {snap.phone && !snap.phone.startsWith('NO_PHONE_') && (
                  <div style={{ fontSize: '0.65625em', color: '#475569', marginTop: 1 }}>
                    Phone: <strong style={{ color: '#1e293b' }}>{snap.phone}</strong>
                  </div>
                )}
                {snap.billing_address && (
                  <div style={{ fontSize: '0.65625em', color: '#475569', marginTop: 1, lineHeight: 1.3 }}>
                    {snap.billing_address}
                  </div>
                )}
                {snap.gstin && (
                  <div style={{ fontSize: '0.65625em', color: '#475569', marginTop: 1 }}>
                    GSTIN: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{snap.gstin}</strong>
                  </div>
                )}
              </div>
            </td>

            {/* Payment Summary Box (Invoices only): Right aligned, hugs content dynamically */}
            {!isQuotation && (
              <td style={{ verticalAlign: 'top', padding: 0, textAlign: 'right' }}>
                <div style={{
                  display: 'inline-block',
                  padding: isA5 ? '4px 8px' : '6px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  background: '#f8fafc',
                  textAlign: 'left',
                  minWidth: isA5 ? 130 : 160,
                  maxWidth: '44%',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ fontSize: '0.59375em', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                    Payment Information
                  </div>
                  {isPartial ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: isA5 ? '2px 12px' : '3px 18px', fontSize: '0.65625em', marginTop: 2 }}>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.59375em' }}>Mode</span>
                        <strong style={{ color: '#0f172a', whiteSpace: 'nowrap' }}>
                          {doc.payment_mode === 'CREDIT' ? `CREDIT (${doc.partial_payment_mode || 'Cash'})` : (doc.payment_mode || 'CASH')}
                        </strong>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.59375em' }}>Status</span>
                        <span style={{ display: 'inline-block', fontSize: '0.59375em', fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', whiteSpace: 'nowrap' }}>
                          PARTIAL
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.59375em' }}>Amount Paid</span>
                        <strong style={{ color: '#15803d', whiteSpace: 'nowrap' }}>{formatINR(doc.paid_amount || 0)}</strong>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.59375em' }}>Balance Due</span>
                        <strong style={{ color: '#dc2626', whiteSpace: 'nowrap' }}>{formatINR(balanceDue)}</strong>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: isA5 ? 14 : 24, marginTop: 2 }}>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.59375em' }}>Mode</span>
                        <strong style={{ fontSize: '0.75em', color: '#0f172a', whiteSpace: 'nowrap' }}>{doc.payment_mode || 'CASH'}</strong>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.59375em' }}>Status</span>
                        <span style={{
                          display: 'inline-block',
                          fontSize: '0.625em',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 3,
                          backgroundColor: isPaid ? '#f0fdf4' : '#fffbeb',
                          color: isPaid ? '#15803d' : '#b45309',
                          border: `1px solid ${isPaid ? '#bbf7d0' : '#fde68a'}`,
                          whiteSpace: 'nowrap',
                        }}>
                          {doc.payment_status}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </td>
            )}
          </tr>
        </tbody>
      </table>

      {/* ── 3. High-Density Items Table ── */}
      {(() => {
        const showHsn = (() => {
          if (profile?.show_hsn_column !== undefined) {
            return profile.show_hsn_column !== 0 && profile.show_hsn_column !== false
          }
          if (seller?.show_hsn_column !== undefined) {
            return seller.show_hsn_column !== 0 && seller.show_hsn_column !== false
          }
          return true
        })()

        const shouldSpanFullLine = (name: string) => {
          if (!name) return false
          const maxChars = (hideTax ? (hidePrice ? 120 : 105) : 75) + (hideDiscount ? 15 : 0)
          const newlineCount = (name.match(/\n/g) || []).length
          return name.trim().length > maxChars || newlineCount >= 3
        }

        const tableColumns = hideTax
          ? (hidePrice
            ? [
              { id: 'num', label: '#', align: 'center' },
              { id: 'sku', label: 'SKU', align: 'left' },
              { id: 'desc', label: 'Item Description', align: 'left' },
              ...(showHsn ? [{ id: 'hsn', label: 'HSN', align: 'left' }] : []),
              { id: 'qty', label: 'Qty', align: 'center' },
              { id: 'unit', label: 'Unit', align: 'center' },
              ...(!hideDiscount ? [{ id: 'discount', label: 'Disc', align: 'center' }] : []),
              { id: 'total', label: 'Total', align: 'right' },
            ]
            : [
              { id: 'num', label: '#', align: 'center' },
              { id: 'sku', label: 'SKU', align: 'left' },
              { id: 'desc', label: 'Item Description', align: 'left' },
              ...(showHsn ? [{ id: 'hsn', label: 'HSN', align: 'left' }] : []),
              { id: 'qty', label: 'Qty', align: 'center' },
              { id: 'unit', label: 'Unit', align: 'center' },
              ...(!hideDiscount ? [{ id: 'discount', label: 'Disc', align: 'center' }] : []),
              { id: 'price', label: 'Price', align: 'right' },
              { id: 'total', label: 'Total', align: 'right' },
            ])
          : [
            { id: 'num', label: '#', align: 'center' },
            { id: 'sku', label: 'SKU', align: 'left' },
            { id: 'desc', label: 'Item Description', align: 'left' },
            ...(showHsn ? [{ id: 'hsn', label: 'HSN', align: 'left' }] : []),
            { id: 'qty', label: 'Qty', align: 'center' },
            { id: 'unit', label: 'Unit', align: 'center' },
            ...(!hideDiscount ? [{ id: 'discount', label: 'Disc', align: 'center' }] : []),
            { id: 'price', label: 'Price', align: 'right' },
            { id: 'taxable', label: 'Taxable', align: 'right' },
            { id: 'cgst', label: 'CGST', align: 'right' },
            { id: 'sgst', label: 'SGST', align: 'right' },
            { id: 'total', label: 'Total', align: 'right' },
          ]

        const totalCols = tableColumns.length

        return (
          <div className="items-table-wrapper" style={{ borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: isA5 ? 8 : 12, width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
            <table className="items-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1' }}>
                  {tableColumns.map((col) => (
                    <th
                      key={col.id}
                      style={{
                        width: col.id === 'desc' ? '100%' : 'auto',
                        padding: isA5 ? '4px 5px' : '6px 7px',
                        fontSize: isA5 ? '0.56em' : '0.6em',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: '#334155',
                        textAlign: col.align as any,
                        whiteSpace: 'nowrap',
                        boxSizing: 'border-box'
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, i: number) => {
                  const isLarge = shouldSpanFullLine(item.product_name)
                  const rowBg = i % 2 === 0 ? '#ffffff' : '#fcfcfd'

                  if (isLarge) {
                    return (
                      <Fragment key={i}>
                        {/* Full-width line for large item name */}
                        <tr style={{ background: rowBg, borderTop: i > 0 ? '1px solid #f1f5f9' : 'none', breakInside: 'avoid' }}>
                          <td
                            colSpan={totalCols}
                            style={{
                              padding: '5px 8px 2px 8px',
                              fontSize: '0.6875em',
                              fontWeight: 600,
                              color: '#0f172a',
                              lineHeight: 1.35,
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                              whiteSpace: 'normal',
                            }}
                          >
                            <span style={{ fontWeight: 700, color: '#64748b', marginRight: 5, fontSize: '0.625em' }}>#{i + 1}</span>
                            <span style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>{item.product_name}</span>
                            {!!item.mrp && (
                              <span style={{ fontSize: '0.5625em', color: '#64748b', fontWeight: 500, marginLeft: 8, whiteSpace: 'nowrap' }}>
                                (MRP {formatINR(item.mrp)})
                              </span>
                            )}
                          </td>
                        </tr>
                        {(() => {
                          const origPrice = parseFloat(item.unit_price) || 0
                          const displayedPrice = origPrice * (1 - pctDiscountRate)
                          const qty = parseFloat(item.quantity) || 1
                          const lineTotal = qty * displayedPrice
                          const gstRate = parseFloat(item.gst_rate) || 0
                          const gstFactor = 1 + gstRate / 100
                          const lineTaxable = gstFactor > 0 ? (lineTotal / gstFactor) : lineTotal
                          const totalGst = lineTotal - lineTaxable
                          const lineCgstRate = parseFloat(item.cgst_rate) || (gstRate / 2)
                          const lineSgstRate = parseFloat(item.sgst_rate) || (gstRate / 2)
                          const lineCgstAmount = totalGst / 2
                          const lineSgstAmount = totalGst - lineCgstAmount
                          const mrp = parseFloat(item.mrp) || 0

                          return (
                            <tr style={{ background: rowBg, borderBottom: '1px solid #f1f5f9', breakInside: 'avoid' }}>
                              <td style={{ padding: '2px 4px 5px 4px', textAlign: 'center', fontSize: '0.5625em', color: '#94a3b8', whiteSpace: 'nowrap' }}>↳</td>
                              <td style={{ padding: '2px 7px 5px 7px', fontSize: '0.625em', fontFamily: 'monospace', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {item.sku || '—'}
                              </td>
                              <td style={{ padding: '2px 8px 5px 8px' }}></td>
                              {showHsn && (
                                <td style={{ padding: '2px 7px 5px 7px', fontSize: '0.59375em', color: '#475569', whiteSpace: 'nowrap' }}>
                                  {item.hsn_sac || '—'}
                                </td>
                              )}
                              <td style={{ padding: '2px 6px 5px 6px', textAlign: 'center', fontSize: '0.65625em', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                {item.quantity}
                              </td>
                              <td style={{ padding: '2px 6px 5px 6px', textAlign: 'center', fontSize: '0.59375em', color: '#64748b', whiteSpace: 'nowrap' }}>
                                {item.unit || 'PCS'}
                              </td>
                              {!hideDiscount && (
                                <td style={{ padding: '2px 6px 5px 6px', textAlign: 'center', fontSize: '0.65625em', whiteSpace: 'nowrap' }}>
                                  {mrp > displayedPrice && mrp > 0 ? (
                                    <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.625em' }}>
                                      {Math.round(((mrp - displayedPrice) / mrp) * 100)}%
                                    </span>
                                  ) : displayedDiscountPct > 0 ? (
                                    <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.625em' }}>{displayedDiscountPct}%</span>
                                  ) : (
                                    <span style={{ color: '#94a3b8' }}>—</span>
                                  )}
                                </td>
                              )}
                              {!hidePrice && (
                                <td style={{ padding: '2px 7px 5px 7px', textAlign: 'right', fontSize: '0.65625em', color: '#334155', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                  {formatINR(displayedPrice)}
                                </td>
                              )}
                              {!hideTax && (
                                <td style={{ padding: '2px 7px 5px 7px', textAlign: 'right', fontSize: '0.65625em', color: '#334155', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                  {formatINR(lineTaxable)}
                                </td>
                              )}
                              {!hideTax && (
                                <td style={{ padding: '2px 7px 5px 7px', textAlign: 'right', fontSize: '0.59375em', color: '#64748b', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                  <span>{lineCgstRate}%</span>
                                  <span style={{ display: 'block', color: '#334155', fontWeight: 500, fontSize: '0.9em', whiteSpace: 'nowrap' }}>{formatINR(lineCgstAmount)}</span>
                                </td>
                              )}
                              {!hideTax && (
                                <td style={{ padding: '2px 7px 5px 7px', textAlign: 'right', fontSize: '0.59375em', color: '#64748b', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                  <span>{lineSgstRate}%</span>
                                  <span style={{ display: 'block', color: '#334155', fontWeight: 500, fontSize: '0.9em', whiteSpace: 'nowrap' }}>{formatINR(lineSgstAmount)}</span>
                                </td>
                              )}
                              <td style={{ padding: '2px 8px 5px 8px', textAlign: 'right', fontSize: '0.6875em', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                {formatINR(lineTotal)}
                              </td>
                            </tr>
                          )
                        })()}
                      </Fragment>
                    )
                  }

                  // Standard single line for compact item names
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: rowBg, breakInside: 'avoid' }}>
                      <td style={{ padding: '5px 6px', textAlign: 'center', fontSize: '0.625em', color: '#64748b', whiteSpace: 'nowrap' }}>{i + 1}</td>
                      <td style={{
                        padding: '5px 7px',
                        fontSize: '0.625em',
                        fontFamily: 'monospace',
                        color: '#334155',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}>
                        {item.sku || '—'}
                      </td>
                      <td style={{
                        padding: '5px 8px',
                        fontSize: '0.6875em',
                        fontWeight: 600,
                        color: '#0f172a',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                        whiteSpace: 'normal',
                        lineHeight: 1.3,
                      }}>
                        <div>{item.product_name}</div>
                        {!!item.mrp && (
                          <div style={{ fontSize: '0.5625em', color: '#64748b', fontWeight: 500, marginTop: 1, whiteSpace: 'nowrap' }}>
                            MRP {formatINR(item.mrp)}
                          </div>
                        )}
                      </td>
                      {showHsn && (
                        <td style={{ padding: '5px 7px', fontSize: '0.59375em', color: '#475569', whiteSpace: 'nowrap' }}>{item.hsn_sac || '—'}</td>
                      )}
                      <td style={{ padding: '5px 6px', textAlign: 'center', fontSize: '0.65625em', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{item.quantity}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'center', fontSize: '0.59375em', color: '#64748b', whiteSpace: 'nowrap' }}>{item.unit || 'PCS'}</td>
                      {(() => {
                        const origPrice = parseFloat(item.unit_price) || 0
                        const displayedPrice = origPrice * (1 - pctDiscountRate)
                        const qty = parseFloat(item.quantity) || 1
                        const lineTotal = qty * displayedPrice
                        const gstRate = parseFloat(item.gst_rate) || 0
                        const gstFactor = 1 + gstRate / 100
                        const lineTaxable = gstFactor > 0 ? (lineTotal / gstFactor) : lineTotal
                        const totalGst = lineTotal - lineTaxable
                        const lineCgstRate = parseFloat(item.cgst_rate) || (gstRate / 2)
                        const lineSgstRate = parseFloat(item.sgst_rate) || (gstRate / 2)
                        const lineCgstAmount = totalGst / 2
                        const lineSgstAmount = totalGst - lineCgstAmount
                        const mrp = parseFloat(item.mrp) || 0

                        return (
                          <>
                            {!hideDiscount && (
                              <td style={{ padding: '5px 6px', textAlign: 'center', fontSize: '0.65625em', whiteSpace: 'nowrap' }}>
                                {mrp > displayedPrice && mrp > 0 ? (
                                  <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.625em' }}>
                                    {Math.round(((mrp - displayedPrice) / mrp) * 100)}%
                                  </span>
                                ) : displayedDiscountPct > 0 ? (
                                  <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.625em' }}>{displayedDiscountPct}%</span>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>—</span>
                                )}
                              </td>
                            )}
                            {!hidePrice && (
                              <td style={{ padding: '5px 7px', textAlign: 'right', fontSize: '0.65625em', color: '#334155', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                {formatINR(displayedPrice)}
                              </td>
                            )}
                            {!hideTax && (
                              <td style={{ padding: '5px 7px', textAlign: 'right', fontSize: '0.65625em', color: '#334155', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                {formatINR(lineTaxable)}
                              </td>
                            )}
                            {!hideTax && (
                              <td style={{ padding: '5px 7px', textAlign: 'right', fontSize: '0.59375em', color: '#64748b', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                <span>{lineCgstRate}%</span>
                                <span style={{ display: 'block', color: '#334155', fontWeight: 500, fontSize: '0.9em', whiteSpace: 'nowrap' }}>{formatINR(lineCgstAmount)}</span>
                              </td>
                            )}
                            {!hideTax && (
                              <td style={{ padding: '5px 7px', textAlign: 'right', fontSize: '0.59375em', color: '#64748b', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                <span>{lineSgstRate}%</span>
                                <span style={{ display: 'block', color: '#334155', fontWeight: 500, fontSize: '0.9em', whiteSpace: 'nowrap' }}>{formatINR(lineSgstAmount)}</span>
                              </td>
                            )}
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: '0.6875em', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                              {formatINR(lineTotal)}
                            </td>
                          </>
                        )
                      })()}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })()}

      {/* ── 4. Unified Totals & Remittance Grid ── */}
      <div className="avoid-break" style={{ display: 'grid', gridTemplateColumns: isA5 ? '1fr 215px' : '1fr 265px', gap: isA5 ? 8 : 14, alignItems: 'start', breakInside: 'avoid', pageBreakInside: 'avoid' }}>

        {/* Left Column: Words, Bank Details, QR & Notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: isA5 ? 6 : 8 }}>
          {/* Amount in words */}
          <div style={{ padding: isA5 ? '4px 8px' : '6px 10px', borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0', borderLeft: `3px solid ${accentColor}` }}>
            <span style={{ fontSize: '0.59375em', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount in Words</span>
            <p style={{ margin: '1px 0 0 0', fontSize: '0.6875em', fontWeight: 600, color: '#1e293b', lineHeight: 1.3 }}>{amountInWords(doc.grand_total)}</p>
            {totalSavings >= 0.5 && (
              <p style={{ margin: '2px 0 0 0', fontSize: '0.59375em', color: '#166534', fontWeight: 500 }}>
                {isQuotation ? 'You could save ' : 'You saved '}
                <strong style={{ fontWeight: 700 }}>{formatINR(totalSavings)}</strong> ({amountInWords(totalSavings)})
              </p>
            )}
          </div>

          {/* Unified Remittance Block: Bank Details & UPI QR Code side-by-side */}
          {Boolean(seller.bank_name || showQr) && (
            <div style={{ padding: isA5 ? '5px 8px' : '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: isA5 ? 6 : 10 }}>
                {seller.bank_name && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.59375em', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                      Bank Account Details
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px', fontSize: '0.625em', color: '#334155' }}>
                      <span style={{ color: '#94a3b8' }}>Bank:</span>
                      <strong style={{ color: '#0f172a' }}>{seller.bank_name}</strong>
                      <span style={{ color: '#94a3b8' }}>A/c:</span>
                      <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{seller.bank_account_no}</strong>
                      <span style={{ color: '#94a3b8' }}>IFSC:</span>
                      <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{seller.bank_ifsc}</strong>
                      {seller.bank_branch && (
                        <>
                          <span style={{ color: '#94a3b8' }}>Branch:</span>
                          <span style={{ color: '#334155' }}>{seller.bank_branch}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Inline Compact QR */}
                {showQr && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingLeft: seller.bank_name ? 10 : 0, borderLeft: seller.bank_name ? '1px dashed #e2e8f0' : 'none', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.5625em', fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                      {qrMode === 'balance' && balanceDue > 0 ? 'Scan for balance' : 'Scan to pay'}
                    </span>
                    <div style={{ padding: 3, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 4, display: 'inline-block' }}>
                      <QRCodeSVG value={upiLink!} size={isA5 ? 54 : 68} />
                    </div>
                    <span style={{ fontSize: '0.5em', color: '#94a3b8', marginTop: 2 }}>UPI · GPay · PhonePe</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Terms & Conditions Section */}
          {termsList.length > 0 && (
            <div style={{ padding: isA5 ? '4px 8px' : '6px 10px', borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: isA5 ? '0.56em' : '0.59375em', color: '#475569' }}>
              <div style={{ fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2, fontSize: '0.5625em' }}>
                Terms & Conditions
              </div>
              <ol style={{ margin: 0, paddingLeft: 14, lineHeight: 1.35 }}>
                {termsList.map((term: string, idx: number) => (
                  <li key={idx} style={{ marginBottom: 1 }}>{term}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Remarks & Notes */}
          {doc.notes && (
            <div style={{ padding: isA5 ? '4px 6px' : '5px 8px', borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.625em', color: '#475569' }}>
              <strong style={{ color: '#334155' }}>Note:</strong> {doc.notes}
            </div>
          )}
        </div>

        {/* Right Column: Financial Calculations */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden', background: '#ffffff' }}>
          {[
            ['Subtotal', formatINR(displayedSubtotal)],
            additionalRupeeDiscount > 0 ? ['Discount', `− ${formatINR(additionalRupeeDiscount)}`] : null,
            !hideTax ? ['Taxable Value', formatINR(docTaxableAmount)] : null,
            !hideTax ? ['CGST Total', formatINR(docCgstTotal)] : null,
            !hideTax ? ['SGST Total', formatINR(docSgstTotal)] : null,
            doc.round_off !== 0 ? ['Round Off', (doc.round_off > 0 ? '+' : '') + formatINR(Math.abs(doc.round_off))] : null,
            (!isCredit && isPartial) ? ['Amount Paid', formatINR(doc.paid_amount || 0)] : null,
            (!isCredit && isPartial) ? ['Balance Due', formatINR(balanceDue)] : null,
          ].filter(Boolean).map(([label, value]: any, idx) => (
            <div
              key={label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: isA5 ? '3px 7px' : '4px 9px',
                fontSize: isA5 ? '0.625em' : '0.65625em',
                borderBottom: '1px solid #f1f5f9',
                background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span style={{ color: label === 'Balance Due' ? '#dc2626' : (label === 'Amount Paid' ? '#16a34a' : '#64748b'), fontWeight: isPartial && (label === 'Balance Due' || label === 'Amount Paid') ? 700 : 400 }}>
                {label}
              </span>
              <span style={{ fontWeight: 600, color: label === 'Balance Due' ? '#dc2626' : (label === 'Amount Paid' ? '#16a34a' : '#334155') }}>
                {value}
              </span>
            </div>
          ))}

          {/* Grand Total Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isA5 ? '4px 7px' : '6px 9px', background: '#0f172a', color: 'white' }}>
            <span style={{ fontSize: isA5 ? '0.7em' : '0.75em', fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Grand Total</span>
            <span style={{ fontSize: isA5 ? '0.88em' : '0.95em', fontWeight: 800, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{formatINR(doc.grand_total)}</span>
          </div>

          {/* Credit Payment Ledger */}
          {isCredit && (
            <div style={{ borderTop: '1px solid #e2e8f0', background: '#ffffff' }}>
              {paymentHistory.map((p, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: isA5 ? '3px 7px' : '4px 9px', fontSize: '0.625em', borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fcfcfd', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ color: '#475569', fontWeight: 500 }}>
                    Paid: {formatPaymentDate(p.date)}{p.mode ? ` (${p.mode})` : ''}
                  </span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatINR(p.amount)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: isA5 ? '3px 7px' : '4px 9px', fontSize: '0.65625em', borderBottom: '1px solid #e2e8f0', background: '#f0fdf4', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>Total Paid</span>
                <span style={{ fontWeight: 700, color: '#16a34a' }}>{formatINR(doc.paid_amount || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: isA5 ? '3px 7px' : '4px 9px', fontSize: '0.65625em', background: balanceDue > 0 ? '#fef2f2' : '#f8fafc', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: balanceDue > 0 ? '#dc2626' : '#64748b', fontWeight: 700 }}>Balance Due</span>
                <span style={{ fontWeight: 700, color: balanceDue > 0 ? '#dc2626' : '#64748b' }}>{formatINR(balanceDue)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Minimalist Printable Footer ── */}
      <div className="avoid-break" style={{ marginTop: isA5 ? 6 : 10, paddingTop: isA5 ? 4 : 6, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: isA5 ? '0.52em' : '0.56em', color: '#94a3b8', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <span>{isQuotation ? `Quotation Ref: ${doc.doc_number}` : `Tax Invoice Ref: ${doc.doc_number}`}</span>
        <span style={{ color: '#64748b' }}>{isQuotation ? 'Looking forward to doing business!' : 'Thank you for your business!'}</span>
        <span>Generated by ApexBill</span>
      </div>
    </div>
  )
}
