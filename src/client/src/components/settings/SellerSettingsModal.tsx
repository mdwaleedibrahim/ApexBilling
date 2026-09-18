// components/settings/SellerSettingsModal.tsx — Multi-Seller Profiles, Bank Accounts & Admin
import React, { useEffect, useState } from 'react'
import {
  X, Save, Plus, Trash2, Star, QrCode, ShieldCheck, Database,
  Download, Upload, Camera, RefreshCw, AlertTriangle, FileText, AlertOctagon, TrendingUp,
  Building2, Landmark, Smartphone, Sliders, CheckCircle2, Edit3, ArrowLeft, Check
} from 'lucide-react'
import { api } from '../../utils/api'
import { INDIAN_STATES } from '../../utils/gstEngine'
import { useDialogStore } from '../../store/useDialogStore'

type TabType = 'profiles' | 'bank' | 'upi' | 'store' | 'admin'

const INITIAL_PROFILE_FORM = {
  id: '',
  business_name: '',
  trade_name: '',
  gstin: '',
  pan: '',
  phone: '',
  email: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state_code: '36',
  pincode: '',
  bank_account_id: '',
  active_upi_id: '',
  is_default: false
}

const INITIAL_BANK_FORM = {
  id: '',
  bank_name: '',
  account_number: '',
  ifsc_code: '',
  branch_name: '',
  account_holder: '',
  is_default: false
}

