/**
 * whatsappHelper.tsx
 * Utility and UI modal for 2-step WhatsApp sharing & Payment Reminders:
 * Step 1: Direct share of invoice/quotation number or payment reminder & store name (no Web Share menu).
 * Step 2: Send the PDF attachment via the system share menu (customer appears at the top).
 * Also provides a Balance Due UPI QR Code preview, image download, and quick UPI link copy.
 */
import React, { useState } from 'react'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import { generateInvoicePdfBlob } from './pdfHelper'
import { formatINR, formatDate, buildUpiLink } from './upiHelper'
import { useDialogStore } from '../store/useDialogStore'
import { useWhatsAppShareStore } from '../store/useWhatsAppShareStore'
import {
  CheckCircle2,
  MessageSquare,
  Share2,
  Download,
  X,
  ExternalLink,
  Loader2,
  BellRing,
  Copy,
  Check,
  QrCode
} from 'lucide-react'

export function WhatsAppIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.03-1.25-.75-.67-1.26-1.5-1.41-1.75-.14-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43l-.48-.01c-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.08s.89 2.41 1.02 2.58c.13.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.53.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.17-.48-.3" />
    </svg>
  )
}

export function cleanPhoneForWhatsApp(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return '91' + digits
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits
  }
  return digits
}

/**
 * Generates direct share text with ONLY doc number & store name
 */
export function generateWhatsAppMessage(doc: { docType: string; docNumber: string; storeName?: string }): string {
  const isInvoice = doc.docType === 'INVOICE'
  const typeLabel = isInvoice ? 'TAX INVOICE' : 'QUOTATION'
  
  let msg = `*${typeLabel}: ${doc.docNumber}*`
  if (doc.storeName) {
    msg += `\n*Store:* ${doc.storeName}`
  }
  return msg
}

/**
 * Generates direct payment reminder message for creditor with balance due, invoice details and UPI deep link
 */
export function generateWhatsAppReminderMessage(params: {
  docNumber: string
  docDate?: string
  grandTotal: number
  paidAmount: number
  balanceDue: number
  customerName?: string
  storeName?: string
  upiId?: string | null
  payeeName?: string | null
  upiLink?: string | null
}): string {
  const {
    docNumber,
    docDate,
    grandTotal,
    paidAmount,
    balanceDue,
    customerName,
    storeName,
    upiId,
    payeeName,
    upiLink
  } = params

  let msg = `🔔 *PAYMENT REMINDER*`
  if (storeName) {
    msg += `\n*From:* ${storeName}`
  }
  if (customerName && customerName.trim()) {
    msg += `\n\nDear *${customerName.trim()}*,`
  } else {
    msg += `\n\nDear Customer,`
  }
  msg += `\nThis is a gentle reminder regarding the outstanding balance for your invoice.`
  msg += `\n\n📄 *Invoice No:* ${docNumber}`
  if (docDate) {
    msg += `\n📅 *Invoice Date:* ${formatDate(docDate)}`
  }
  msg += `\n💰 *Total Amount:* ${formatINR(grandTotal)}`
  if (paidAmount > 0) {
    msg += `\n✅ *Amount Paid:* ${formatINR(paidAmount)}`
  }
  msg += `\n⚠️ *Balance Due: ${formatINR(balanceDue)}*`

  if (upiId) {
    msg += `\n\n━━━━━━━━━━━━━━━━━━━━`
    msg += `\n⚡ *Instant UPI Payment Details*`
    msg += `\n*UPI ID:* \`${upiId}\``
    if (payeeName) {
      msg += `\n*Payee:* ${payeeName}`
    }
    msg += `\n*Amount to Pay:* ${formatINR(balanceDue)}`
    if (upiLink) {
      msg += `\n*UPI Pay Link:* ${upiLink}`
    }
    msg += `\n━━━━━━━━━━━━━━━━━━━━`
  }

  msg += `\n\nPlease find your invoice attached with the payment QR code. Kindly clear the outstanding balance at your earliest convenience.`
  msg += `\nThank you for your business!`
  return msg
}

/**
 * Step 1: Direct WhatsApp Share
 * Directly launches WhatsApp to the contact's chat with prefilled text (no Web Share menu)
 */
