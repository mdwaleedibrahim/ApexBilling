// utils/phoneHelper.ts - Normalization of phone numbers for canonical primary keys

export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.startsWith('NO_PHONE_')) return trimmed;

  const digits = trimmed.replace(/\D/g, '');

  // 10-digit standard Indian mobile number
  if (digits.length === 10) return digits;

  // 11-digit with leading 0 (e.g. 09876543210)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);

  // 12-digit with country code 91 (e.g. 919876543210)
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);

  // If prefixed with +91
  if (trimmed.startsWith('+91')) {
    const rest = trimmed.slice(3).replace(/\D/g, '');
    if (rest.length === 10) return rest;
  }

  // Fallback: remove spaces, dashes, parentheses
  return trimmed.replace(/[\s\-()]/g, '');
}
