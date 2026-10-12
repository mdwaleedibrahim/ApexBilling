// utils/upiHelper.ts — NPCI-compliant UPI deep link builder

/**
 * Builds a NPCI-compliant UPI payment deep link.
 * upi://pay?pa={upiId}&pn={payeeName}&am={amount}&tn={note}&cu=INR
 */
export function buildUpiLink(params: {
  upiId: string
  payeeName: string
  amount: number
  docNumber: string
  note?: string
}): string {
  const { upiId, payeeName, amount, docNumber, note } = params
  // NPCI UPI spec: 'tn' is the transaction note/comment displayed in UPI apps (PhonePe, GPay, Paytm)
  const comment = note || (docNumber ? `Invoice No: ${docNumber}` : 'Invoice Payment')
  const p = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: amount.toFixed(2),
    tn: comment,
    tr: docNumber || '',
    cu: 'INR',
  })
  return `upi://pay?${p.toString()}`
}

/** Format Indian currency */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Format date to DD/MM/YYYY */
export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (match) {
    const [, y, m, d] = match
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d))
    return dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Format date and time to DD/MM/YYYY hh:mm AM/PM in IST */
export function formatDateTime(dateStr: string, timeOrCreatedAt?: string): string {
  if (!dateStr && !timeOrCreatedAt) return ''

  // 1. Date portion: ALWAYS respect dateStr when provided (preserves back-dating)
  let formattedDate = ''
  if (dateStr) {
    formattedDate = formatDate(dateStr)
  }

  // 2. Time portion
  let formattedTime = ''
  if (timeOrCreatedAt) {
    const trimmed = timeOrCreatedAt.trim()
    const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed)
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10)
      const minutes = timeMatch[2]
      const ampm = hours >= 12 ? 'PM' : 'AM'
      hours = hours % 12 || 12
      formattedTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`
    } else {
      const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(trimmed) && !trimmed.endsWith('Z')
        ? trimmed.replace(' ', 'T') + 'Z'
        : trimmed
      const d = new Date(normalized)
      if (!isNaN(d.getTime())) {
        if (!formattedDate) {
          formattedDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        }
        formattedTime = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()
      }
    }
  }

  if (formattedDate && formattedTime) {
    return `${formattedDate}, ${formattedTime}`
  }
  return formattedDate || formattedTime
}

/** Today's date as YYYY-MM-DD in local (system) time */
export function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Generate a simple UUID v4 */
export function uuid(): string {
  return crypto.randomUUID()
}

/** Number to Indian words (for invoice amount in words) */
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function numToWords(n: number): string {
  if (n === 0) return 'Zero'
  if (n < 20) return ones[n]
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
  if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '')
  if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '')
  if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numToWords(n % 100000) : '')
  return numToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numToWords(n % 10000000) : '')
}

export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount)
  const paise  = Math.round((amount - rupees) * 100)
  let result = 'Rupees ' + numToWords(rupees)
  if (paise > 0) result += ' and ' + numToWords(paise) + ' Paise'
  return result + ' Only'
}