export function openWhatsAppChat(phone: string, text: string): void {
  const cleanedPhone = cleanPhoneForWhatsApp(phone)
  const encodedText = encodeURIComponent(text)
  
  // 1. Try native desktop URI scheme first (whatsapp://)
  const nativeUri = `whatsapp://send?phone=${cleanedPhone}&text=${encodedText}`
  const a = document.createElement('a')
  a.href = nativeUri
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * Fallback to open WhatsApp Web in a new tab if desktop client is not available
 */
export function openWhatsAppWeb(phone: string, text: string): void {
  const cleanedPhone = cleanPhoneForWhatsApp(phone)
  const encodedText = encodeURIComponent(text)
  window.open(`https://web.whatsapp.com/send?phone=${cleanedPhone}&text=${encodedText}`, '_blank')
}

/**
 * Step 2: Attachment Share
 * Shares the generated PDF through the OS Share Menu.
 * Because Step 1 opened the customer chat, the customer is positioned at the top of the WhatsApp share list.
 */
export async function sharePdfAttachment(pdfBlob: Blob, filename: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' })
    const shareData: ShareData = {
      title: filename,
      files: [pdfFile],
    }

    if (navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
        return true
      } catch (err: any) {
        if (err?.name === 'AbortError') return false
        console.warn('Navigator share error, falling back to download:', err)
      }
    }
  }

  // Fallback if Web Share API is unsupported: download PDF file
  const url = URL.createObjectURL(pdfBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return true
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/**
 * Fallback to Web Share option when customer has no phone number.
 * Shares invoice details & PDF attachment through system Web Share or download.
 */
async function shareViaWebShareFallback(
  element: HTMLElement | null,
  doc: any,
  profile: any,
  filename: string
): Promise<void> {
  const isInvoice = doc.doc_type === 'INVOICE'
  const typeLabel = isInvoice ? 'TAX INVOICE' : 'QUOTATION'
  const sellerSnap = typeof doc.seller_snapshot === 'string'
    ? (() => { try { return JSON.parse(doc.seller_snapshot) } catch { return null } })()
    : (doc.seller_snapshot || null)
  const storeName = sellerSnap?.business_name || profile?.business_name || 'ApexBill'

  let shareText = `*${typeLabel}: ${doc.doc_number}*`
  if (storeName) shareText += `\n*Store:* ${storeName}`
  if (doc.doc_date) shareText += `\n*Date:* ${doc.doc_date}`
  if (doc.grand_total != null) shareText += `\n*Total Amount:* ${formatINR(Number(doc.grand_total))}`

  // 1. Generate PDF blob if element is provided
  let pdfBlob: Blob | null = null
  if (element) {
    try {
      pdfBlob = await generateInvoicePdfBlob(element, filename)
    } catch (e) {
      console.warn('PDF generation failed for web share fallback:', e)
    }
  }

  // 2. Attempt Web Share API
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    if (pdfBlob) {
      try {
        const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' })
        const shareDataWithFile: ShareData = {
          title: `${typeLabel} - ${doc.doc_number}`,
          text: shareText,
          files: [pdfFile]
        }

        if (navigator.canShare && navigator.canShare(shareDataWithFile)) {
          await navigator.share(shareDataWithFile)
          return
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        console.warn('Web share with file failed, falling back to text:', err)
      }
    }

    // Try text-only web share if file sharing wasn't supported
    try {
      const shareDataText: ShareData = {
        title: `${typeLabel} - ${doc.doc_number}`,
        text: shareText
      }
      if (!navigator.canShare || navigator.canShare(shareDataText)) {
        await navigator.share(shareDataText)
        if (pdfBlob) {
          triggerBlobDownload(pdfBlob, filename)
        }
        return
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      console.warn('Web share text failed:', err)
    }
  }

  // 3. Fallback when Web Share is unsupported on this browser/environment
  if (pdfBlob) {
    triggerBlobDownload(pdfBlob, filename)
  }
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareText)
    }
  } catch {}

  await useDialogStore.getState().show(
    `No phone number on document.\n\nInvoice details copied to clipboard${pdfBlob ? ' and PDF downloaded' : ''}.\nYou can now share the details and file through any app or email.`,
    false,
    'Share Document'
  )
}

/**
 * Standard WhatsApp Share Entry Point
 */
