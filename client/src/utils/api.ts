// utils/api.ts — typed fetch helpers for all backend endpoints

const BASE = '/api'

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
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
    metrics: () => req<any>('/dashboard/metrics'),
    customerBreakdown: (period: string) => req<any[]>(`/dashboard/customer-breakdown?period=${period}`),
    topProducts: (period: string) => req<any[]>(`/dashboard/top-products?period=${period}`),
  },

  // ── Documents ─────────────────────────────────────────────────────────────
  documents: {
    list: (params?: { type?: string; status?: string; search?: string }) => {
      const q = new URLSearchParams(params as any).toString()
      return req<any[]>(`/documents${q ? '?' + q : ''}`)
    },
    get: (id: string) => req<any>(`/documents/${id}`),
    create: (body: any) => req<any>('/documents', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => req<any>(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    cancel: (id: string) => req<any>(`/documents/${id}/cancel`, { method: 'PATCH' }),
    setStatus: (id: string, payment_status: string, payment_mode?: string) =>
      req<any>(`/documents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ payment_status, payment_mode }) }),
  },

  // ── Customers ─────────────────────────────────────────────────────────────
  customers: {
    list: () => req<any[]>('/customers'),
    search: (q: string) => req<any[]>(`/customers/search?q=${encodeURIComponent(q)}`),
    get: (phone: string) => req<any>(`/customers/${encodeURIComponent(phone)}`),
    upsert: (body: any) => req<any>('/customers', { method: 'POST', body: JSON.stringify(body) }),
    update: (phone: string, body: any) => req<any>(`/customers/${encodeURIComponent(phone)}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (phone: string) => req<any>(`/customers/${encodeURIComponent(phone)}`, { method: 'DELETE' }),
    invoices: (phone: string) => req<any[]>(`/customers/${encodeURIComponent(phone)}/invoices`),
  },

  // ── Inventory ─────────────────────────────────────────────────────────────
  inventory: {
    list: () => req<any[]>('/inventory'),
    search: (q: string) => req<any[]>(`/inventory/search?q=${encodeURIComponent(q)}`),
    get: (id: string) => req<any>(`/inventory/${id}`),
    create: (body: any) => req<any>('/inventory', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => req<any>(`/inventory/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => req<any>(`/inventory/${id}`, { method: 'DELETE' }),
    importCsv: (csv: string) => req<any>('/inventory/import-csv', { method: 'POST', body: JSON.stringify({ csv }) }),
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  settings: {
    getProfile: () => req<any>('/settings/profile'),
    updateProfile: (body: any) => req<any>('/settings/profile', { method: 'PUT', body: JSON.stringify(body) }),
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
}
