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
}): string {
  const { upiId, payeeName, amount, docNumber } = params
  const p = new URLSearchParams({
    pa: upiId,
    pn: payeeName,
    am: amount.toFixed(2),
    tn: `Bill_${docNumber}`,
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
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Format date and time to DD/MM/YYYY hh:mm AM/PM */
export function formatDateTime(dateStr: string, createdAtStr?: string): string {
  if (!dateStr && !createdAtStr) return ''
  const str = createdAtStr || dateStr
  const d = new Date(str)
  if (isNaN(d.getTime())) return formatDate(dateStr)
  const dateFormatted = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeFormatted = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${dateFormatted}, ${timeFormatted}`
}

/** Today's date as YYYY-MM-DD */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
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