export async function shareInvoiceViaWhatsApp(
  element: HTMLElement | null,
  doc: any,
  profile: any
): Promise<void> {
  const snap = typeof doc.customer_snapshot === 'string'
    ? (() => { try { return JSON.parse(doc.customer_snapshot) } catch { return {} } })()
    : (doc.customer_snapshot || {})
  const phone = doc.customer_phone || snap.phone || ''
  const filename = `${doc.doc_number}.pdf`

  // Fallback to Web Share option if no phone number exists
  if (!phone || phone.startsWith('NO_PHONE_')) {
    await shareViaWebShareFallback(element, doc, profile, filename)
    return
  }

  const cleanedPhone = cleanPhoneForWhatsApp(phone)
  const sellerSnap = typeof doc.seller_snapshot === 'string'
    ? (() => { try { return JSON.parse(doc.seller_snapshot) } catch { return null } })()
    : (doc.seller_snapshot || null)
  const storeName = sellerSnap?.business_name || profile?.business_name || 'ApexBill'

  const textMsg = generateWhatsAppMessage({
    docType: doc.doc_type,
    docNumber: doc.doc_number,
    storeName
  })

  // Open the 2-step modal
  const store = useWhatsAppShareStore.getState()
  store.open({
    doc,
    phone,
    cleanedPhone,
    textMsg,
    filename,
    mode: 'share',
    isGeneratingPdf: !!element,
    pdfBlob: null
  })

  // Step 1: Execute direct share immediately (no web share menu)
  openWhatsAppChat(phone, textMsg)
  store.setStep1Completed(true)

  // Asynchronously generate the PDF blob for Step 2
  if (element) {
    try {
      const blob = await generateInvoicePdfBlob(element, filename)
      store.setPdfBlob(blob)
    } catch (e) {
      console.warn('PDF generation failed:', e)
      store.setIsGeneratingPdf(false)
    }
  }
}

/**
 * Creditor Payment Reminder Entry Point:
 * Orchestrates sending payment reminder to creditor with balance due, invoice PDF, and UPI QR link.
 */
export async function sendPaymentReminderViaWhatsApp(
  element: HTMLElement | null,
  doc: any,
  profile: any
): Promise<void> {
  const snap = typeof doc.customer_snapshot === 'string'
    ? (() => { try { return JSON.parse(doc.customer_snapshot) } catch { return {} } })()
    : (doc.customer_snapshot || {})
  const phone = doc.customer_phone || snap.phone || ''
  const filename = `${doc.doc_number}.pdf`

  // Validate phone number
  if (!phone || phone.startsWith('NO_PHONE_')) {
    await useDialogStore.getState().show(
      `No phone number found for this customer on invoice ${doc.doc_number}.\n\nPlease update the customer's phone number in Customers or edit the invoice to send a WhatsApp payment reminder.`,
      false,
      'Missing Customer Phone'
    )
    return
  }

  const cleanedPhone = cleanPhoneForWhatsApp(phone)
  const sellerSnap = typeof doc.seller_snapshot === 'string'
    ? (() => { try { return JSON.parse(doc.seller_snapshot) } catch { return null } })()
    : (doc.seller_snapshot || null)
  const seller = sellerSnap || profile || {}
  const storeName = seller?.business_name || profile?.business_name || 'ApexBill'

  const balanceDue = Math.max(0, Number(doc.grand_total || 0) - Number(doc.paid_amount || 0))
  const defaultUpiAcc = profile?.upiAccounts?.find((a: any) => a.is_default) || profile?.upiAccounts?.[0]
  const upiId = doc.selected_upi_id || seller?.active_upi_id || profile?.active_upi_id || defaultUpiAcc?.upi_id || (seller?.phone ? `${seller.phone}@upi` : null)
  const payeeName = defaultUpiAcc?.payee_name || seller?.business_name || profile?.business_name || 'Merchant'

  const upiLink = upiId
    ? buildUpiLink({
        upiId,
        payeeName,
        amount: balanceDue,
        docNumber: doc.doc_number,
        note: `Invoice ${doc.doc_number} Balance Due`
      })
    : null

  const customerName = doc.customer_name || snap.name || ''

  const textMsg = generateWhatsAppReminderMessage({
    docNumber: doc.doc_number,
    docDate: doc.doc_date,
    grandTotal: Number(doc.grand_total || 0),
    paidAmount: Number(doc.paid_amount || 0),
    balanceDue,
    customerName,
    storeName,
    upiId,
    payeeName,
    upiLink: upiLink || undefined
  })

  // Open the 2-step modal in reminder mode
  const store = useWhatsAppShareStore.getState()
  store.open({
    doc,
    phone,
    cleanedPhone,
    textMsg,
    filename,
    mode: 'reminder',
    balanceDue,
    upiLink,
    upiId,
    payeeName,
    isGeneratingPdf: !!element,
    pdfBlob: null
  })

  // Step 1: Execute direct share immediately (direct message to creditor's WhatsApp chat)
  openWhatsAppChat(phone, textMsg)
  store.setStep1Completed(true)

  // Asynchronously generate the PDF blob for Step 2
  if (element) {
    try {
      const blob = await generateInvoicePdfBlob(element, filename)
      store.setPdfBlob(blob)
    } catch (e) {
      console.warn('PDF generation failed for reminder:', e)
      store.setIsGeneratingPdf(false)
    }
  }
}

