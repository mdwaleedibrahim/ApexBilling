// components/billing/MemorySlotBar.tsx — 5-slot hold cart switcher
import { useEffect } from 'react'
import { useBillingStore } from '../../store/useBillingStore'
import { useSlotStore } from '../../store/useSlotStore'

export default function MemorySlotBar() {
  const { slots, activeSlot, fetchSlots, setActiveSlot, saveSlot, getSlotCart } = useSlotStore()
  const store = useBillingStore()

  useEffect(() => { fetchSlots() }, [])

  // Alt+1..5 global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && ['1','2','3','4','5'].includes(e.key)) {
        e.preventDefault()
        switchSlot(parseInt(e.key))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeSlot, store.items, store.customer, store.discountPct, store.paymentMode])

  const switchSlot = async (newSlot: number) => {
    if (newSlot === activeSlot) return
    // Save current cart to current slot
    await saveSlot(activeSlot, {
      items: store.items, customer: store.customer,
      discountPct: store.discountPct, paymentMode: store.paymentMode,
    })
    // Load new slot
    const cart = getSlotCart(newSlot)
    store.clearCart()
    if (cart.items?.length) {
      cart.items.forEach((item: any) => store.addItem(item))
      if (cart.customer) store.setCustomer(cart.customer)
      store.setDiscountPct(cart.discountPct || 0)
      store.setPaymentMode(cart.paymentMode || 'CASH')
    }
    setActiveSlot(newSlot)
    await fetchSlots()
  }

  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(id => {
        const slot = slots.find(s => s.slot_id === id)
        const hasItems = slot?.cart_state?.items?.length > 0
        return (
          <button
            key={id}
            onClick={() => switchSlot(id)}
            title={`Slot ${id} (Alt+${id})`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${activeSlot === id
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
              }`}
          >
            <span>S{id}</span>
            {hasItems && <span className={`w-1.5 h-1.5 rounded-full ${activeSlot === id ? 'bg-white/60' : 'bg-amber-400'}`} />}
          </button>
        )
      })}
    </div>
  )
}
