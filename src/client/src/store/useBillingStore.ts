// store/useBillingStore.ts — Zustand store for active cart state
import { create } from 'zustand'
import { calcTotals, type LineItem, type InvoiceTotals } from '../utils/gstEngine'
import { todayIso, uuid } from '../utils/upiHelper'

export interface CartItem extends LineItem {
  id: string // local cart row id
}

export interface CustomerDraft {
  phone?: string
  name: string
  email?: string
  gstin?: string
  billing_address?: string
  state_code?: string
}

export interface BillingState {
  // Cart
  items: CartItem[]
  customer: CustomerDraft | null
  discountPct: number
  additionalDiscount: number
  paymentMode: string
  paymentStatus: string
  docDate: string
  notes: string
  docType: 'INVOICE' | 'QUOTATION'
  selectedUpiId: string | null
  hideTaxOnInvoice: boolean
  selectedTerms: string[]
  paidAmount: number
  previouslyPaidAmount: number  // amount already paid before this edit session (Credit invoices)
  partialPaymentMode: 'CASH' | 'UPI'
  qrAmountType: 'DELTA' | 'FULL'
  convertingFromQuotationId: string | null

  // Editing existing doc
  editingDocId: string | null
  editingDocNumber: string | null
  revisionNumber: number
  originalGrandTotal: number | null
  originalPaidAmount: number | null
  originalPaymentStatus: string | null
  originalPaymentMode: string | null

  // Computed totals (kept in sync)
  totals: InvoiceTotals

  // Actions
  setDocType: (t: 'INVOICE' | 'QUOTATION') => void
  setCustomer: (c: CustomerDraft | null) => void
  setDiscountPct: (d: number) => void
  setAdditionalDiscount: (d: number) => void
  setPaymentMode: (m: string) => void
  setPaymentStatus: (s: string) => void
  setDocDate: (d: string) => void
  setNotes: (n: string) => void
  setSelectedUpiId: (id: string | null) => void
  setHideTaxOnInvoice: (h: boolean) => void
  setSelectedTerms: (terms: string[]) => void
  setPaidAmount: (amt: number) => void
  setPartialPaymentMode: (mode: 'CASH' | 'UPI') => void
  setConvertingFromQuotationId: (id: string | null) => void
  setQrAmountType: (t: 'DELTA' | 'FULL') => void

  addItem: (item: Omit<CartItem, 'id'>) => void
  updateItem: (id: string, patch: Partial<CartItem>) => void
  removeItem: (id: string) => void
  clearCart: () => void

  loadFromDoc: (doc: any) => void
  convertQuotationToInvoice: (doc: any) => void
  resetEdit: () => void
}

const emptyTotals = (): InvoiceTotals => calcTotals([], 0, 0)

