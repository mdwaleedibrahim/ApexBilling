// store/useSlotStore.ts — 5 POS memory slot manager synced with backend
import { create } from 'zustand'
import { api } from '../utils/api'

export interface Slot {
  slot_id: number
  slot_label: string
  cart_state: any
  updated_at: string
}

interface SlotStore {
  slots: Slot[]
  activeSlot: number
  loading: boolean
  fetchSlots: () => Promise<void>
  setActiveSlot: (id: number) => void
  saveSlot: (id: number, cart: any, label?: string) => Promise<void>
  getSlotCart: (id: number) => any
}

export const useSlotStore = create<SlotStore>((set, get) => ({
  slots: [],
  activeSlot: 1,
  loading: false,

  fetchSlots: async () => {
    set({ loading: true })
    try {
      const slots = await api.slots.list()
      const parsed = slots.map((s: any) => ({
        ...s,
        cart_state: typeof s.cart_state === 'string' ? JSON.parse(s.cart_state) : s.cart_state,
      }))
      set({ slots: parsed })
    } finally {
      set({ loading: false })
    }
  },

  setActiveSlot: (id) => set({ activeSlot: id }),

  saveSlot: async (id, cart, label) => {
    await api.slots.save(id, cart, label)
    await get().fetchSlots()
  },

  getSlotCart: (id) => {
    const slot = get().slots.find(s => s.slot_id === id)
    return slot?.cart_state ?? { items: [], customer: null, discountPct: 0, paymentMode: 'CASH' }
  },
}))
