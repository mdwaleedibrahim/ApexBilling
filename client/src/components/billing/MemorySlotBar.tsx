// components/billing/MemorySlotBar.tsx — 5-slot draft cart switcher & auto-saver
import { useEffect } from 'react'
import { useBillingStore } from '../../store/useBillingStore'
import { useSlotStore } from '../../store/useSlotStore'

export default function MemorySlotBar() {
  const { slots, activeSlot, fetchSlots, setActiveSlot, saveSlot, getSlotCart } = useSlotStore()
  const store = useBillingStore()

  // 1. Fetch slots on mount & restore active slot draft if current cart is empty
  useEffect(() => {
    fetchSlots().then(() => {
      const state = useSlotStore.getState()
      const cart = state.getSlotCart(state.activeSlot)
      if (!store.items.length && cart?.items?.length) {
        cart.items.forEach((item: any) => store.addItem(item))
        if (cart.customer) store.setCustomer(cart.customer)
        if (cart.discountPct) store.setDiscountPct(cart.discountPct)
        if (cart.paymentMode) store.setPaymentMode(cart.paymentMode)
        if (cart.docType) store.setDocType(cart.docType)
        if (cart.notes) store.setNotes(cart.notes)
      }
    })
  }, [])

  // 2. Continuous Auto-Save Draft: Whenever active cart data changes, auto-save to current slot
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!store.editingDocId) {
        saveSlot(activeSlot, {
          items: store.items,
          customer: store.customer,
          discountPct: store.discountPct,
          paymentMode: store.paymentMode,
          docType: store.docType,
          notes: store.notes,
        })
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [store.items, store.customer, store.discountPct, store.paymentMode, store.docType, store.notes, activeSlot])

  // 3. Global keyboard shortcuts Alt+1..5
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && ['1','2','3','4','5'].includes(e.key)) {
        e.preventDefault()
        switchSlot(parseInt(e.key))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeSlot, store.items, store.customer, store.discountPct, store.paymentMode, store.docType, store.notes])

  const switchSlot = async (newSlot: number) => {
    if (newSlot === activeSlot) return
    // Save current active slot draft first
    await saveSlot(activeSlot, {
      items: store.items,
      customer: store.customer,
      discountPct: store.discountPct,
      paymentMode: store.paymentMode,
      docType: store.docType,
      notes: store.notes,
    })

    // Switch active slot
    setActiveSlot(newSlot)
    await fetchSlots()

    // Restore cart from target slot
    const cart = getSlotCart(newSlot)
    store.clearCart()
    if (cart.items?.length) {
      cart.items.forEach((item: any) => store.addItem(item))
      if (cart.customer) store.setCustomer(cart.customer)
      if (cart.discountPct) store.setDiscountPct(cart.discountPct || 0)
      if (cart.paymentMode) store.setPaymentMode(cart.paymentMode || 'CASH')
      if (cart.docType) store.setDocType(cart.docType || 'INVOICE')
      if (cart.notes) store.setNotes(cart.notes || '')
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map(id => {
        const slot = slots.find(s => s.slot_id === id)
        const cartState = slot?.cart_state
        const itemCount = cartState?.items?.length || 0
        const hasData = itemCount > 0 || !!cartState?.customer

        // Dynamic styling based on active state and data presence
        let buttonStyle = ''
        if (activeSlot === id) {
          buttonStyle = 'bg-brand-600 text-white shadow-lg shadow-brand-600/30 font-bold ring-2 ring-brand-400/40'
        } else if (hasData) {
          // Highlight slots WITH DATA in distinct vibrant amber/gold badge
          buttonStyle = 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm hover:bg-amber-500/30'
        } else {
          // Empty inactive slots
          buttonStyle = 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-gray-200'
        }

        return (
          <button
            key={id}
            onClick={() => switchSlot(id)}
            title={hasData ? `Slot ${id}: ${itemCount} items saved (Alt+${id})` : `Slot ${id} Empty (Alt+${id})`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${buttonStyle}`}
          >
            <span>S{id}</span>
            {hasData && (
              <span className={`px-1.5 py-0.2 text-[10px] font-extrabold rounded-full ${
                activeSlot === id ? 'bg-white/25 text-white' : 'bg-amber-500 text-gray-950'
              }`}>
                {itemCount}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