/**
 * Global 2-Step WhatsApp Share Modal Component
 * Supports both Standard Share and Creditor Payment Reminder with live UPI QR code preview
 */
export function WhatsAppShareModal() {
  const {
    isOpen,
    mode,
    doc,
    phone,
    textMsg,
    filename,
    pdfBlob,
    isGeneratingPdf,
    step1Completed,
    step2Completed,
    balanceDue = 0,
    upiLink,
    upiId,
    payeeName,
    setStep1Completed,
    setStep2Completed,
    close
  } = useWhatsAppShareStore()

  const [isSharingStep2, setIsSharingStep2] = useState(false)
  const [copiedUpi, setCopiedUpi] = useState(false)
  const [copiedMsg, setCopiedMsg] = useState(false)

  if (!isOpen || !doc) return null

  const customerName = doc.customer_name || 'Customer'
  const isReminder = mode === 'reminder'

  const handleStep1 = () => {
    openWhatsAppChat(phone, textMsg)
    setStep1Completed(true)
  }

  const handleStep1WebFallback = () => {
    openWhatsAppWeb(phone, textMsg)
    setStep1Completed(true)
  }

  const handleStep2 = async () => {
    if (!pdfBlob) return
    setIsSharingStep2(true)
    try {
      const success = await sharePdfAttachment(pdfBlob, filename)
      if (success) {
        setStep2Completed(true)
      }
    } finally {
      setIsSharingStep2(false)
    }
  }

  const handleDownloadOnly = () => {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const handleCopyUpiLink = async () => {
    if (!upiLink) return
    try {
      await navigator.clipboard.writeText(upiLink)
      setCopiedUpi(true)
      setTimeout(() => setCopiedUpi(false), 2000)
    } catch {}
  }

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(textMsg)
      setCopiedMsg(true)
      setTimeout(() => setCopiedMsg(false), 2000)
    } catch {}
  }

  const handleDownloadQrImage = () => {
    const canvas = document.getElementById('reminder-qr-canvas') as HTMLCanvasElement
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${doc.doc_number}-Balance-QR.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-gray-900 border border-white/10 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gray-950/60">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isReminder ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {isReminder ? <BellRing size={18} /> : <WhatsAppIcon size={18} />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                {isReminder ? 'Payment Reminder • WhatsApp' : 'WhatsApp 2-Step Share'}
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {doc.doc_number}
                </span>
                {isReminder && balanceDue > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-mono font-bold border border-red-500/30">
                    Due: {formatINR(balanceDue)}
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-400">
                {customerName} • <span className="font-mono text-gray-300">{phone}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Reminder UPI QR Code Section */}
          {isReminder && upiLink && (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-amber-900/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode size={15} className="text-amber-400" />
                  <h4 className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                    UPI QR Code for Balance Due ({formatINR(balanceDue)})
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Scan & Pay
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3.5 bg-gray-950/70 p-3 rounded-xl border border-white/5">
                <div className="p-2 bg-white rounded-xl shadow-md shrink-0">
                  <QRCodeSVG value={upiLink} size={92} />
                  {/* Hidden high-res canvas for PNG download */}
                  <div className="hidden">
                    <QRCodeCanvas id="reminder-qr-canvas" value={upiLink} size={400} includeMargin={true} />
                  </div>
                </div>
                <div className="flex-1 text-center sm:text-left space-y-1">
                  <p className="text-xs font-medium text-gray-300">
                    Outstanding Due:{' '}
                    <span className="text-red-400 font-mono text-sm font-bold">{formatINR(balanceDue)}</span>
                  </p>
                  {upiId && (
                    <p className="text-[11px] text-gray-400 font-mono truncate">
                      UPI ID: <span className="text-brand-300 font-semibold">{upiId}</span>
                    </p>
                  )}
                  {payeeName && (
                    <p className="text-[11px] text-gray-400 truncate">
                      Payee: <span className="text-gray-200">{payeeName}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={handleDownloadQrImage}
                      className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-all"
                      title="Download QR code image to send in chat"
                    >
                      <Download size={12} /> Download QR (PNG)
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyUpiLink}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-all"
                      title="Copy UPI payment deep link"
                    >
                      {copiedUpi ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copiedUpi ? 'Copied Link!' : 'Copy UPI Link'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Direct Message */}
          <div className={`p-4 rounded-xl border transition-all ${step1Completed ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 w-full">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 shrink-0 ${step1Completed ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {step1Completed ? <CheckCircle2 size={16} /> : '1'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-gray-200">
                      {isReminder ? 'Step 1: Direct Reminder Message' : 'Step 1: Direct Message'}
                    </h4>
                    {step1Completed && (
                      <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Chat Opened
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {isReminder
                      ? 'Opens WhatsApp chat with amount due, invoice breakdown & UPI payment link.'
                      : 'Directly shares document number & store name (no share menu).'}
                  </p>
                  <div className="mt-2 text-xs font-mono bg-gray-950/70 border border-white/5 p-2.5 rounded text-gray-300 whitespace-pre-line select-all max-h-36 overflow-y-auto">
                    {textMsg}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3 ml-10">
              <button
                type="button"
                onClick={handleStep1}
                className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
              >
                <MessageSquare size={13} />
                {step1Completed ? 'Re-open Direct Chat' : 'Open Direct Chat'}
              </button>
              <button
                type="button"
                onClick={handleStep1WebFallback}
                className="px-2.5 py-1.5 text-gray-400 hover:text-gray-200 text-xs font-medium flex items-center gap-1 hover:underline"
                title="Open in WhatsApp Web browser tab"
              >
                <ExternalLink size={12} /> WhatsApp Web
              </button>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="px-2.5 py-1.5 text-gray-400 hover:text-gray-200 text-xs font-medium flex items-center gap-1 hover:underline ml-auto"
                title="Copy reminder text"
              >
                {copiedMsg ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copiedMsg ? 'Copied' : 'Copy Text'}
              </button>
            </div>
          </div>

          {/* Step 2: Attachment Share */}
          <div className={`p-4 rounded-xl border transition-all ${step2Completed ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-brand-950/20 border-brand-500/30'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 shrink-0 ${step2Completed ? 'bg-emerald-500 text-white' : 'bg-brand-600 text-white'}`}>
                {step2Completed ? <CheckCircle2 size={16} /> : '2'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-gray-200">
                    {isReminder ? 'Step 2: Send Invoice PDF with Balance QR' : 'Step 2: Send PDF Attachment'}
                  </h4>
                  {step2Completed && (
                    <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Sent
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                  Opens the Windows share menu with <span className="font-semibold text-brand-300">{filename}</span>.
                  Select <span className="text-emerald-400 font-medium">WhatsApp</span> — this customer will appear at the <span className="underline font-semibold text-emerald-300">top</span> of your recent list!
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isGeneratingPdf || !pdfBlob || isSharingStep2}
                    onClick={handleStep2}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-brand-500/25 transition-all"
                  >
                    {isGeneratingPdf ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-brand-200" />
                        Generating PDF...
                      </>
                    ) : isSharingStep2 ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-white" />
                        Opening Share Menu...
                      </>
                    ) : (
                      <>
                        <Share2 size={14} />
                        {step2Completed ? 'Share PDF Again' : 'Send PDF via Share Option'}
                      </>
                    )}
                  </button>

                  {pdfBlob && (
                    <button
                      type="button"
                      onClick={handleDownloadOnly}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all"
                      title="Download PDF to computer"
                    >
                      <Download size={13} />
                      Save File
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-gray-950/40 flex justify-between items-center">
          <p className="text-[11px] text-gray-400">
            {step1Completed && step2Completed
              ? '✨ Both reminder steps completed successfully!'
              : 'Follow Step 1 then Step 2 for seamless reminder sharing.'}
          </p>
          <button
            type="button"
            onClick={close}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-gray-200 text-xs font-medium rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