export const useBillingStore = create<BillingState>((set, get) => ({
  items: [],
  customer: null,
  discountPct: 0,
  additionalDiscount: 0,
  paymentMode: 'CASH',
  paymentStatus: 'PAID',
  docDate: todayIso(),
  notes: '',
  docType: 'INVOICE',
  selectedUpiId: null,
  hideTaxOnInvoice: false,
  selectedTerms: [],
  paidAmount: 0,
  previouslyPaidAmount: 0,
  partialPaymentMode: 'CASH',
  qrAmountType: 'DELTA',
  convertingFromQuotationId: null,
  editingDocId: null,
  editingDocNumber: null,
  revisionNumber: 1,
  originalGrandTotal: null,
  originalPaidAmount: null,
  originalPaymentStatus: null,
  originalPaymentMode: null,
  totals: emptyTotals(),

  setDocType: (t) => {
    const prev = get().docType
    if (prev !== t && !get().editingDocId) {
      set({ docType: t, selectedTerms: [] })
    } else {
      set({ docType: t })
    }
  },
  setCustomer: (c) => set({ customer: c }),
  setDiscountPct: (d) => {
    const { items, additionalDiscount } = get()
    set({ discountPct: d, totals: calcTotals(items, d, additionalDiscount) })
  },
  setAdditionalDiscount: (ad) => {
    const { items, discountPct } = get()
    set({ additionalDiscount: ad, totals: calcTotals(items, discountPct, ad) })
  },
  setPaymentMode: (m) => set({ paymentMode: m }),
  setPaymentStatus: (s) => set({ paymentStatus: s }),
  setDocDate: (d) => set({ docDate: d }),
  setNotes: (n) => set({ notes: n }),
  setSelectedUpiId: (id) => set({ selectedUpiId: id }),
  setHideTaxOnInvoice: (h) => set({ hideTaxOnInvoice: h }),
  setSelectedTerms: (terms) => set({ selectedTerms: terms }),
  setPaidAmount: (amt) => set({ paidAmount: amt }),
  setPartialPaymentMode: (mode) => set({ partialPaymentMode: mode }),
  setConvertingFromQuotationId: (id) => set({ convertingFromQuotationId: id }),
  setQrAmountType: (t) => set({ qrAmountType: t }),

  addItem: (item) => {
    const items = [...get().items, { ...item, id: uuid() }]
    set({ items, totals: calcTotals(items, get().discountPct, get().additionalDiscount) })
  },
  updateItem: (id, patch) => {
    const items = get().items.map(i => i.id === id ? { ...i, ...patch } : i)
    set({ items, totals: calcTotals(items, get().discountPct, get().additionalDiscount) })
  },
  removeItem: (id) => {
    const items = get().items.filter(i => i.id !== id)
    set({ items, totals: calcTotals(items, get().discountPct, get().additionalDiscount) })
  },
  clearCart: () => set({
    items: [], customer: null, discountPct: 0, additionalDiscount: 0, paymentMode: 'CASH', paymentStatus: 'PAID',
    notes: '', selectedUpiId: null, hideTaxOnInvoice: false, selectedTerms: [], docDate: todayIso(), editingDocId: null,
    editingDocNumber: null, revisionNumber: 1, originalGrandTotal: 0, originalPaidAmount: 0, originalPaymentStatus: '', originalPaymentMode: '', totals: emptyTotals(),
    paidAmount: 0, previouslyPaidAmount: 0, partialPaymentMode: 'CASH', qrAmountType: 'DELTA', convertingFromQuotationId: null,
  }),

  loadFromDoc: (doc) => {
    const items: CartItem[] = (doc.items || []).map((i: any) => ({
      id: uuid(), productId: i.product_id, productName: i.product_name,
      hsnSac: i.hsn_sac, unit: i.unit || 'PCS', purchasePrice: i.purchase_price || 0, quantity: i.quantity, unitPrice: i.unit_price, mrp: i.mrp || 0, gstRate: i.gst_rate,
    }))
    const customer = doc.customer_snapshot ? (() => {
      try { return JSON.parse(doc.customer_snapshot) } catch { return null }
    })() : (doc.customer_phone ? { phone: doc.customer_phone, name: '' } : null)
    let terms: string[] = []
    if (doc.terms_and_conditions) {
      try {
        terms = typeof doc.terms_and_conditions === 'string' ? JSON.parse(doc.terms_and_conditions) : doc.terms_and_conditions
      } catch {}
    }
    const addlDisc = doc.additional_discount || 0
    const alreadyPaid = doc.paid_amount || 0
    const grandTotal = doc.grand_total || 0
    const isCreditEdit = doc.payment_mode === 'CREDIT'
    // For Credit invoices being edited, prefill paidAmount with the remaining balance
    const initPaidAmount = isCreditEdit && doc.payment_status !== 'PAID'
      ? Math.max(0, grandTotal - alreadyPaid)
      : alreadyPaid
    set({
      items, customer, discountPct: doc.discount_pct || 0,
      additionalDiscount: addlDisc,
      paymentMode: doc.payment_mode || 'CASH', paymentStatus: doc.payment_status || 'PAID',
      docDate: doc.doc_date, notes: doc.notes || '', docType: doc.doc_type,
      selectedUpiId: doc.selected_upi_id || null, hideTaxOnInvoice: !!doc.hide_tax_on_invoice,
      selectedTerms: Array.isArray(terms) ? terms : [],
      paidAmount: initPaidAmount,
      previouslyPaidAmount: isCreditEdit ? alreadyPaid : 0,
      partialPaymentMode: doc.partial_payment_mode || 'CASH',
      qrAmountType: 'DELTA', // Always select Delta by default for QR code generation in Cash & UPI payment if invoice is updated
      convertingFromQuotationId: null,
      editingDocId: doc.id,
      editingDocNumber: doc.doc_number, revisionNumber: doc.revision_number || 1,
      originalGrandTotal: grandTotal,
      originalPaidAmount: alreadyPaid,
      originalPaymentStatus: doc.payment_status || 'PAID',
      originalPaymentMode: doc.payment_mode || 'CASH',
      totals: calcTotals(items, doc.discount_pct || 0, addlDisc),
    })
  },
  convertQuotationToInvoice: (doc) => {
    const items: CartItem[] = (doc.items || []).map((i: any) => ({
      id: uuid(), productId: i.product_id, productName: i.product_name,
      hsnSac: i.hsn_sac, unit: i.unit || 'PCS', purchasePrice: i.purchase_price || 0, quantity: i.quantity, unitPrice: i.unit_price, mrp: i.mrp || 0, gstRate: i.gst_rate,
    }))
    const customer = doc.customer_snapshot ? (() => {
      try { return JSON.parse(doc.customer_snapshot) } catch { return null }
    })() : (doc.customer_phone ? { phone: doc.customer_phone, name: '' } : null)
    const addlDisc = doc.additional_discount || 0
    set({
      items, customer, discountPct: doc.discount_pct || 0,
      additionalDiscount: addlDisc,
      paymentMode: 'CASH', paymentStatus: 'PAID',
      docDate: todayIso(), notes: doc.notes || '', docType: 'INVOICE',
      selectedUpiId: doc.selected_upi_id || null,
      selectedTerms: [],
      paidAmount: 0,
      partialPaymentMode: 'CASH',
      convertingFromQuotationId: doc.id,
      editingDocId: null,
      editingDocNumber: `Converting ${doc.doc_number}`, revisionNumber: 1,
      totals: calcTotals(items, doc.discount_pct || 0, addlDisc),
    })
  },
  resetEdit: () => set({ editingDocId: null, editingDocNumber: null, revisionNumber: 1 }),
}))
