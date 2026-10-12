// store/useDataStore.ts — Global preloaded data cache for items, customers, profiles & slots
import { create } from 'zustand'
import { api } from '../utils/api'
import { useBillingStore } from './useBillingStore'

const getCachedJson = <T>(key: string, fallback: T): T => {
  try {
    const val = localStorage.getItem(key)
    return val ? JSON.parse(val) : fallback
  } catch {
    return fallback
  }
}

interface DataState {
  profiles: any[]
  storeSettings: any
  upiAccounts: any[]
  bankAccounts: any[]
  products: any[]
  customers: any[]
  slots: any[]
  nextInvoiceNumber: string | null
  nextQuotationNumber: string | null
  isPreloaded: boolean
  isPreloading: boolean

  // Actions
  preloadAll: () => Promise<void>
  setProducts: (products: any[]) => void
  setCustomers: (customers: any[]) => void
  setProfilesData: (data: { profiles: any[]; storeSettings?: any; upiAccounts?: any[]; bankAccounts?: any[] }) => void
  refreshProducts: () => Promise<any[]>
  refreshCustomers: () => Promise<any[]>
  refreshProfiles: () => Promise<void>
}

let preloadPromise: Promise<void> | null = null

export const useDataStore = create<DataState>((set, get) => ({
  profiles: getCachedJson<any[]>('apexbill_seller_profiles', []),
  storeSettings: getCachedJson<any>('apexbill_store_settings', null),
  upiAccounts: getCachedJson<any[]>('apexbill_upi_accounts', []),
  bankAccounts: getCachedJson<any[]>('apexbill_bank_accounts', []),
  products: getCachedJson<any[]>('apexbill_cached_inventory', []),
  customers: getCachedJson<any[]>('apexbill_cached_customers', []),
  slots: getCachedJson<any[]>('apexbill_cached_slots', []),
  nextInvoiceNumber: localStorage.getItem('apexbill_cached_next_invoice') || null,
  nextQuotationNumber: localStorage.getItem('apexbill_cached_next_quotation') || null,
  isPreloaded: false,
  isPreloading: false,

  setProducts: (products: any[]) => {
    set({ products })
    try { localStorage.setItem('apexbill_cached_inventory', JSON.stringify(products)) } catch {}
  },

  setCustomers: (customers: any[]) => {
    set({ customers })
    try { localStorage.setItem('apexbill_cached_customers', JSON.stringify(customers)) } catch {}
  },

  setProfilesData: (data) => {
    set({
      profiles: data.profiles || [],
      storeSettings: data.storeSettings ?? get().storeSettings,
      upiAccounts: data.upiAccounts || [],
      bankAccounts: data.bankAccounts || [],
    })
    try {
      if (data.profiles) localStorage.setItem('apexbill_seller_profiles', JSON.stringify(data.profiles))
      if (data.storeSettings) localStorage.setItem('apexbill_store_settings', JSON.stringify(data.storeSettings))
      if (data.upiAccounts) localStorage.setItem('apexbill_upi_accounts', JSON.stringify(data.upiAccounts))
      if (data.bankAccounts) localStorage.setItem('apexbill_bank_accounts', JSON.stringify(data.bankAccounts))
    } catch {}
  },

  refreshProducts: async () => {
    try {
      const items = await api.inventory.list()
      if (Array.isArray(items)) {
        get().setProducts(items)
        return items
      }
    } catch (e) {
      console.warn('[DataStore] Failed to refresh products:', e)
    }
    return get().products
  },

  refreshCustomers: async () => {
    try {
      const customers = await api.customers.list()
      if (Array.isArray(customers)) {
        get().setCustomers(customers)
        return customers
      }
    } catch (e) {
      console.warn('[DataStore] Failed to refresh customers:', e)
    }
    return get().customers
  },

  refreshProfiles: async () => {
    try {
      const res = await api.settings.getProfiles()
      if (res?.profiles) {
        get().setProfilesData(res)
        if (!useBillingStore.getState().sellerProfileId && res.profiles.length > 0) {
          const def = res.profiles.find((p: any) => p.is_default) || res.profiles[0]
          useBillingStore.getState().setSellerProfileId(def.id)
        }
      }
    } catch (e) {
      console.warn('[DataStore] Failed to refresh profiles:', e)
    }
  },

  preloadAll: async () => {
    if (preloadPromise) return preloadPromise

    set({ isPreloading: true })

    // Auto-select seller profile immediately if cached profiles exist
    const cachedProfiles = get().profiles
    if (!useBillingStore.getState().sellerProfileId && cachedProfiles.length > 0) {
      const def = cachedProfiles.find((p: any) => p.is_default) || cachedProfiles[0]
      useBillingStore.getState().setSellerProfileId(def.id)
    }

    preloadPromise = (async () => {
      await Promise.allSettled([
        // 1. Seller Profiles, Bank Accounts, UPI Accounts & Store Settings
        api.settings.getProfiles().then(res => {
          if (res?.profiles) {
            get().setProfilesData(res)
            if (!useBillingStore.getState().sellerProfileId && res.profiles.length > 0) {
              const def = res.profiles.find((p: any) => p.is_default) || res.profiles[0]
              useBillingStore.getState().setSellerProfileId(def.id)
            }
          }
        }).catch(e => console.warn('[Preload] Profiles error:', e)),

        // 2. Inventory (Products)
        api.inventory.list().then(items => {
          if (Array.isArray(items)) {
            get().setProducts(items)
          }
        }).catch(e => console.warn('[Preload] Inventory error:', e)),

        // 3. Customers
        api.customers.list().then(customers => {
          if (Array.isArray(customers)) {
            get().setCustomers(customers)
          }
        }).catch(e => console.warn('[Preload] Customers error:', e)),

        // 4. POS Slots
        api.slots.list().then(slots => {
          if (Array.isArray(slots)) {
            set({ slots })
            try { localStorage.setItem('apexbill_cached_slots', JSON.stringify(slots)) } catch {}
          }
        }).catch(e => console.warn('[Preload] Slots error:', e)),

        // 5. Next document numbers (warm up cache)
        api.documents.nextNumber('INVOICE').then(res => {
          if (res?.suggested) {
            set({ nextInvoiceNumber: res.suggested })
            try { localStorage.setItem('apexbill_cached_next_invoice', res.suggested) } catch {}
          }
        }).catch(() => {}),

        api.documents.nextNumber('QUOTATION').then(res => {
          if (res?.suggested) {
            set({ nextQuotationNumber: res.suggested })
            try { localStorage.setItem('apexbill_cached_next_quotation', res.suggested) } catch {}
          }
        }).catch(() => {}),

        // 6. Pre-warm dashboard metrics
        api.dashboard.metrics('ALL').catch(() => {}),
      ])

      set({ isPreloaded: true, isPreloading: false })
    })()

    return preloadPromise
  },
}))
