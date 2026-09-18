// utils/api.ts — typed fetch helpers for all backend endpoints

const BASE = '/api'

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {}
  if (options?.body) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(BASE + url, {
    ...options,
    headers: { ...headers, ...options?.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Dashboard ──────────────────────────────────────────────────────────────
export const api = {
  dashboard: {
    metrics: (seller_profile_id?: string) => {
      const q = seller_profile_id && seller_profile_id !== 'ALL' ? `?seller_profile_id=${encodeURIComponent(seller_profile_id)}` : ''
      return req<any>(`/dashboard/metrics${q}`)
    },
    customerBreakdown: (period: string, seller_profile_id?: string) => {
      const params = new URLSearchParams({ period })
      if (seller_profile_id && seller_profile_id !== 'ALL') params.set('seller_profile_id', seller_profile_id)
      return req<any[]>(`/dashboard/customer-breakdown?${params.toString()}`)
    },
    topProducts: (period: string, seller_profile_id?: string) => {
      const params = new URLSearchParams({ period })
      if (seller_profile_id && seller_profile_id !== 'ALL') params.set('seller_profile_id', seller_profile_id)
      return req<any[]>(`/dashboard/top-products?${params.toString()}`)
    },
  },

  // ── Analytics ──────────────────────────────────────────────────────────────
  analytics: {
    customer: (phone: string) => req<any>(`/analytics/customer/${encodeURIComponent(phone)}`),
  },

  // ── Documents ─────────────────────────────────────────────────────────────
  documents: {
    list: (params?: { type?: string; status?: string; search?: string; customer_phone?: string; seller_profile_id?: string }) => {
      const cleanParams: Record<string, string> = {}
      if (params?.type) cleanParams.type = params.type
      if (params?.status) cleanParams.status = params.status
      if (params?.search) cleanParams.search = params.search
      if (params?.customer_phone) cleanParams.customer_phone = params.customer_phone
      if (params?.seller_profile_id && params.seller_profile_id !== 'ALL') cleanParams.seller_profile_id = params.seller_profile_id
      const q = new URLSearchParams(cleanParams).toString()
      return req<any[]>(`/documents${q ? '?' + q : ''}`)
    },
    get: (id: string) => req<any>(`/documents/${id}`),
    create: (body: any) => req<any>('/documents', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => req<any>(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    cancel: (id: string) => req<any>(`/documents/${id}/cancel`, { method: 'PATCH' }),
    convert: (id: string, body?: any) => req<any>(`/documents/${id}/convert`, { method: 'POST', body: JSON.stringify(body || {}) }),
    delete: (id: string) => req<any>(`/documents/${id}`, { method: 'DELETE' }),
    setStatus: (id: string, payment_status: string, payment_mode?: string, paid_amount?: number, partial_payment_mode?: string) =>
      req<any>(`/documents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ payment_status, payment_mode, paid_amount, partial_payment_mode }) }),
  },

  // ── Customers ─────────────────────────────────────────────────────────────
  customers: {
    list: () => req<any[]>('/customers'),
    search: (q: string) => req<any[]>(`/customers/search?q=${encodeURIComponent(q)}`),
    lookup: (params: { phone?: string; name?: string }) => {
      const q = new URLSearchParams()
      if (params.phone) q.set('phone', params.phone)
      if (params.name) q.set('name', params.name)
      return req<{ phoneMatch?: any; nameMatches: any[] }>(`/customers/lookup?${q.toString()}`)
    },
    get: (phone: string) => req<any>(`/customers/${encodeURIComponent(phone)}`),
    upsert: (body: any) => req<any>('/customers', { method: 'POST', body: JSON.stringify(body) }),
    update: (phone: string, body: any) => req<any>(`/customers/${encodeURIComponent(phone)}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (phone: string) => req<any>(`/customers/${encodeURIComponent(phone)}`, { method: 'DELETE' }),
    invoices: (phone: string) => req<any[]>(`/customers/${encodeURIComponent(phone)}/invoices`),
    gstinLookup: (gstin: string) => req<any>(`/gstin/${encodeURIComponent(gstin)}`),
  },

  // ── Inventory ─────────────────────────────────────────────────────────────
  inventory: {
    list: () => req<any[]>('/inventory'),
    search: (q: string) => req<any[]>(`/inventory/search?q=${encodeURIComponent(q)}`),
    get: (id: string) => req<any>(`/inventory/${id}`),
    create: (body: any) => req<any>('/inventory', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => req<any>(`/inventory/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => req<any>(`/inventory/${id}`, { method: 'DELETE' }),
    importCsv: (csv: string, stock_mode: 'replace' | 'add' = 'replace') =>
      req<any>('/inventory/import-csv', { method: 'POST', body: JSON.stringify({ csv, stock_mode }) }),
    exportCsvUrl: () => '/api/inventory/export-csv',
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  settings: {
    getProfiles: () => req<{ profiles: any[]; bankAccounts: any[]; upiAccounts: any[]; storeSettings: any }>('/settings/profiles'),
    getProfile: () => req<any>('/settings/profile'),
    createProfile: (body: any) => req<any>('/settings/profiles', { method: 'POST', body: JSON.stringify(body) }),
    updateProfile: (idOrBody: string | any, body?: any) => {
      if (typeof idOrBody === 'string' && body !== undefined) {
        return req<any>(`/settings/profiles/${idOrBody}`, { method: 'PUT', body: JSON.stringify(body) });
      }
      return req<any>('/settings/profile', { method: 'PUT', body: JSON.stringify(idOrBody) });
    },
    deleteProfile: (id: string) => req<any>(`/settings/profiles/${id}`, { method: 'DELETE' }),

    getBankAccounts: () => req<any[]>('/settings/bank-accounts'),
    createBankAccount: (body: any) => req<any>('/settings/bank-accounts', { method: 'POST', body: JSON.stringify(body) }),
    updateBankAccount: (id: string, body: any) => req<any>(`/settings/bank-accounts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteBankAccount: (id: string) => req<any>(`/settings/bank-accounts/${id}`, { method: 'DELETE' }),

    updateStorePreferences: (body: any) => req<any>('/settings/store-preferences', { method: 'PUT', body: JSON.stringify(body) }),
    updateLegacyProfile: (body: any) => req<any>('/settings/profile', { method: 'PUT', body: JSON.stringify(body) }),

    addUpi: (body: any) => req<any>('/settings/upi', { method: 'POST', body: JSON.stringify(body) }),
    updateUpi: (id: string, body: any) => req<any>(`/settings/upi/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteUpi: (id: string) => req<any>(`/settings/upi/${id}`, { method: 'DELETE' }),
  },

  // ── POS Slots ─────────────────────────────────────────────────────────────
  slots: {
    list: () => req<any[]>('/pos/slots'),
    save: (slotId: number, cart_state: any, slot_label?: string) =>
      req<any>(`/pos/slots/${slotId}`, { method: 'PUT', body: JSON.stringify({ cart_state, slot_label }) }),
  },

  // ── Admin & Maintenance ───────────────────────────────────────────────────
  admin: {
    getSystemInfo: () => req<any>('/admin/system-info'),
    exportBackup: () => req<any>('/admin/backup/export'),
    restoreBackup: (payload: any) => req<any>('/admin/backup/restore', { method: 'POST', body: JSON.stringify(payload) }),
    createSnapshot: () => req<any>('/admin/backup/snapshot'),
  },
}
