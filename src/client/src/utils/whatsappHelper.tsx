/**
 * whatsappHelper.ts
 * Utility to format, generate PDF, and launch WhatsApp Desktop via native Windows URI scheme (whatsapp://)
 */
import React from 'react'
import { generateInvoicePdfBlob } from './pdfHelper'

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
  // Remove all non-digit characters
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
 * Generates a clean message WITHOUT itemized details/breakdown
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

export function openWhatsAppChat(phone: string, text: string): void {
  const cleanedPhone = cleanPhoneForWhatsApp(phone)
  const encodedText = encodeURIComponent(text)
  
  // Windows Native WhatsApp URI: whatsapp://send?phone=...&text=...
  const nativeUri = `whatsapp://send?phone=${cleanedPhone}&text=${encodedText}`
  
  // Attempt to open via native protocol
  const a = document.createElement('a')
  a.href = nativeUri
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * Shares only the generated Invoice/Quotation PDF via WhatsApp without breakdown details
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
    alert('No customer phone number found in this document to share via WhatsApp.')
    return
  }

  const filename = `${doc.doc_number}.pdf`
  const textMsg = generateWhatsAppMessage({
    docType: doc.doc_type,
    docNumber: doc.doc_number,
    storeName: profile?.business_name || 'ApexBill'
  })

  if (element) {
    try {
      const pdfBlob = await generateInvoicePdfBlob(element, filename)

      // Download the PDF file directly to Downloads
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.warn('PDF generation error, continuing to WhatsApp URI:', e)
    }
  }

  // Open native WhatsApp Desktop directly with customer phone number
  openWhatsAppChat(phone, textMsg)
}
