// components/print/A4InvoiceTemplate.tsx — GST A4 print layout
import { QRCodeSVG } from 'qrcode.react'
import { buildUpiLink, formatINR, formatDate, amountInWords } from '../../utils/upiHelper'

export default function A4InvoiceTemplate({ doc, profile }: { doc: any; profile: any }) {
  if (!doc || !profile) return null
  const items = doc.items || []
  const snap = (() => { try { return JSON.parse(doc.customer_snapshot) } catch { return {} } })()
  const upiId = doc.selected_upi_id || profile?.active_upi_id || (profile?.phone ? `${profile.phone}@upi` : null)
  const upiLink = upiId
    ? buildUpiLink({ upiId, payeeName: profile?.business_name || 'Merchant', amount: doc.grand_total, docNumber: doc.doc_number })
    : null
  const isPaid = doc.payment_status === 'PAID'
  const isOverdue = doc.payment_status === 'UNPAID'

  return (
    <div className="bg-white text-gray-900 p-8 font-sans text-sm relative" style={{ fontFamily: 'Arial, sans-serif', minHeight: '297mm' }}>
      {/* Watermark */}
      {isPaid && (
        <div style={{ position: 'absolute', top: '40%', left: '20%', opacity: 0.08, transform: 'rotate(-30deg)', fontSize: 96, fontWeight: 900, color: '#16a34a', pointerEvents: 'none', zIndex: 0 }}>PAID</div>
      )}
      {isOverdue && (
        <div style={{ position: 'absolute', top: '40%', left: '15%', opacity: 0.08, transform: 'rotate(-30deg)', fontSize: 96, fontWeight: 900, color: '#dc2626', pointerEvents: 'none', zIndex: 0 }}>OVERDUE</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, borderBottom: '2px solid #4338ca', paddingBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#4338ca', margin: 0 }}>{profile.business_name}</h1>
          {profile.trade_name && <p style={{ color: '#6b7280', margin: '2px 0' }}>{profile.trade_name}</p>}
          <p style={{ margin: '2px 0', color: '#374151' }}>{profile.address_line1}{profile.address_line2 ? ', ' + profile.address_line2 : ''}</p>
          <p style={{ margin: '2px 0', color: '#374151' }}>{profile.city} - {profile.pincode}</p>
          <p style={{ margin: '2px 0', color: '#374151' }}>GSTIN: <strong>{profile.gstin}</strong></p>
          {profile.phone && <p style={{ margin: '2px 0', color: '#374151' }}>Ph: {profile.phone}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
            {doc.doc_type === 'QUOTATION' ? 'QUOTATION' : 'TAX INVOICE'}
          </h2>
          <p style={{ margin: '2px 0', fontWeight: 600 }}>{doc.doc_number}</p>
          <p style={{ margin: '2px 0', color: '#6b7280' }}>Date: {formatDate(doc.doc_date)}</p>
          {doc.revision_number > 1 && <p style={{ margin: '2px 0', color: '#d97706', fontSize: 11 }}>Revision v{doc.revision_number}</p>}
        </div>
      </div>

      {/* Bill To */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <p style={{ fontWeight: 700, marginBottom: 4, color: '#374151' }}>Bill To:</p>
          <p style={{ fontWeight: 600 }}>{snap.name || 'Walk-in Customer'}</p>
          {snap.phone && <p style={{ color: '#6b7280' }}>Ph: {snap.phone}</p>}
          {snap.billing_address && <p style={{ color: '#6b7280' }}>{snap.billing_address}</p>}
          {snap.gstin && <p style={{ color: '#6b7280' }}>GSTIN: {snap.gstin}</p>}
        </div>
        <div style={{ padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <p style={{ fontWeight: 700, marginBottom: 4, color: '#374151' }}>Payment:</p>
          <p>Mode: <strong>{doc.payment_mode}</strong></p>
          <p>Status: <strong style={{ color: isPaid ? '#16a34a' : '#dc2626' }}>{doc.payment_status}</strong></p>
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
        <thead>
          <tr style={{ background: '#4338ca', color: 'white' }}>
            {['#','Item','HSN/SAC','Qty','Unit Price','Taxable','CGST','SGST','Total'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: h === '#' || h === 'Qty' ? 'center' : 'right', fontSize: 11, fontWeight: 600, textAlign: h === 'Item' || h === 'HSN/SAC' ? 'left' : 'right' as any }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, i: number) => (
            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fafafa' : 'white' }}>
              <td style={{ padding: '7px 10px', textAlign: 'center', fontSize: 11 }}>{i+1}</td>
              <td style={{ padding: '7px 10px', fontSize: 11 }}>{item.product_name}<br/>{item.hsn_sac && <span style={{ color: '#9ca3af', fontSize: 10 }}>HSN: {item.hsn_sac}</span>}</td>
              <td style={{ padding: '7px 10px', fontSize: 11 }}>{item.hsn_sac || '—'}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 11 }}>{item.quantity}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 11 }}>{formatINR(item.unit_price)}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 11 }}>{formatINR(item.taxable_value)}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 11 }}>{item.cgst_rate}%<br/>{formatINR(item.cgst_amount)}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 11 }}>{item.sgst_rate}%<br/>{formatINR(item.sgst_amount)}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right', fontSize: 11, fontWeight: 600 }}>{formatINR(item.total_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals + QR */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'start' }}>
        <div>
          <p style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', marginBottom: 12 }}>
            <strong>Amount in Words:</strong> {amountInWords(doc.grand_total)}
          </p>
          {profile.bank_name && (
            <div style={{ fontSize: 11, color: '#374151', border: '1px solid #e5e7eb', padding: 10, borderRadius: 8 }}>
              <p style={{ fontWeight: 700, marginBottom: 4 }}>Bank Details:</p>
              <p>{profile.bank_name} — A/c: {profile.bank_account_no}</p>
              <p>IFSC: {profile.bank_ifsc} | Branch: {profile.bank_branch}</p>
            </div>
          )}
        </div>

        <div style={{ minWidth: 200 }}>
          {[
            ['Subtotal', formatINR(doc.gross_subtotal)],
            doc.discount_pct > 0 ? [`Discount (${doc.discount_pct}%)`, `− ${formatINR(doc.discount_amount)}`] : null,
            ['Taxable Amount', formatINR(doc.taxable_amount)],
            ['CGST', formatINR(doc.cgst_total)],
            ['SGST', formatINR(doc.sgst_total)],
            doc.round_off !== 0 ? ['Round Off', (doc.round_off > 0 ? '+' : '') + formatINR(Math.abs(doc.round_off))] : null,
          ].filter(Boolean).map(([label, value]: any) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ color: '#6b7280' }}>{label}</span><span>{value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 15, fontWeight: 800, borderTop: '2px solid #4338ca', marginTop: 4, color: '#111827' }}>
            <span>Grand Total</span><span style={{ color: '#4338ca' }}>{formatINR(doc.grand_total)}</span>
          </div>

          {/* UPI QR Code */}
          {upiLink && (
            <div style={{ textAlign: 'center', marginTop: 14, padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fafafa' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#4338ca', margin: '0 0 6px 0', textTransform: 'uppercase', tracking: '0.05em' }}>Scan to Pay</p>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
                <QRCodeSVG value={upiLink} size={110} />
              </div>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#111827', margin: '6px 0 2px 0' }}>{upiId}</p>
              <p style={{ fontSize: 9, color: '#6b7280', margin: 0 }}>GPay · PhonePe · Paytm · BHIM</p>
            </div>
          )}
        </div>
      </div>

      {doc.notes && <p style={{ marginTop: 16, fontSize: 11, color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>Notes: {doc.notes}</p>}
      <p style={{ marginTop: 24, textAlign: 'center', fontSize: 10, color: '#9ca3af' }}>Thank you for your business!</p>
    </div>
  )
}
