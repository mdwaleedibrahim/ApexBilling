/**
 * calculation.service.ts
 * Dual Tax & Proportionate Discount Engine (CGST + SGST)
 * TAX INCLUSIVE PRICING ENGINE
 */

export interface LineItemInput {
  productId?: string;
  productName: string;
  hsnSac?: string;
  unit?: string;
  purchasePrice?: number;
  quantity: number;
  unitPrice: number;  // Tax-inclusive unit selling price
  gstRate: number;    // Total GST % (e.g. 18 → CGST 9% + SGST 9%)
}

export interface CalculatedLineItem extends LineItemInput {
  grossAmount: number;     // qty * unitPrice (tax inclusive, before discount)
  taxableValue: number;    // base price excluding tax
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  totalAmount: number;     // final line item amount (tax inclusive)
}

export interface InvoiceTotals {
  items: CalculatedLineItem[];
  grossSubtotal: number;
  discountPct: number;
  discountAmount: number;
  taxableAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  rawGrandTotal: number;
  roundOff: number;
  grandTotal: number;
}

/**
 * Core calculation engine.
 * Tax is ALWAYS INCLUSIVE of selling price.
 * Applies proportional discount per-line before computing GST split.
 * CGST = SGST = GST / 2.
 */
export function calculateInvoiceTotals(
  items: LineItemInput[],
  discountPct: number = 0
): InvoiceTotals {
  const clampedDiscount = Math.max(0, Math.min(100, discountPct));

  let grossSubtotal = 0;
  let taxableAmount = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;

  const calculatedItems: CalculatedLineItem[] = items.map((item) => {
    const grossAmount = round2(item.quantity * item.unitPrice);
    const grossAfterDiscount = round2(grossAmount * (1 - clampedDiscount / 100));

    // Extract taxable base value from tax-inclusive total
    const gstFactor = 1 + (item.gstRate || 0) / 100;
    const taxableValue = round2(grossAfterDiscount / gstFactor);

    const totalGst = round2(grossAfterDiscount - taxableValue);
    const cgstRate = round2((item.gstRate || 0) / 2);
    const sgstRate = round2((item.gstRate || 0) / 2);
    const cgstAmount = round2(totalGst / 2);
    const sgstAmount = round2(totalGst - cgstAmount);
    const totalAmount = grossAfterDiscount;

    grossSubtotal += grossAmount;
    taxableAmount += taxableValue;
    cgstTotal += cgstAmount;
    sgstTotal += sgstAmount;

    return {
      ...item,
      grossAmount,
      taxableValue,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      totalAmount,
    };
  });

  grossSubtotal = round2(grossSubtotal);
  taxableAmount = round2(taxableAmount);
  cgstTotal = round2(cgstTotal);
  sgstTotal = round2(sgstTotal);

  const rawGrandTotal = round2(grossSubtotal * (1 - clampedDiscount / 100));
  const discountAmount = round2(grossSubtotal - rawGrandTotal);
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = round2(roundedGrandTotal - rawGrandTotal);
  const grandTotal = roundedGrandTotal;

  return {
    items: calculatedItems,
    grossSubtotal,
    discountPct: clampedDiscount,
    discountAmount,
    taxableAmount,
    cgstTotal,
    sgstTotal,
    rawGrandTotal: round2(rawGrandTotal),
    roundOff,
    grandTotal,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
