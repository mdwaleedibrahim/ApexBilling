// components/print/A4InvoiceTemplate.tsx — Ultra-modern, sleek GST A4 print & view layout
import { Fragment } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { buildUpiLink, formatINR, formatDate, formatDateTime, amountInWords } from '../../utils/upiHelper'

export default function A4InvoiceTemplate({ doc, profile }: { doc: any; profile: any }) {
  if (!doc || !profile) return null
  const items = doc.items || []
  const snap = (() => { try { return JSON.parse(doc.customer_snapshot) } catch { return {} } })()
  const defaultUpiAcc = profile?.upiAccounts?.find((a: any) => a.is_default) || profile?.upiAccounts?.[0]
  const upiId = doc.selected_upi_id || profile?.active_upi_id || defaultUpiAcc?.upi_id || (profile?.phone ? `${profile.phone}@upi` : null)
  const payeeName = defaultUpiAcc?.payee_name || profile?.business_name || 'Merchant'
  const upiLink = upiId
    ? buildUpiLink({ upiId, payeeName, amount: doc.grand_total, docNumber: doc.doc_number })
    : null
  
  const isQuotation = doc.doc_type === 'QUOTATION'
  const isPaid = !isQuotation && doc.payment_status === 'PAID'
  const isOverdue = !isQuotation && doc.payment_status === 'UNPAID'
  const hideTax = !!doc.hide_tax_on_invoice

  const accentColor = isQuotation ? '#0284c7' : '#4338ca' // Sky blue for Quotations, Deep Indigo for Invoices
  const headerBg = isQuotation ? 'linear-gradient(135deg, #0c4a6e, #0369a1)' : 'linear-gradient(135deg, #1e1b4b, #3730a3)'

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

  return (
    <div className="print-container bg-white text-gray-900 p-8 relative" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", minHeight: '297mm', color: '#0f172a' }}>
      
      {/* Watermarks */}
      {isPaid && (
        <div style={{ position: 'absolute', top: '38%', left: '22%', opacity: 0.06, transform: 'rotate(-25deg)', fontSize: 110, fontWeight: 900, color: '#059669', pointerEvents: 'none', zIndex: 0, letterSpacing: '0.08em' }}>PAID</div>
      )}
      {isOverdue && (
        <div style={{ position: 'absolute', top: '38%', left: '16%', opacity: 0.06, transform: 'rotate(-25deg)', fontSize: 110, fontWeight: 900, color: '#dc2626', pointerEvents: 'none', zIndex: 0, letterSpacing: '0.08em' }}>OVERDUE</div>
      )}

      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 20, borderBottom: `2px solid ${accentColor}` }}>
        <div style={{ maxWidth: '60%' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: accentColor, margin: '0 0 4px 0', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {profile.business_name}
          </h1>
          {profile.trade_name && (
            <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, color: accentColor, background: isQuotation ? '#e0f2fe' : '#e0e7ff', padding: '2px 8px', borderRadius: 12, marginBottom: 6 }}>
              {profile.trade_name}
            </span>
          )}
          <p style={{ margin: '3px 0 0 0', color: '#475569', fontSize: 12, lineHeight: 1.4 }}>
            {profile.address_line1}{profile.address_line2 ? ', ' + profile.address_line2 : ''}
          </p>
          <p style={{ margin: '2px 0', color: '#475569', fontSize: 12 }}>
            {profile.city} — {profile.pincode}
          </p>
          <div style={{ marginTop: 6, display: 'flex', gap: 12, fontSize: 11, color: '#334155', fontWeight: 500 }}>
            <span>GSTIN: <strong style={{ color: '#0f172a' }}>{profile.gstin}</strong></span>
            {profile.phone && <span>· Ph: <strong style={{ color: '#0f172a' }}>{profile.phone}</strong></span>}
          </div>
        </div>

        {/* Document Metadata Card */}
        <div style={{ textAlign: 'right', minWidth: 200 }}>
          <div style={{ background: headerBg, color: 'white', padding: '8px 16px', borderRadius: '10px 10px 0 0', textAlign: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {isQuotation ? 'ESTIMATE / QUOTATION' : 'TAX INVOICE'}
            </span>
          </div>
          <div style={{ border: '1px solid #cbd5e1', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '10px 14px', background: '#f8fafc' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: accentColor, fontFamily: 'monospace' }}>
              {doc.doc_number}
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#64748b' }}>
              Date & Time: <strong style={{ color: '#334155' }}>{formatDateTime(doc.doc_date, doc.created_at)}</strong>
            </p>
            {doc.revision_number > 1 && (
              <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 700, color: '#d97706', background: '#fef3c7', padding: '1px 6px', borderRadius: 4 }}>
                Revision v{doc.revision_number}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bill To & Payment Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isQuotation ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 20 }}>
        
        {/* Customer Box */}
        <div style={{ padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: 12, background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor }}></div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isQuotation ? 'Quotation Issued To:' : 'Billed To (Customer):'}
            </span>
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 2px 0' }}>
            {snap.name || 'Walk-in Customer'}
          </p>
          {snap.phone && <p style={{ margin: '2px 0', fontSize: 11, color: '#475569' }}>Phone: <strong>{snap.phone}</strong></p>}
          {snap.billing_address && <p style={{ margin: '2px 0', fontSize: 11, color: '#475569' }}>{snap.billing_address}</p>}
          {snap.gstin && <p style={{ margin: '2px 0', fontSize: 11, color: '#475569' }}>GSTIN: <strong>{snap.gstin}</strong></p>}
        </div>

        {/* Payment Summary Box (Invoices only) */}
        {!isQuotation && (
          <div style={{ padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: 12, background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor }}></div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Payment Information:
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
              <div>
                <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Payment Mode</span>
                <strong style={{ fontSize: 13, color: '#0f172a' }}>{doc.payment_mode || 'CASH'}</strong>
              </div>
              <div>
                <span style={{ fontSize: 10, color: '#64748b', display: 'block' }}>Status</span>
                <span style={{
                  display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, marginTop: 2,
                  background: isPaid ? '#dcfce7' : '#fef3c7',
                  color: isPaid ? '#15803d' : '#b45309'
                }}>
                  {doc.payment_status}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Items Table with Autofit Columns */}
      {(() => {
        // Word wrap within column by default. Only enter description in full line if wrapping exceeds 3 lines (>75 chars with tax, >105 without tax, or >=3 newlines)
        const shouldSpanFullLine = (name: string) => {
          if (!name) return false
          const maxChars = hideTax ? 105 : 75
          const newlineCount = (name.match(/\n/g) || []).length
          return name.trim().length > maxChars || newlineCount >= 3
        }

        const tableColumns = hideTax
          ? [
              { id: 'num', label: '#', align: 'center', width: '4%' },
              { id: 'desc', label: 'Item Description', align: 'left', width: '38%' },
              { id: 'hsn', label: 'HSN/SAC', align: 'left', width: '12%' },
              { id: 'qty', label: 'Qty', align: 'center', width: '8%' },
              { id: 'unit', label: 'Unit', align: 'center', width: '8%' },
              { id: 'price', label: 'MRP Price', align: 'right', width: '14%' },
              { id: 'total', label: 'Total', align: 'right', width: '16%' },
            ]
          : [
              { id: 'num', label: '#', align: 'center', width: '3%' },
              { id: 'desc', label: 'Item Description', align: 'left', width: '25%' },
              { id: 'hsn', label: 'HSN/SAC', align: 'left', width: '9%' },
              { id: 'qty', label: 'Qty', align: 'center', width: '6%' },
              { id: 'unit', label: 'Unit', align: 'center', width: '6%' },
              { id: 'price', label: 'Price', align: 'right', width: '10%' },
              { id: 'taxable', label: 'Taxable', align: 'right', width: '11%' },
              { id: 'cgst', label: 'CGST', align: 'right', width: '9%' },
              { id: 'sgst', label: 'SGST', align: 'right', width: '9%' },
              { id: 'total', label: 'Total', align: 'right', width: '12%' },
            ]

        const totalCols = tableColumns.length

        return (
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', marginBottom: 20, width: '100%', boxSizing: 'border-box' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: headerBg, color: 'white' }}>
                  {tableColumns.map((col) => (
                    <th
                      key={col.id}
                      style={{
                        width: col.width,
                        padding: '8px 6px',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                        textAlign: col.align as any,
                        whiteSpace: col.id === 'desc' ? 'normal' : 'nowrap',
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
                  const rowBg = i % 2 === 0 ? '#ffffff' : '#f8fafc'

                  if (isLarge) {
                    return (
                      <Fragment key={i}>
                        {/* Full-width line for large item name */}
                        <tr style={{ background: rowBg, borderTop: i > 0 ? '1px solid #e2e8f0' : 'none', breakInside: 'avoid' }}>
                          <td
                            colSpan={totalCols}
                            style={{
                              padding: '7px 8px 3px 8px',
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: '#0f172a',
                              lineHeight: 1.4,
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                              whiteSpace: 'normal',
                            }}
                          >
                            <span style={{ fontWeight: 700, color: '#64748b', marginRight: 6, fontSize: 11 }}>#{i + 1}</span>
                            <span style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>{item.product_name}</span>
                          </td>
                        </tr>
                        {/* Subsequent line for pricing, quantity, and tax details */}
                        <tr style={{ background: rowBg, borderBottom: '1px solid #e2e8f0', breakInside: 'avoid' }}>
                          <td style={{ padding: '3px 6px 7px 6px', textAlign: 'center', fontSize: 10, color: '#94a3b8' }}>↳</td>
                          <td style={{ padding: '3px 6px 7px 6px' }}></td>
                          <td style={{ padding: '3px 6px 7px 6px', fontSize: 10, color: '#475569', whiteSpace: 'nowrap' }}>
                            {item.hsn_sac || '—'}
                          </td>
                          <td style={{ padding: '3px 6px 7px 6px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                            {item.quantity}
                          </td>
                          <td style={{ padding: '3px 6px 7px 6px', textAlign: 'center', fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>
                            {item.unit || 'PCS'}
                          </td>
                          <td style={{ padding: '3px 6px 7px 6px', textAlign: 'right', fontSize: 11, color: '#334155', whiteSpace: 'nowrap' }}>
                            {formatINR(item.unit_price)}
                          </td>
                          {!hideTax && (
                            <td style={{ padding: '3px 6px 7px 6px', textAlign: 'right', fontSize: 11, color: '#334155', whiteSpace: 'nowrap' }}>
                              {formatINR(item.taxable_value)}
                            </td>
                          )}
                          {!hideTax && (
                            <td style={{ padding: '3px 6px 7px 6px', textAlign: 'right', fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>
                              {item.cgst_rate}%
                              <span style={{ display: 'block', color: '#334155', fontWeight: 500, fontSize: 9.5 }}>{formatINR(item.cgst_amount)}</span>
                            </td>
                          )}
                          {!hideTax && (
                            <td style={{ padding: '3px 6px 7px 6px', textAlign: 'right', fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>
                              {item.sgst_rate}%
                              <span style={{ display: 'block', color: '#334155', fontWeight: 500, fontSize: 9.5 }}>{formatINR(item.sgst_amount)}</span>
                            </td>
                          )}
                          <td style={{ padding: '3px 6px 7px 6px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: accentColor, whiteSpace: 'nowrap' }}>
                            {formatINR(item.total_amount)}
                          </td>
                        </tr>
                      </Fragment>
                    )
                  }

                  // Standard single line for compact item names
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: rowBg, breakInside: 'avoid' }}>
                      <td style={{ padding: '7px 6px', textAlign: 'center', fontSize: 11, color: '#64748b' }}>{i + 1}</td>
                      <td style={{
                        padding: '7px 6px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#0f172a',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                        whiteSpace: 'normal',
                        lineHeight: 1.35,
                      }}>
                        {item.product_name}
                      </td>
                      <td style={{ padding: '7px 6px', fontSize: 10, color: '#475569', whiteSpace: 'nowrap' }}>{item.hsn_sac || '—'}</td>
                      <td style={{ padding: '7px 6px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>{item.quantity}</td>
                      <td style={{ padding: '7px 6px', textAlign: 'center', fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>{item.unit || 'PCS'}</td>
                      <td style={{ padding: '7px 6px', textAlign: 'right', fontSize: 11, color: '#334155', whiteSpace: 'nowrap' }}>{formatINR(item.unit_price)}</td>
                      {!hideTax && <td style={{ padding: '7px 6px', textAlign: 'right', fontSize: 11, color: '#334155', whiteSpace: 'nowrap' }}>{formatINR(item.taxable_value)}</td>}
                      {!hideTax && (
                        <td style={{ padding: '7px 6px', textAlign: 'right', fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>
                          {item.cgst_rate}%<span style={{ display: 'block', color: '#334155', fontWeight: 500, fontSize: 9.5 }}>{formatINR(item.cgst_amount)}</span>
                        </td>
                      )}
                      {!hideTax && (
                        <td style={{ padding: '7px 6px', textAlign: 'right', fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>
                          {item.sgst_rate}%<span style={{ display: 'block', color: '#334155', fontWeight: 500, fontSize: 9.5 }}>{formatINR(item.sgst_amount)}</span>
                        </td>
                      )}
                      <td style={{ padding: '7px 6px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: accentColor, whiteSpace: 'nowrap' }}>{formatINR(item.total_amount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })()}

      {/* Totals & Scan to Pay Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>
        
        {/* Left Column: Words & Bank details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '10px 14px', borderRadius: 10, background: '#f1f5f9', borderLeft: `4px solid ${accentColor}` }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Amount in Words:</span>
            <p style={{ margin: '2px 0 0 0', fontSize: 11, fontWeight: 600, color: '#1e293b' }}>{amountInWords(doc.grand_total)}</p>
          </div>

          {profile.bank_name && (
            <div style={{ padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10, background: '#ffffff' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', margin: '0 0 4px 0', letterSpacing: '0.04em' }}>Bank Account Details:</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, color: '#334155' }}>
                <div><span style={{ color: '#94a3b8' }}>Bank:</span> <strong>{profile.bank_name}</strong></div>
                <div><span style={{ color: '#94a3b8' }}>A/c No:</span> <strong style={{ fontFamily: 'monospace' }}>{profile.bank_account_no}</strong></div>
                <div><span style={{ color: '#94a3b8' }}>IFSC:</span> <strong style={{ fontFamily: 'monospace' }}>{profile.bank_ifsc}</strong></div>
                {profile.bank_branch && <div><span style={{ color: '#94a3b8' }}>Branch:</span> <strong>{profile.bank_branch}</strong></div>}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Calculations & Scan to Pay */}
        <div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: '#ffffff' }}>
            {[
              ['Subtotal', formatINR(doc.gross_subtotal)],
              doc.discount_pct > 0 ? [`Discount (${doc.discount_pct}%)`, `− ${formatINR(doc.discount_amount)}`] : null,
              !hideTax ? ['Taxable Value', formatINR(doc.taxable_amount)] : null,
              !hideTax ? ['CGST Total', formatINR(doc.cgst_total)] : null,
              !hideTax ? ['SGST Total', formatINR(doc.sgst_total)] : null,
              doc.round_off !== 0 ? ['Round Off', (doc.round_off > 0 ? '+' : '') + formatINR(Math.abs(doc.round_off))] : null,
            ].filter(Boolean).map(([label, value]: any, idx) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', fontSize: 11, borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                <span style={{ color: '#64748b' }}>{label}</span>
                <span style={{ fontWeight: 600, color: '#334155' }}>{value}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: headerBg, color: 'white' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Grand Total</span>
              <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>{formatINR(doc.grand_total)}</span>
            </div>
          </div>

          {/* UPI Scan to Pay Card (Invoices only) */}
          {(profile?.enable_scan_to_pay !== 0 && profile?.enable_scan_to_pay !== false) && !isQuotation && upiLink && (
            <div style={{ textAlign: 'center', marginTop: 14, padding: 12, border: '1px dashed #cbd5e1', borderRadius: 10, background: '#f8fafc' }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: accentColor, margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                ⚡ Scan to Pay
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', padding: 6, background: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', width: 'fit-content', margin: '4px auto' }}>
                <QRCodeSVG value={upiLink} size={105} />
              </div>
              <p style={{ fontSize: 9, color: '#64748b', margin: '6px 0 0 0' }}>GPay · PhonePe · Paytm · BHIM</p>
            </div>
          )}
        </div>
      </div>

      {/* Terms & Conditions Section */}
      {termsList.length > 0 && (
        <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 10, color: '#334155' }}>
          <div style={{ fontWeight: 800, color: accentColor, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10 }}>
            Terms & Conditions:
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
            {termsList.map((term: string, idx: number) => (
              <li key={idx} style={{ marginBottom: 2 }}>{term}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Remarks & Footer Notes */}
      {doc.notes && (
        <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 11, color: '#475569' }}>
          <strong>Notes / Remarks:</strong> {doc.notes}
        </div>
      )}

      {/* Brand Greeting */}
      <p style={{ marginTop: 20, textAlign: 'center', fontSize: 11, fontWeight: 500, color: '#64748b' }}>
        {isQuotation ? 'Looking forward to doing business!' : 'Thank you for your business!'}
      </p>

      {/* Printable Page Footer */}
      <div style={{ marginTop: 20, paddingTop: 8, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8' }}>
        <span>{isQuotation ? `Quotation Ref: ${doc.doc_number}` : `Tax Invoice Ref: ${doc.doc_number}`}</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  )
}
