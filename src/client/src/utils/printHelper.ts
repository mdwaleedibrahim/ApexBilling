// utils/printHelper.ts — Page size auto-detection (A5 vs A4) and dynamic print stylesheet injection

/**
 * Heuristic to determine whether an invoice or quotation document fits within
 * standard A5 portrait paper (148mm × 210mm) without overflowing onto page 2.
 * Printable vertical height on A5 with ~5mm margins is approx 198mm (~750px at 96 DPI).
 */
export function checkFitsInA5(doc: any, fontScale: number = 1): boolean {
  if (!doc) return false
  const items = doc.items || []
  if (items.length === 0) return true

  // Standard A5 comfortably accommodates up to 5 items with header, payment box, remittance & footer
  if (items.length > 5) return false

  // Check description wrapping:
  // On A5 (148mm width), the item description column holds approx 30-34 characters per line.
  let estimatedItemRows = 0
  for (const it of items) {
    const name = it.product_name || ''
    const lines = Math.max(1, Math.ceil(name.trim().length / 32))
    estimatedItemRows += lines
  }
  // If descriptions require more than 6 total lines across all items, it will overflow A5
  if (estimatedItemRows > 6) return false

  // Payment history for credit invoices (each row adds ~20px)
  let paymentHistoryCount = 0
  try {
    if (doc.payment_history) {
      const parsed = typeof doc.payment_history === 'string' ? JSON.parse(doc.payment_history) : doc.payment_history
      if (Array.isArray(parsed)) paymentHistoryCount = parsed.length
    }
  } catch { }
  if (paymentHistoryCount > 2) return false

  // Terms and conditions: standard default list is 3 items
  let termsCount = 0
  try {
    if (doc.terms_and_conditions) {
      const parsed = typeof doc.terms_and_conditions === 'string' ? JSON.parse(doc.terms_and_conditions) : doc.terms_and_conditions
      if (Array.isArray(parsed)) termsCount = parsed.length
    }
  } catch { }
  if (termsCount > 4) return false

  // Long custom notes add vertical bulk
  if (doc.notes && doc.notes.trim().length > 90) return false

  // If user zoomed font scale above 1.15× with 4+ items, it will exceed A5 height
  if (fontScale > 1.15 && (items.length >= 4 || estimatedItemRows >= 5)) {
    return false
  }

  return true
}

/**
 * Dynamically injects or updates a print stylesheet defining @page { size: ... }.
 * Chromium browsers (Chrome, Edge) consult this rule to automatically select
 * the destination paper size (A5 portrait vs A4 portrait) in the native print dialog.
 * Note: CSS Paged Media specifications disallow `!important` inside @page rules;
 * declarations containing `!important` are ignored by browser CSS parsers.
 */
export function setPrintPageSize(size: 'A4' | 'A5'): void {
  if (typeof document === 'undefined') return
  let styleEl = document.getElementById('apexbill-dynamic-print-page') as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'apexbill-dynamic-print-page'
  }
  // Ensure it is appended as the last element in <head> for highest cascade precedence
  document.head.appendChild(styleEl)

  const margin = size === 'A5' ? '6mm' : '8mm'
  styleEl.textContent = `
@page {
  size: ${size} portrait;
  margin: ${margin};
}
@media print {
  @page {
    size: ${size} portrait;
    margin: ${margin};
  }
}
`
}

// Auto-initialize and register beforeprint listener so any print invocation
// (button click, Ctrl+P, browser menu) synchronously applies the correct paper size.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeprint', () => {
    const container = document.querySelector('.print-container')
    if (container) {
      const isA5 = container.classList.contains('print-a5')
      setPrintPageSize(isA5 ? 'A5' : 'A4')
    }
  })
}


