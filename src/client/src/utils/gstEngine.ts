// utils/gstEngine.ts — Client-side Tax INCLUSIVE GST calculation engine

export interface LineItem {
  productId?: string
  productName: string
  hsnSac?: string
  unit?: string
  purchasePrice?: number
  quantity: number
  unitPrice: number // Tax inclusive unit price (MRP)
  gstRate: number
}

export interface CalcLineItem extends LineItem {
  grossAmount: number
  taxableValue: number
  cgstRate: number
  cgstAmount: number
  sgstRate: number
  sgstAmount: number
  totalAmount: number
}

export interface InvoiceTotals {
  items: CalcLineItem[]
  grossSubtotal: number
  discountPct: number
  discountAmount: number
  taxableAmount: number
  cgstTotal: number
  sgstTotal: number
  rawGrandTotal: number
  roundOff: number
  grandTotal: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function calcTotals(items: LineItem[], discountPct = 0): InvoiceTotals {
  const d = Math.max(0, Math.min(100, discountPct))
  let grossSubtotal = 0, taxableAmount = 0, cgstTotal = 0, sgstTotal = 0

  const calcItems: CalcLineItem[] = items.map(item => {
    const grossAmount = r2(item.quantity * item.unitPrice)
    const grossAfterDiscount = r2(grossAmount * (1 - d / 100))
    const gstFactor = 1 + (item.gstRate || 0) / 100
    const taxableValue = r2(grossAfterDiscount / gstFactor)
    const totalGst = r2(grossAfterDiscount - taxableValue)
    const cgstRate = r2((item.gstRate || 0) / 2)
    const sgstRate = r2((item.gstRate || 0) / 2)
    const cgstAmount = r2(totalGst / 2)
    const sgstAmount = r2(totalGst - cgstAmount)
    const totalAmount = grossAfterDiscount

    grossSubtotal += grossAmount
    taxableAmount += taxableValue
    cgstTotal += cgstAmount
    sgstTotal += sgstAmount

    return { ...item, grossAmount, taxableValue, cgstRate, cgstAmount, sgstRate, sgstAmount, totalAmount }
  })

  grossSubtotal = r2(grossSubtotal)
  taxableAmount = r2(taxableAmount)
  cgstTotal = r2(cgstTotal)
  sgstTotal = r2(sgstTotal)

  const rawGrandTotal = r2(grossSubtotal * (1 - d / 100))
  const discountAmount = r2(grossSubtotal - rawGrandTotal)
  const grandTotal = Math.round(rawGrandTotal)
  const roundOff = r2(grandTotal - rawGrandTotal)

  return {
    items: calcItems,
    grossSubtotal,
    discountPct: d,
    discountAmount,
    taxableAmount,
    cgstTotal,
    sgstTotal,
    rawGrandTotal: r2(rawGrandTotal),
    roundOff,
    grandTotal
  }
}

export const GST_RATES = [0, 5, 12, 18, 28]

export const PAYMENT_MODES = ['CASH', 'UPI', 'CREDIT'] as const
export type PaymentMode = typeof PAYMENT_MODES[number]

export const PAYMENT_STATUSES = ['PAID', 'PARTIAL', 'UNPAID', 'CANCELLED'] as const
export type PaymentStatus = typeof PAYMENT_STATUSES[number]

export const INDIAN_STATES: Record<string, string> = {
  '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
  '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh',
  '10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur',
  '15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal',
  '20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh',
  '24':'Gujarat','25':'Daman & Diu','26':'Dadra & NH','27':'Maharashtra','28':'Andhra Pradesh (Old)',
  '29':'Karnataka','30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu',
  '34':'Puducherry','35':'A&N Islands','36':'Telangana','37':'Andhra Pradesh',
  '38':'Ladakh','97':'Other Territory','99':'Centre Jurisdiction',
}
