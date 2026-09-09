// utils/phoneHelper.ts - Normalization, formatting and customer duplicate lookup

/**
 * Normalizes phone numbers so that variations like:
 * "+91 98765-43210", "09876543210", "919876543210", "98765 43210"
 * all resolve to the same canonical primary key "9876543210".
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (trimmed.startsWith('NO_PHONE_')) return trimmed

  // Extract all digit characters
  const digits = trimmed.replace(/\D/g, '')

  // 10-digit standard Indian mobile number
  if (digits.length === 10) return digits

  // 11-digit with leading 0 (e.g. 09876543210)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)

  // 12-digit with country code 91 (e.g. 919876543210)
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)

  // If already prefixed with +91 or similar, or international
  if (trimmed.startsWith('+91')) {
    const rest = trimmed.slice(3).replace(/\D/g, '')
    if (rest.length === 10) return rest
  }

  // Fallback: strip spaces and punctuation
  return trimmed.replace(/[\s\-()]/g, '')
}

/**
 * Formats a phone number for user display, masking internal NO_PHONE_ placeholders.
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone || phone.startsWith('NO_PHONE_')) return '—'
  const norm = normalizePhone(phone)
  if (norm.length === 10) {
    return `${norm.slice(0, 5)} ${norm.slice(5)}`
  }
  return phone
}

/**
 * Searches a list of customer records for an exact or close match by phone or name.
 */
export function searchExistingCustomer(
  customers: any[],
  query: { phone?: string; name?: string }
): { phoneMatch?: any; nameMatches: any[] } {
  const normPhone = normalizePhone(query.phone)
  const normName = (query.name || '').trim().toLowerCase()

  let phoneMatch: any = undefined
  const nameMatches: any[] = []

  for (const c of customers) {
    const cPhone = normalizePhone(c.phone)
    const cName = (c.name || '').trim().toLowerCase()

    if (normPhone && normPhone.length >= 7 && cPhone === normPhone) {
      phoneMatch = c
    }

    if (normName && normName.length >= 2 && (cName === normName || cName.includes(normName))) {
      nameMatches.push(c)
    }
  }

  return { phoneMatch, nameMatches }
}