export default function SellerSettingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<TabType>('profiles')
  const [profiles, setProfiles] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [upiAccounts, setUpiAccounts] = useState<any[]>([])
  const [storeSettings, setStoreSettings] = useState<any>(null)
  const [systemInfo, setSystemInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // Seller Profile Form State
  const [profileMode, setProfileMode] = useState<'list' | 'create' | 'edit'>('list')
  const [profileForm, setProfileForm] = useState(INITIAL_PROFILE_FORM)

  // Bank Form State
  const [bankMode, setBankMode] = useState<'list' | 'create' | 'edit'>('list')
  const [bankForm, setBankForm] = useState(INITIAL_BANK_FORM)

  // UPI Form State
  const [upiForm, setUpiForm] = useState({ upi_id: '', payee_name: '', label: '', is_default: false })

  // Admin / Restore / Cleanup State
  const [restoreMsg, setRestoreMsg] = useState({ type: '', text: '' })
  const [selectedBackupFile, setSelectedBackupFile] = useState<any>(null)
  const [cleanupMsg, setCleanupMsg] = useState({ type: '', text: '' })
  const [cleanupLoading, setCleanupLoading] = useState(false)

  const load = async () => {
    try {
      const [res, sys] = await Promise.all([
        api.settings.getProfiles(),
        api.admin.getSystemInfo().catch(() => null)
      ])
      if (res) {
        setProfiles(res.profiles || [])
        setBankAccounts(res.bankAccounts || [])
        setUpiAccounts(res.upiAccounts || [])
        setStoreSettings(res.storeSettings || {})
      }
      setSystemInfo(sys)
    } catch (err) {
      console.error('Error loading settings data:', err)
    }
  }

  useEffect(() => { load() }, [])

  const notify = (text: string) => {
    setMsg(text)
    setTimeout(() => setMsg(''), 2500)
  }

  // ── Profile Handlers ────────────────────────────────────────────────────────
  const startCreateProfile = () => {
    setProfileForm({
      ...INITIAL_PROFILE_FORM,
      is_default: profiles.length === 0,
      bank_account_id: bankAccounts[0]?.id || '',
      active_upi_id: upiAccounts[0]?.upi_id || ''
    })
    setProfileMode('create')
  }

  const startEditProfile = (p: any) => {
    setProfileForm({
      id: p.id,
      business_name: p.business_name || '',
      trade_name: p.trade_name || '',
      gstin: p.gstin || '',
      pan: p.pan || '',
      phone: p.phone || '',
      email: p.email || '',
      address_line1: p.address_line1 || '',
      address_line2: p.address_line2 || '',
      city: p.city || '',
      state_code: p.state_code || '36',
      pincode: p.pincode || '',
      bank_account_id: p.bank_account_id || '',
      active_upi_id: p.active_upi_id || '',
      is_default: !!p.is_default
    })
    setProfileMode('edit')
  }

  const handleGstinChange = (val: string) => {
    const g = val.toUpperCase().slice(0, 15)
    let stateCode = profileForm.state_code
    let pan = profileForm.pan

    if (g.length >= 2) {
      const prefix = g.slice(0, 2)
      if (INDIAN_STATES[prefix]) {
        stateCode = prefix
      }
    }
    if (g.length >= 12 && !pan) {
      pan = g.slice(2, 12)
    }
    setProfileForm(prev => ({ ...prev, gstin: g, state_code: stateCode, pan }))
  }

  const saveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!profileForm.business_name?.trim() || !profileForm.gstin?.trim() || !profileForm.phone?.trim() || !profileForm.address_line1?.trim() || !profileForm.city?.trim() || !profileForm.pincode?.trim()) {
      alert('Please fill all required fields (Business Name, GSTIN, Phone, Address, City, Pincode)')
      return
    }

    setLoading(true)
    try {
      if (profileMode === 'create') {
        await api.settings.createProfile(profileForm)
        notify('Seller Profile created successfully!')
      } else {
        await api.settings.updateProfile(profileForm.id, profileForm)
        notify('Seller Profile updated successfully!')
      }
      setProfileMode('list')
      await load()
    } catch (err: any) {
      alert(err?.message || 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  const setDefaultProfile = async (p: any) => {
    try {
      await api.settings.updateProfile(p.id, { is_default: true })
      notify(`"${p.business_name}" is now the default Seller Profile`)
      await load()
    } catch (err: any) {
      alert(err?.message || 'Failed to set default profile')
    }
  }

  const deleteProfile = async (p: any) => {
    if (profiles.length <= 1) {
      await useDialogStore.getState().show('At least one Seller Profile must be maintained. Cannot delete.', false, 'Delete Restricted')
      return
    }
    const ok = await useDialogStore.getState().show(
      `Delete Seller Profile "${p.business_name}" (${p.gstin})?\n\nPast invoices will still retain their frozen seller snapshot.`,
      true,
      'Delete Seller Profile'
    )
    if (!ok) return

    try {
      await api.settings.deleteProfile(p.id)
      notify('Seller profile removed')
      await load()
    } catch (err: any) {
      alert(err?.message || 'Failed to delete profile')
    }
  }

  // ── Bank Handlers ──────────────────────────────────────────────────────────
  const startCreateBank = () => {
    setBankForm({
      ...INITIAL_BANK_FORM,
      is_default: bankAccounts.length === 0
    })
    setBankMode('create')
  }

  const startEditBank = (b: any) => {
    setBankForm({
      id: b.id,
      bank_name: b.bank_name || '',
      account_number: b.account_number || '',
      ifsc_code: b.ifsc_code || '',
      branch_name: b.branch_name || '',
      account_holder: b.account_holder || '',
      is_default: !!b.is_default
    })
    setBankMode('edit')
  }

  const saveBank = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!bankForm.bank_name?.trim() || !bankForm.account_number?.trim() || !bankForm.ifsc_code?.trim()) {
      alert('Bank Name, Account Number, and IFSC Code are required')
      return
    }

    setLoading(true)
    try {
      if (bankMode === 'create') {
        await api.settings.createBankAccount(bankForm)
        notify('Bank Account added!')
      } else {
        await api.settings.updateBankAccount(bankForm.id, bankForm)
        notify('Bank Account updated!')
      }
      setBankMode('list')
      await load()
    } catch (err: any) {
      alert(err?.message || 'Failed to save bank account')
    } finally {
      setLoading(false)
    }
  }

  const setDefaultBank = async (b: any) => {
    try {
      await api.settings.updateBankAccount(b.id, { is_default: true })
      notify(`Default bank set to ${b.bank_name}`)
      await load()
    } catch (err: any) {
      alert(err?.message || 'Failed to set default bank')
    }
  }

  const deleteBank = async (b: any) => {
    const ok = await useDialogStore.getState().show(
      `Delete bank account "${b.bank_name} (${b.account_number})"?`,
      true,
      'Delete Bank Account'
    )
    if (!ok) return

    try {
      await api.settings.deleteBankAccount(b.id)
      notify('Bank account removed')
      await load()
    } catch (err: any) {
      alert(err?.message || 'Failed to delete bank account')
    }
  }

  // ── UPI Handlers ───────────────────────────────────────────────────────────
  const addUpi = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!upiForm.upi_id || !upiForm.payee_name || !upiForm.label) return
    try {
      await api.settings.addUpi(upiForm)
      setUpiForm({ upi_id: '', payee_name: '', label: '', is_default: false })
      notify('UPI account added!')
      await load()
    } catch (err) {
      console.error('Error adding UPI account:', err)
    }
  }

  const deleteUpi = async (id: string, e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation() }
    setUpiAccounts(prev => prev.filter(a => a.id !== id && a.upi_id !== id))
    try {
      await api.settings.deleteUpi(id)
      notify('UPI account removed')
      await load()
    } catch (err) {
      console.error('Error deleting UPI account:', err)
      await load()
    }
  }

  const setDefaultUpi = async (acc: any, e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation() }
    try {
      await api.settings.updateUpi(acc.id, { ...acc, is_default: true })
      notify('Default UPI updated')
      await load()
    } catch (err) {
      console.error('Error setting default UPI account:', err)
    }
  }

  // ── Store Preferences Handlers ────────────────────────────────────────────
  const saveStorePreferences = async () => {
    if (!storeSettings) return
    setLoading(true)
    try {
      await api.settings.updateStorePreferences(storeSettings)
      notify('Store & POS settings saved!')
      await load()
    } catch (err: any) {
      alert(err?.message || 'Failed to save store settings')
    } finally {
      setLoading(false)
    }
  }

  // ── Admin, Backup & Danger Zone ───────────────────────────────────────────
  const handleExportBackup = async () => {
    try {
      const data = await api.admin.exportBackup()
      const jsonStr = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ApexBill_Full_Backup_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string)
        if (!json || (!json.data && !json.profile)) {
          setRestoreMsg({ type: 'error', text: 'Invalid backup file format' })
          return
        }
        setSelectedBackupFile(json)
        setRestoreMsg({ type: 'info', text: `Backup file validated: Contains ${json.data?.documents?.length || json.documents?.length || 0} documents.` })
      } catch (err) {
        setRestoreMsg({ type: 'error', text: 'Failed to parse JSON backup file' })
      }
    }
    reader.readAsText(file)
  }

  const handleRestore = async () => {
    if (!selectedBackupFile) return
    const ok = await useDialogStore.getState().show('WARNING: Restoring will replace current database records with the backup data. Continue?', true, 'Restore Database')
    if (!ok) return
    setLoading(true)
    try {
      await api.admin.restoreBackup(selectedBackupFile)
      setRestoreMsg({ type: 'success', text: 'System successfully restored from backup! Reloading app...' })
      setSelectedBackupFile(null)
      await load()
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err: any) {
      setRestoreMsg({ type: 'error', text: err?.message || 'Restore failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSnapshot = async () => {
    try {
      const res = await api.admin.createSnapshot()
      setRestoreMsg({ type: 'success', text: `Snapshot created: ${res.snapshot}` })
      await load()
    } catch (err: any) {
      setRestoreMsg({ type: 'error', text: 'Snapshot creation failed' })
    }
  }

  const handleCleanup = async (scope: 'billing' | 'inventory' | 'customers' | 'all') => {
    const scopeLabel = scope === 'billing' ? 'all Billing & Invoice records'
      : scope === 'inventory' ? 'all Inventory & Products'
      : scope === 'customers' ? 'all Customers/Clients'
      : 'ALL data (billing, inventory, customers)'

    const first = await useDialogStore.getState().show(`⚠️ Warning: This will permanently delete ${scopeLabel}.\n\nThis action CANNOT be undone. Are you sure?`, true, 'Danger Zone Warning')
    if (!first) return

    const second = await useDialogStore.getState().show(`🚨 Final confirmation: Permanently delete ${scopeLabel}?\n\nClick OK to proceed to text confirmation.`, true, 'Final Confirmation')
    if (!second) return

    const typed = await useDialogStore.getState().prompt(`Type DELETE (all caps) to confirm permanent deletion of ${scopeLabel}:`, 'DELETE', 'Confirm Action')
    if (typed?.trim() !== 'DELETE') {
      setCleanupMsg({ type: 'error', text: 'Cleanup cancelled — confirmation text did not match.' })
      return
    }

    setCleanupLoading(true)
    setCleanupMsg({ type: '', text: '' })
    try {
      const res = await fetch('/api/admin/cleanup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope }) })
      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || `Server returned code ${res.status}`)
      }
      setCleanupMsg({ type: 'success', text: `✓ Successfully deleted ${scopeLabel}. Reloading app...` })
      await load()
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err: any) {
      setCleanupMsg({ type: 'error', text: err?.message || 'Cleanup failed.' })
    } finally {
      setCleanupLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div>
            <h2 className="section-title text-xl flex items-center gap-2">
              <Building2 size={20} className="text-brand-400" /> Settings & Administration
            </h2>
            <p className="text-xs text-gray-400">Manage multi-seller GST profiles, bank accounts, POS preferences and data backups</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        </div>

        {/* Global Toast Notification */}
        {msg && (
          <div className="mb-4 px-3.5 py-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <Check size={14} /> {msg}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex gap-1 mb-5 bg-white/5 p-1 rounded-xl">
          {[
            { id: 'profiles', label: '🏢 Seller Profiles' },
            { id: 'bank', label: '🏦 Bank Accounts' },
            { id: 'upi', label: '📱 UPI Accounts' },
            { id: 'store', label: '⚙️ Store & POS' },
            { id: 'admin', label: '🛡️ Resiliency' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id as TabType)
                setProfileMode('list')
                setBankMode('list')
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                tab === t.id
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: SELLER GST PROFILES                                          */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {tab === 'profiles' && (
          <div className="space-y-4">
            {profileMode === 'list' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Configured Seller GST Profiles ({profiles.length})
                  </span>
                  <button onClick={startCreateProfile} className="btn-primary text-xs py-1.5 px-3">
                    <Plus size={14} /> Add Seller Profile
                  </button>
                </div>

                <div className="space-y-3">
                  {profiles.map(p => (
                    <div
                      key={p.id}
                      className={`p-4 rounded-xl border transition-all ${
                        p.is_default
                          ? 'border-brand-500/60 bg-brand-600/10 shadow-sm'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-white">{p.business_name}</h3>
                            {p.trade_name && (
                              <span className="text-xs text-gray-400">({p.trade_name})</span>
                            )}
                            {p.is_default ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-500/40">
                                ★ Default Seller
                              </span>
                            ) : (
                              <button
                                onClick={() => setDefaultProfile(p)}
                                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
                              >
                                <Star size={12} /> Set as Default
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                            <span className="font-mono text-brand-300">GSTIN: {p.gstin}</span>
                            {p.pan && <span>PAN: <span className="font-mono text-gray-300">{p.pan}</span></span>}
                            <span>📞 {p.phone}</span>
                            {p.email && <span>✉️ {p.email}</span>}
                          </div>

                          <p className="text-xs text-gray-400">
                            📍 {p.address_line1}, {p.address_line2 ? `${p.address_line2}, ` : ''}{p.city} - {p.pincode} (State {p.state_code})
                          </p>

                          <div className="flex items-center gap-4 text-[11px] text-gray-400 pt-1 flex-wrap">
                            {p.bank_name ? (
                              <span className="text-emerald-400">
                                🏦 {p.bank_name} ({p.bank_account_no})
                              </span>
                            ) : (
                              <span className="text-gray-500">🏦 No Bank Linked</span>
                            )}
                            {p.active_upi_id ? (
                              <span className="text-sky-400">
                                📱 UPI: {p.active_upi_id}
                              </span>
                            ) : (
                              <span className="text-gray-500">📱 No UPI Linked</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => startEditProfile(p)}
                            className="btn-ghost p-1.5 text-brand-300 hover:text-white"
                            title="Edit Profile"
                          >
                            <Edit3 size={15} />
                          </button>
                          {profiles.length > 1 && (
                            <button
                              onClick={() => deleteProfile(p)}
                              className="btn-ghost p-1.5 text-red-400 hover:bg-red-500/20"
                              title="Delete Profile"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {(profileMode === 'create' || profileMode === 'edit') && (
              <form onSubmit={saveProfile} className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setProfileMode('list')}
                      className="btn-ghost p-1 text-gray-400"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <h3 className="text-sm font-bold text-white">
                      {profileMode === 'create' ? 'Add New Seller GST Profile' : 'Edit Seller GST Profile'}
                    </h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-brand-300">
                    <input
                      type="checkbox"
                      checked={profileForm.is_default}
                      onChange={e => setProfileForm(f => ({ ...f, is_default: e.target.checked }))}
                      className="accent-brand-500 rounded"
                    />
                    Default Profile for Billing
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="label">Business Name *</label>
                    <input
                      className="input"
                      placeholder="e.g. Acme Enterprise Pvt Ltd"
                      value={profileForm.business_name}
                      onChange={e => setProfileForm(f => ({ ...f, business_name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="label">Trade Name / Brand (Optional)</label>
                    <input
                      className="input"
                      placeholder="e.g. Acme Retail"
                      value={profileForm.trade_name}
                      onChange={e => setProfileForm(f => ({ ...f, trade_name: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="label">GSTIN * (15 Characters)</label>
                    <input
                      className="input uppercase font-mono"
                      placeholder="36AAAAA0000A1Z5"
                      maxLength={15}
                      value={profileForm.gstin}
                      onChange={e => handleGstinChange(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">PAN Number</label>
                    <input
                      className="input uppercase font-mono"
                      placeholder="AAAAA0000A"
                      maxLength={10}
                      value={profileForm.pan}
                      onChange={e => setProfileForm(f => ({ ...f, pan: e.target.value.toUpperCase() }))}
                    />
                  </div>

                  <div>
                    <label className="label">Phone Number *</label>
                    <input
                      className="input"
                      placeholder="9876543210"
                      value={profileForm.phone}
                      onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Email Address</label>
                    <input
                      className="input"
                      type="email"
                      placeholder="contact@acme.com"
                      value={profileForm.email}
                      onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="label">Address Line 1 *</label>
                    <input
                      className="input"
                      placeholder="Shop No, Building Name, Street"
                      value={profileForm.address_line1}
                      onChange={e => setProfileForm(f => ({ ...f, address_line1: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Address Line 2</label>
                    <input
                      className="input"
                      placeholder="Area, Landmark"
                      value={profileForm.address_line2}
                      onChange={e => setProfileForm(f => ({ ...f, address_line2: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">City *</label>
                    <input
                      className="input"
                      placeholder="Hyderabad"
                      value={profileForm.city}
                      onChange={e => setProfileForm(f => ({ ...f, city: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">State *</label>
                    <select
                      className="input"
                      value={profileForm.state_code}
                      onChange={e => setProfileForm(f => ({ ...f, state_code: e.target.value }))}
                    >
                      {Object.entries(INDIAN_STATES).map(([code, name]) => (
                        <option key={code} value={code}>{code} — {name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Pincode *</label>
                    <input
                      className="input font-mono"
                      placeholder="500001"
                      maxLength={6}
                      value={profileForm.pincode}
                      onChange={e => setProfileForm(f => ({ ...f, pincode: e.target.value }))}
                      required
                    />
                  </div>

                  {/* Profile Bank & UPI Linkage */}
                  <div>
                    <label className="label">Linked Bank Account</label>
                    <select
                      className="input"
                      value={profileForm.bank_account_id}
                      onChange={e => setProfileForm(f => ({ ...f, bank_account_id: e.target.value }))}
                    >
                      <option value="">None (No bank details printed)</option>
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name} - {b.account_number} {b.is_default ? '(Default Bank)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Default UPI for Scan to Pay</label>
                    <select
                      className="input"
                      value={profileForm.active_upi_id}
                      onChange={e => setProfileForm(f => ({ ...f, active_upi_id: e.target.value }))}
                    >
                      <option value="">None (Use store default)</option>
                      {upiAccounts.map(u => (
                        <option key={u.id} value={u.upi_id}>
                          {u.label} ({u.upi_id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary flex-1 justify-center py-2.5"
                  >
                    <Save size={16} /> {loading ? 'Saving…' : profileMode === 'create' ? 'Create Profile' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileMode('list')}
                    className="btn-ghost py-2.5 px-4"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: BANK ACCOUNTS                                                */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {tab === 'bank' && (
          <div className="space-y-4">
            {bankMode === 'list' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Saved Bank Accounts ({bankAccounts.length})
                  </span>
                  <button onClick={startCreateBank} className="btn-primary text-xs py-1.5 px-3">
                    <Plus size={14} /> Add Bank Account
                  </button>
                </div>

                {bankAccounts.length === 0 ? (
                  <div className="p-8 text-center bg-white/5 border border-white/10 rounded-xl space-y-2">
                    <Landmark size={28} className="mx-auto text-gray-500" />
                    <p className="text-sm text-gray-300 font-medium">No Bank Accounts Saved</p>
                    <p className="text-xs text-gray-500">Add bank accounts to easily link them to your Seller GST profiles.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bankAccounts.map(b => (
                      <div
                        key={b.id}
                        className={`p-4 rounded-xl border transition-all ${
                          b.is_default
                            ? 'border-emerald-500/50 bg-emerald-600/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-bold text-white">{b.bank_name}</h3>
                              {b.is_default ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  ★ Default
                                </span>
                              ) : (
                                <button
                                  onClick={() => setDefaultBank(b)}
                                  className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
                                >
                                  <Star size={12} /> Set as Default
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                              <span>A/C No: <strong className="font-mono text-white">{b.account_number}</strong></span>
                              <span>IFSC: <strong className="font-mono text-brand-300">{b.ifsc_code}</strong></span>
                              {b.branch_name && <span>Branch: {b.branch_name}</span>}
                            </div>
                            {b.account_holder && (
                              <p className="text-xs text-gray-400">A/C Holder: {b.account_holder}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => startEditBank(b)}
                              className="btn-ghost p-1.5 text-brand-300 hover:text-white"
                              title="Edit Bank"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => deleteBank(b)}
                              className="btn-ghost p-1.5 text-red-400 hover:bg-red-500/20"
                              title="Delete Bank"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {(bankMode === 'create' || bankMode === 'edit') && (
              <form onSubmit={saveBank} className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBankMode('list')}
                      className="btn-ghost p-1 text-gray-400"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <h3 className="text-sm font-bold text-white">
                      {bankMode === 'create' ? 'Add Saved Bank Account' : 'Edit Bank Account'}
                    </h3>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-brand-300">
                    <input
                      type="checkbox"
                      checked={bankForm.is_default}
                      onChange={e => setBankForm(f => ({ ...f, is_default: e.target.checked }))}
                      className="accent-brand-500 rounded"
                    />
                    Set as Default Bank
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="label">Bank Name *</label>
                    <input
                      className="input"
                      placeholder="e.g. HDFC Bank"
                      value={bankForm.bank_name}
                      onChange={e => setBankForm(f => ({ ...f, bank_name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="label">Account Number *</label>
                    <input
                      className="input font-mono"
                      placeholder="50100012345678"
                      value={bankForm.account_number}
                      onChange={e => setBankForm(f => ({ ...f, account_number: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">IFSC Code *</label>
                    <input
                      className="input uppercase font-mono"
                      placeholder="HDFC0001234"
                      value={bankForm.ifsc_code}
                      onChange={e => setBankForm(f => ({ ...f, ifsc_code: e.target.value.toUpperCase() }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Branch Name</label>
                    <input
                      className="input"
                      placeholder="Main Branch"
                      value={bankForm.branch_name}
                      onChange={e => setBankForm(f => ({ ...f, branch_name: e.target.value }))}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="label">Account Holder Name</label>
                    <input
                      className="input"
                      placeholder="As per bank passbook"
                      value={bankForm.account_holder}
                      onChange={e => setBankForm(f => ({ ...f, account_holder: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary flex-1 justify-center py-2.5"
                  >
                    <Save size={16} /> {loading ? 'Saving…' : bankMode === 'create' ? 'Add Bank Account' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBankMode('list')}
                    className="btn-ghost py-2.5 px-4"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: UPI ACCOUNTS                                                 */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {tab === 'upi' && (
          <div className="space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Configured UPI Accounts ({upiAccounts.length})
            </span>

            {upiAccounts.length === 0 && (
              <p className="text-sm text-gray-500">No UPI accounts added yet.</p>
            )}

            <div className="space-y-2">
              {upiAccounts.map(acc => (
                <div
                  key={acc.id}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                    acc.is_default
                      ? 'border-brand-500/50 bg-brand-600/10'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div>
                    <p className="font-medium text-gray-200">
                      {acc.label} {acc.is_default && <span className="text-xs text-brand-400 ml-1">★ Default</span>}
                    </p>
                    <p className="text-sm text-brand-300 font-mono">{acc.upi_id}</p>
                    <p className="text-xs text-gray-500">{acc.payee_name}</p>
                  </div>
                  <div className="flex gap-1">
                    {!acc.is_default && (
                      <button
                        type="button"
                        onClick={(e) => setDefaultUpi(acc, e)}
                        className="btn-ghost p-1.5 text-amber-400"
                        title="Set Default for Scan to Pay"
                      >
                        <Star size={14} /> Set Default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => deleteUpi(acc.id, e)}
                      className="btn-ghost p-1.5 text-red-400 hover:bg-red-500/20"
                      title="Delete UPI Account"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="glass-card p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-300">Add New UPI Account</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">UPI ID *</label>
                  <input
                    className="input"
                    value={upiForm.upi_id}
                    onChange={e => setUpiForm(u => ({ ...u, upi_id: e.target.value }))}
                    placeholder="merchant@upi"
                  />
                </div>
                <div>
                  <label className="label">Payee Name *</label>
                  <input
                    className="input"
                    value={upiForm.payee_name}
                    onChange={e => setUpiForm(u => ({ ...u, payee_name: e.target.value }))}
                    placeholder="Business Name"
                  />
                </div>
                <div>
                  <label className="label">Label *</label>
                  <input
                    className="input"
                    value={upiForm.label}
                    onChange={e => setUpiForm(u => ({ ...u, label: e.target.value }))}
                    placeholder="GPay / PhonePe"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={upiForm.is_default}
                      onChange={e => setUpiForm(u => ({ ...u, is_default: e.target.checked }))}
                      className="w-4 h-4 rounded accent-brand-500"
                    />
                    <span className="text-sm text-gray-300">Set as Default Scan to Pay</span>
                  </label>
                </div>
              </div>
              <button onClick={addUpi} className="btn-primary text-xs py-2">
                <Plus size={15} /> Add UPI Account
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 4: STORE PREFERENCES & POS SETTINGS                             */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {tab === 'store' && storeSettings && (
          <div className="space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Global Store & POS Billing Preferences
            </span>

            {/* Scan to Pay Toggle */}
            <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <QrCode size={18} className="text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-gray-200">Scan to Pay QR Code</p>
                  <p className="text-xs text-gray-400">Prints dynamic UPI QR code on generated invoices</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={storeSettings.enable_scan_to_pay !== 0 && storeSettings.enable_scan_to_pay !== false}
                  onChange={e => setStoreSettings((s: any) => ({ ...s, enable_scan_to_pay: e.target.checked ? 1 : 0 }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>

            {/* POS Purchase Price Toggle */}
            <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-gray-200">Show Purchase Price in POS Billing</p>
                  <p className="text-xs text-gray-400">Displays purchase price column in POS billing table (hidden on customer invoices)</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!storeSettings.show_purchase_price_in_pos}
                  onChange={e => setStoreSettings((s: any) => ({ ...s, show_purchase_price_in_pos: e.target.checked ? 1 : 0 }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>

            {/* POS Profit / Loss Estimate Toggle */}
            <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-gray-200">Show Profit / Loss Estimate in POS Billing</p>
                  <p className="text-xs text-gray-400">Shows bill profit margin in POS checkout summary (hidden on customer invoices)</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={storeSettings.show_profit_loss_in_pos !== 0 && storeSettings.show_profit_loss_in_pos !== false}
                  onChange={e => setStoreSettings((s: any) => ({ ...s, show_profit_loss_in_pos: e.target.checked ? 1 : 0 }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>

            {/* Records History Profit Toggle */}
            <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp size={18} className="text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-gray-200">Show Profit in Records History</p>
                  <p className="text-xs text-gray-400">Display Profit column in Records list showing realized profit for invoices</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={storeSettings.show_profit_in_records !== 0 && storeSettings.show_profit_in_records !== false}
                  onChange={e => setStoreSettings((s: any) => ({ ...s, show_profit_in_records: e.target.checked ? 1 : 0 }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>

            {/* Restrict sale quantity to stock quantity toggle */}
            <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle size={18} className="text-red-400" />
                <div>
                  <p className="text-sm font-medium text-gray-200">Restrict Sales to Available Stock</p>
                  <p className="text-xs text-gray-400">Do not allow POS bill quantity to exceed the product's available stock inventory</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={storeSettings.restrict_sales_to_stock_qty !== 0 && storeSettings.restrict_sales_to_stock_qty !== false}
                  onChange={e => setStoreSettings((s: any) => ({ ...s, restrict_sales_to_stock_qty: e.target.checked ? 1 : 0 }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>

            {/* Terms & Conditions */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="label">Default Invoice Terms & Conditions (One clause per line)</label>
                <textarea
                  className="input h-20 resize-none font-sans text-xs leading-relaxed"
                  value={(() => {
                    try {
                      const parsed = typeof storeSettings.invoice_terms === 'string' ? JSON.parse(storeSettings.invoice_terms) : storeSettings.invoice_terms
                      return Array.isArray(parsed) ? parsed.join('\n') : (storeSettings.invoice_terms || '')
                    } catch {
                      return storeSettings.invoice_terms || ''
                    }
                  })()}
                  onChange={e => {
                    const lines = e.target.value.split('\n')
                    setStoreSettings((s: any) => ({ ...s, invoice_terms: JSON.stringify(lines) }))
                  }}
                  placeholder={"Goods once sold can't be returned\nGoods can be exchanged with valid bill within 7 days of purchase"}
                />
              </div>

              <div>
                <label className="label">Default Quotation Terms & Conditions (One clause per line)</label>
                <textarea
                  className="input h-16 resize-none font-sans text-xs leading-relaxed"
                  value={(() => {
                    try {
                      const parsed = typeof storeSettings.quotation_terms === 'string' ? JSON.parse(storeSettings.quotation_terms) : storeSettings.quotation_terms
                      return Array.isArray(parsed) ? parsed.join('\n') : (storeSettings.quotation_terms || '')
                    } catch {
                      return storeSettings.quotation_terms || ''
                    }
                  })()}
                  onChange={e => {
                    const lines = e.target.value.split('\n')
                    setStoreSettings((s: any) => ({ ...s, quotation_terms: JSON.stringify(lines) }))
                  }}
                  placeholder="Quotation valid for 3 days only"
                />
              </div>
            </div>

            <button
              onClick={saveStorePreferences}
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5"
            >
              <Save size={16} /> {loading ? 'Saving…' : 'Save Store Preferences'}
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 5: ADMIN & DATA RESILIENCY                                      */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {tab === 'admin' && (
          <div className="space-y-5">
            {/* Health & WAL Resiliency Status */}
            <div className="p-4 bg-emerald-600/10 border border-emerald-500/30 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={20} className="text-emerald-400" />
                  <div>
                    <p className="text-sm font-bold text-white">Database Resiliency & Health</p>
                    <p className="text-xs text-emerald-300">WAL Mode Active · Auto Checkpointing Enabled</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-bold">
                  ● Resilient
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <div className="p-2.5 bg-black/20 rounded-lg">
                  <span className="text-gray-400 block">Invoices</span>
                  <strong className="text-base text-white">{systemInfo?.counts?.invoices || 0}</strong>
                </div>
                <div className="p-2.5 bg-black/20 rounded-lg">
                  <span className="text-gray-400 block">Products</span>
                  <strong className="text-base text-white">{systemInfo?.counts?.products || 0}</strong>
                </div>
                <div className="p-2.5 bg-black/20 rounded-lg">
                  <span className="text-gray-400 block">Customers</span>
                  <strong className="text-base text-white">{systemInfo?.counts?.customers || 0}</strong>
                </div>
                <div className="p-2.5 bg-black/20 rounded-lg">
                  <span className="text-gray-400 block">DB Size</span>
                  <strong className="text-base text-white">{systemInfo?.dbSizeMb || 0} MB</strong>
                </div>
              </div>

              <div className="text-[11px] text-gray-400 font-mono truncate">
                Location: {systemInfo?.dbPath || 'AppData/ApexBill/billing_app.db'}
              </div>
            </div>

            {/* Backup & Restore Action Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1-Click Backup Export */}
              <div className="glass-card p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Download size={16} className="text-brand-400" />
                    <h3 className="text-sm font-bold text-white">Full System Backup</h3>
                  </div>
                  <p className="text-xs text-gray-400">
                    Export complete database (invoices, inventory, seller profiles, settings, customers) as a standalone JSON backup file.
                  </p>
                </div>
                <button
                  onClick={handleExportBackup}
                  className="btn-primary w-full justify-center text-xs py-2.5"
                >
                  <Download size={14} /> Export Backup (.json)
                </button>
              </div>

              {/* Instant DB Snapshot */}
              <div className="glass-card p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Camera size={16} className="text-amber-400" />
                    <h3 className="text-sm font-bold text-white">Instant DB Snapshot</h3>
                  </div>
                  <p className="text-xs text-gray-400">
                    Create an immediate redundant copy of SQLite database file in AppData backup directory.
                  </p>
                </div>
                <button
                  onClick={handleCreateSnapshot}
                  className="btn-secondary w-full justify-center text-xs py-2.5 !bg-amber-500/20 !text-amber-300 border border-amber-500/40 hover:!bg-amber-500/30"
                >
                  <Camera size={14} /> Create Snapshot Copy
                </button>
              </div>
            </div>

            {/* Restore Section */}
            <div className="glass-card p-5 space-y-3 border-brand-500/20">
              <div className="flex items-center gap-2">
                <Upload size={18} className="text-brand-400" />
                <h3 className="text-sm font-bold text-white">Restore Data & Configuration</h3>
              </div>
              <p className="text-xs text-gray-400">
                Upload a previously saved <code className="text-brand-300 bg-black/30 px-1 py-0.5 rounded">ApexBill_Full_Backup_*.json</code> file to restore all system records.
              </p>

              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="block w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20"
                />
                {selectedBackupFile && (
                  <button
                    onClick={handleRestore}
                    disabled={loading}
                    className="btn-primary flex-shrink-0 text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-500"
                  >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    {loading ? 'Restoring…' : 'Restore Now'}
                  </button>
                )}
              </div>

              {restoreMsg.text && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  restoreMsg.type === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                  restoreMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                }`}>
                  {restoreMsg.type === 'error' && <AlertTriangle size={14} />}
                  <span>{restoreMsg.text}</span>
                </div>
              )}
            </div>

            {/* Snapshot History */}
            {systemInfo?.snapshots?.length > 0 && (
              <div className="glass-card p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent Backup Snapshots</p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {systemInfo.snapshots.map((s: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 px-3 bg-white/5 rounded-lg text-xs">
                      <div className="flex items-center gap-2">
                        <FileText size={13} className="text-gray-400" />
                        <span className="font-mono text-gray-300">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-500">
                        <span>{s.sizeMb} MB</span>
                        <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Danger Zone */}
            <div className="p-4 bg-red-900/20 border border-red-500/40 rounded-xl space-y-4">
              <div className="flex items-center gap-2">
                <AlertOctagon size={18} className="text-red-400" />
                <div>
                  <p className="text-sm font-bold text-red-300">Danger Zone — Delete Data</p>
                  <p className="text-xs text-red-400/70">Permanently removes records. Seller profiles & settings are always preserved.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  onClick={() => handleCleanup('billing')}
                  disabled={cleanupLoading}
                  className="flex flex-col items-start gap-1 p-3 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors text-left"
                >
                  <span className="text-xs font-bold text-red-300">Clear Billing Data</span>
                  <span className="text-[11px] text-red-400/70">Delete all invoices, quotations & memory slots</span>
                </button>

                <button
                  onClick={() => handleCleanup('inventory')}
                  disabled={cleanupLoading}
                  className="flex flex-col items-start gap-1 p-3 rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 transition-colors text-left"
                >
                  <span className="text-xs font-bold text-orange-300">Clear Inventory</span>
                  <span className="text-[11px] text-orange-400/70">Delete all products from inventory</span>
                </button>

                <button
                  onClick={() => handleCleanup('customers')}
                  disabled={cleanupLoading}
                  className="flex flex-col items-start gap-1 p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors text-left"
                >
                  <span className="text-xs font-bold text-yellow-300">Clear Customers</span>
                  <span className="text-[11px] text-yellow-400/70">Delete all registered customer/client profiles</span>
                </button>

                <button
                  onClick={() => handleCleanup('all')}
                  disabled={cleanupLoading}
                  className="flex flex-col items-start gap-1 p-3 rounded-xl border border-red-600/50 bg-red-600/15 hover:bg-red-600/25 transition-colors text-left"
                >
                  <span className="text-xs font-bold text-red-200">⚠ Wipe All Data</span>
                  <span className="text-[11px] text-red-400/70">Delete billing, inventory & customers</span>
                </button>
              </div>

              {cleanupMsg.text && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  cleanupMsg.type === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                  'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {cleanupMsg.type === 'error' && <AlertTriangle size={14} />}
                  <span>{cleanupMsg.text}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
