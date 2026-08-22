/**
 * calculation.service.ts
 * Phase 2: Dual Tax & Proportionate Discount Engine (CGST + SGST)
 */

export interface LineItemInput {
  productId?: string;
  productName: string;
  hsnSac?: string;
  quantity: number;
  unitPrice: number;  // Pre-tax unit selling price
  gstRate: number;    // Total GST % (e.g. 18 → CGST 9% + SGST 9%)
}

export interface CalculatedLineItem extends LineItemInput {
  grossAmount: number;     // qty * unitPrice (before discount)
  taxableValue: number;    // grossAmount * (1 - discountPct/100)
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  totalAmount: number;     // taxableValue + cgst + sgst
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
 * Applies proportional discount per-line before computing GST.
 * CGST = SGST = GST/2 (intra-state supply assumed).
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
    const taxableValue = round2(grossAmount * (1 - clampedDiscount / 100));

    const cgstRate = round2(item.gstRate / 2);
    const sgstRate = round2(item.gstRate / 2);
    const cgstAmount = round2(taxableValue * (cgstRate / 100));
    const sgstAmount = round2(taxableValue * (sgstRate / 100));
    const totalAmount = round2(taxableValue + cgstAmount + sgstAmount);

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

  const discountAmount = round2(grossSubtotal - taxableAmount);
  const rawGrandTotal = taxableAmount + cgstTotal + sgstTotal;
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
