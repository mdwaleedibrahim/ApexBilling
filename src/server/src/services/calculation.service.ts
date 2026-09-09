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
  unitPrice: number;  // Tax-inclusive unit selling price (Price)
  mrp?: number;        // Maximum retail price (printed on bills, not used in calculation)
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
  additionalDiscount: number;
  taxableAmount: number;
  cgstTotal: number;
  sgstTotal: number;
  rawGrandTotal: number;
  roundOff: number;
  grandTotal: number;
}

/**
 * Core calculation engine.
 * Tax is ALWAYS INCLUSIVE of selling price (Price).
 * Applies proportional discount (% discount and fixed Rupee additional discount) per-line before computing GST split.
 * CGST = SGST = GST / 2.
 */
export function calculateInvoiceTotals(
  items: LineItemInput[],
  discountPct: number = 0,
  additionalDiscount: number = 0
): InvoiceTotals {
  const clampedDiscount = Math.max(0, Math.min(100, discountPct));

  let grossSubtotal = 0;
  for (const item of items) {
    grossSubtotal += round2(item.quantity * item.unitPrice);
  }
  grossSubtotal = round2(grossSubtotal);

  // Percentage discount amount
  const pctDiscountAmount = round2(grossSubtotal * (clampedDiscount / 100));

  // Max allowable additional discount is whatever remains of grossSubtotal
  const remainingAfterPct = Math.max(0, grossSubtotal - pctDiscountAmount);
  const clampedAdditionalDiscount = Math.max(0, Math.min(remainingAfterPct, additionalDiscount || 0));

  // Total discount amount combined
  const totalDiscountAmount = round2(pctDiscountAmount + clampedAdditionalDiscount);

  // Effective discount rate across line items
  const effectiveDiscountRate = grossSubtotal > 0 ? (totalDiscountAmount / grossSubtotal) : 0;

  let taxableAmount = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;

  const calculatedItems: CalculatedLineItem[] = items.map((item) => {
    const grossAmount = round2(item.quantity * item.unitPrice);
    const lineDiscount = round2(grossAmount * effectiveDiscountRate);
    const grossAfterDiscount = round2(Math.max(0, grossAmount - lineDiscount));

    // Extract taxable base value from tax-inclusive total
    const gstFactor = 1 + (item.gstRate || 0) / 100;
    const taxableValue = round2(grossAfterDiscount / gstFactor);

    const totalGst = round2(grossAfterDiscount - taxableValue);
    const cgstRate = round2((item.gstRate || 0) / 2);
    const sgstRate = round2((item.gstRate || 0) / 2);
    const cgstAmount = round2(totalGst / 2);
    const sgstAmount = round2(totalGst - cgstAmount);
    const totalAmount = grossAfterDiscount;

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

  taxableAmount = round2(taxableAmount);
  cgstTotal = round2(cgstTotal);
  sgstTotal = round2(sgstTotal);

  const rawGrandTotal = round2(Math.max(0, grossSubtotal - totalDiscountAmount));
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = round2(roundedGrandTotal - rawGrandTotal);
  const grandTotal = roundedGrandTotal;

  return {
    items: calculatedItems,
    grossSubtotal,
    discountPct: clampedDiscount,
    discountAmount: pctDiscountAmount,
    additionalDiscount: clampedAdditionalDiscount,
    taxableAmount,
    cgstTotal,
    sgstTotal,
    rawGrandTotal,
    roundOff,
    grandTotal,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
