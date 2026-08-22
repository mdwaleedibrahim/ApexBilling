// store/useBillingStore.ts — Zustand store for active cart state
import { create } from 'zustand'
import { calcTotals, type LineItem, type InvoiceTotals } from '../utils/gstEngine'
import { todayIso, uuid } from '../utils/upiHelper'

export interface CartItem extends LineItem {
  id: string // local cart row id
}

export interface CustomerDraft {
  phone: string
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
  paymentMode: string
  paymentStatus: string
  docDate: string
  notes: string
  docType: 'INVOICE' | 'QUOTATION'
  selectedUpiId: string | null

  // Editing existing doc
  editingDocId: string | null
  editingDocNumber: string | null
  revisionNumber: number

  // Computed totals (kept in sync)
  totals: InvoiceTotals

  // Actions
  setDocType: (t: 'INVOICE' | 'QUOTATION') => void
  setCustomer: (c: CustomerDraft | null) => void
  setDiscountPct: (d: number) => void
  setPaymentMode: (m: string) => void
  setPaymentStatus: (s: string) => void
  setDocDate: (d: string) => void
  setNotes: (n: string) => void
  setSelectedUpiId: (id: string | null) => void

  addItem: (item: Omit<CartItem, 'id'>) => void
  updateItem: (id: string, patch: Partial<CartItem>) => void
  removeItem: (id: string) => void
  clearCart: () => void

  loadFromDoc: (doc: any) => void
  resetEdit: () => void
}

const emptyTotals = (): InvoiceTotals => calcTotals([], 0)

export const useBillingStore = create<BillingState>((set, get) => ({
  items: [],
  customer: null,
  discountPct: 0,
  paymentMode: 'CASH',
  paymentStatus: 'PAID',
  docDate: todayIso(),
  notes: '',
  docType: 'INVOICE',
  selectedUpiId: null,
  editingDocId: null,
  editingDocNumber: null,
  revisionNumber: 1,
  totals: emptyTotals(),

  setDocType: (t) => set({ docType: t }),
  setCustomer: (c) => set({ customer: c }),
  setDiscountPct: (d) => {
    const items = get().items
    set({ discountPct: d, totals: calcTotals(items, d) })
  },
  setPaymentMode: (m) => set({ paymentMode: m }),
  setPaymentStatus: (s) => set({ paymentStatus: s }),
  setDocDate: (d) => set({ docDate: d }),
  setNotes: (n) => set({ notes: n }),
  setSelectedUpiId: (id) => set({ selectedUpiId: id }),

  addItem: (item) => {
    const items = [...get().items, { ...item, id: uuid() }]
    set({ items, totals: calcTotals(items, get().discountPct) })
  },
  updateItem: (id, patch) => {
    const items = get().items.map(i => i.id === id ? { ...i, ...patch } : i)
    set({ items, totals: calcTotals(items, get().discountPct) })
  },
  removeItem: (id) => {
    const items = get().items.filter(i => i.id !== id)
    set({ items, totals: calcTotals(items, get().discountPct) })
  },
  clearCart: () => set({
    items: [], customer: null, discountPct: 0, paymentMode: 'CASH', paymentStatus: 'PAID',
    notes: '', selectedUpiId: null, docDate: todayIso(), editingDocId: null,
    editingDocNumber: null, revisionNumber: 1, totals: emptyTotals(),
  }),

  loadFromDoc: (doc) => {
    const items: CartItem[] = (doc.items || []).map((i: any) => ({
      id: uuid(), productId: i.product_id, productName: i.product_name,
      hsnSac: i.hsn_sac, quantity: i.quantity, unitPrice: i.unit_price, gstRate: i.gst_rate,
    }))
    const customer = doc.customer_phone ? (() => {
      try { return JSON.parse(doc.customer_snapshot) } catch { return null }
    })() : null
    set({
      items, customer, discountPct: doc.discount_pct || 0,
      paymentMode: doc.payment_mode || 'CASH', paymentStatus: doc.payment_status || 'PAID',
      docDate: doc.doc_date, notes: doc.notes || '', docType: doc.doc_type,
      selectedUpiId: doc.selected_upi_id || null, editingDocId: doc.id,
      editingDocNumber: doc.doc_number, revisionNumber: doc.revision_number || 1,
      totals: calcTotals(items, doc.discount_pct || 0),
    })
  },
  convertQuotationToInvoice: (doc) => {
    const items: CartItem[] = (doc.items || []).map((i: any) => ({
      id: uuid(), productId: i.product_id, productName: i.product_name,
      hsnSac: i.hsn_sac, quantity: i.quantity, unitPrice: i.unit_price, gstRate: i.gst_rate,
    }))
    const customer = doc.customer_phone ? (() => {
      try { return JSON.parse(doc.customer_snapshot) } catch { return null }
    })() : null
    set({
      items, customer, discountPct: doc.discount_pct || 0,
      paymentMode: 'CASH', paymentStatus: 'PAID',
      docDate: todayIso(), notes: doc.notes || '', docType: 'INVOICE',
      selectedUpiId: doc.selected_upi_id || null,
      editingDocId: null,
      editingDocNumber: `Converting ${doc.doc_number}`, revisionNumber: 1,
      totals: calcTotals(items, doc.discount_pct || 0),
    })
  },
  resetEdit: () => set({ editingDocId: null, editingDocNumber: null, revisionNumber: 1 }),
}))
