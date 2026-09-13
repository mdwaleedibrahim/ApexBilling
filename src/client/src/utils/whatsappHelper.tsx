/**
 * whatsappHelper.tsx
 * Utility and UI modal for 2-step WhatsApp sharing:
 * Step 1: Direct share of invoice/quotation number & store name (no Web Share menu).
 * Step 2: Send the PDF attachment via the system share menu (customer appears at the top).
 */
import React, { useState } from 'react'
import { generateInvoicePdfBlob } from './pdfHelper'
import { useDialogStore } from '../store/useDialogStore'
import { useWhatsAppShareStore } from '../store/useWhatsAppShareStore'
import { CheckCircle2, MessageSquare, Paperclip, Share2, Download, X, ExternalLink, Loader2 } from 'lucide-react'

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

/**
 * Main Entry Point:
 * Orchestrates the 2-step WhatsApp sharing workflow:
 * 1. Opens 2-step modal and initiates PDF generation.
 * 2. Directly executes Step 1 (direct share to customer's chat).
 * 3. Prepares Step 2 for 1-click execution.
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
  if (!phone || phone.startsWith('NO_PHONE_')) {
    await useDialogStore.getState().show('No customer phone number found in this document to share via WhatsApp.', false, 'WhatsApp Share')
    return
  }

  const cleanedPhone = cleanPhoneForWhatsApp(phone)
  const filename = `${doc.doc_number}.pdf`
  const textMsg = generateWhatsAppMessage({
    docType: doc.doc_type,
    docNumber: doc.doc_number,
    storeName: profile?.business_name || 'ApexBill'
  })

  // Open the 2-step modal
  const store = useWhatsAppShareStore.getState()
  store.open({
    doc,
    phone,
    cleanedPhone,
    textMsg,
    filename,
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
 * Global 2-Step WhatsApp Share Modal Component
 */
export function WhatsAppShareModal() {
  const {
    isOpen,
    doc,
    phone,
    textMsg,
    filename,
    pdfBlob,
    isGeneratingPdf,
    step1Completed,
    step2Completed,
    setStep1Completed,
    setStep2Completed,
    close
  } = useWhatsAppShareStore()

  const [isSharingStep2, setIsSharingStep2] = useState(false)

  if (!isOpen || !doc) return null

  const customerName = doc.customer_name || 'Customer'
  const isInvoice = doc.doc_type === 'INVOICE'

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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-gray-900 border border-white/10 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gray-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <WhatsAppIcon size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                WhatsApp 2-Step Share
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {doc.doc_number}
                </span>
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

        {/* Modal Body: 2 Steps */}
        <div className="p-5 space-y-4">
          {/* Step 1: Direct Share */}
          <div className={`p-4 rounded-xl border transition-all ${step1Completed ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${step1Completed ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {step1Completed ? <CheckCircle2 size={16} /> : '1'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-gray-200">Step 1: Direct Message</h4>
                    {step1Completed && (
                      <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Chat Opened
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Directly shares document number & store name (no share menu).
                  </p>
                  <div className="mt-2 text-xs font-mono bg-gray-950/70 border border-white/5 p-2 rounded text-gray-300 whitespace-pre-line select-all">
                    {textMsg}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 ml-10">
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
            </div>
          </div>

          {/* Step 2: Attachment Share */}
          <div className={`p-4 rounded-xl border transition-all ${step2Completed ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-brand-950/20 border-brand-500/30'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${step2Completed ? 'bg-emerald-500 text-white' : 'bg-brand-600 text-white'}`}>
                {step2Completed ? <CheckCircle2 size={16} /> : '2'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-gray-200">Step 2: Send PDF Attachment</h4>
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
            {step1Completed && step2Completed ? '✨ Both steps completed successfully!' : 'Follow Step 1 then Step 2 for 1-click sharing.'}
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
