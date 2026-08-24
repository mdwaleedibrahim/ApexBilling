// components/settings/SellerSettingsModal.tsx — Settings & Admin System Maintenance
import { useEffect, useState } from 'react'
import {
  X, Save, Plus, Trash2, Star, QrCode, ShieldCheck, Database,
  Download, Upload, Camera, RefreshCw, AlertTriangle, FileText
} from 'lucide-react'
import { api } from '../../utils/api'
import { INDIAN_STATES } from '../../utils/gstEngine'

export default function SellerSettingsModal({ onClose }: { onClose: () => void }) {
  const [profile, setProfile] = useState<any>(null)
  const [upiAccounts, setUpiAccounts] = useState<any[]>([])
  const [systemInfo, setSystemInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'profile' | 'upi' | 'admin'>('profile')
  const [upiForm, setUpiForm] = useState({ upi_id: '', payee_name: '', label: '', is_default: false })
  const [msg, setMsg] = useState('')
  const [restoreMsg, setRestoreMsg] = useState({ type: '', text: '' })
  const [selectedBackupFile, setSelectedBackupFile] = useState<any>(null)

  const load = async () => {
    const [r, sys] = await Promise.all([
      api.settings.getProfile(),
      api.admin.getSystemInfo().catch(() => null)
    ])
    setProfile(r.profile)
    setUpiAccounts(r.upiAccounts || [])
    setSystemInfo(sys)
  }

  useEffect(() => { load() }, [])

  const saveProfile = async () => {
    setLoading(true)
    try {
      await api.settings.updateProfile(profile)
      setMsg('Profile saved!')
      setTimeout(() => setMsg(''), 2500)
    } finally {
      setLoading(false)
    }
  }

  const addUpi = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!upiForm.upi_id || !upiForm.payee_name || !upiForm.label) return
    try {
      await api.settings.addUpi(upiForm)
      setUpiForm({ upi_id: '', payee_name: '', label: '', is_default: false })
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
      const r = await api.settings.getProfile()
      setProfile(r.profile)
      setUpiAccounts(r.upiAccounts || [])
    } catch (err) {
      console.error('Error deleting UPI account:', err)
      await load()
    }
  }

  const setDefault = async (acc: any, e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation() }
    try {
      await api.settings.updateUpi(acc.id, { ...acc, is_default: true })
      await load()
    } catch (err) {
      console.error('Error setting default UPI account:', err)
    }
  }

  // 1-Click Full System Backup Export
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

  // Handle Backup File Select
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

  // 1-Click Restore
  const handleRestore = async () => {
    if (!selectedBackupFile) return
    if (!window.confirm('WARNING: Restoring will replace current database records with the backup data. Continue?')) return
    setLoading(true)
    try {
      await api.admin.restoreBackup(selectedBackupFile)
      setRestoreMsg({ type: 'success', text: 'System successfully restored from backup!' })
      setSelectedBackupFile(null)
      await load()
    } catch (err: any) {
      setRestoreMsg({ type: 'error', text: err?.message || 'Restore failed' })
    } finally {
      setLoading(false)
    }
  }

  // Create Snapshot Copy
  const handleCreateSnapshot = async () => {
    try {
      const res = await api.admin.createSnapshot()
      setRestoreMsg({ type: 'success', text: `Snapshot created: ${res.snapshot}` })
      await load()
    } catch (err: any) {
      setRestoreMsg({ type: 'error', text: 'Snapshot creation failed' })
    }
  }

  const fp = (k: string, v: any) => setProfile((p: any) => ({ ...p, [k]: v }))

  if (!profile) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="section-title text-xl">Settings & Administration</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>

        {/* Tabs Header */}
        <div className="flex gap-1 mb-5 bg-white/5 p-1 rounded-xl">
          {(['profile', 'upi', 'admin'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all capitalize
                ${tab === t ? 'bg-brand-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'}`}>
              {t === 'profile' ? '🏢 Business Profile' : t === 'upi' ? '📱 UPI Accounts' : '⚙️ Admin & Resiliency'}
            </button>
          ))}
        </div>

        {/* Tab 1: Profile */}
        {tab === 'profile' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Business Name *</label><input className="input" value={profile.business_name || ''} onChange={e => fp('business_name', e.target.value)} /></div>
              <div><label className="label">Trade Name</label><input className="input" value={profile.trade_name || ''} onChange={e => fp('trade_name', e.target.value)} /></div>
              <div><label className="label">GSTIN *</label><input className="input" value={profile.gstin || ''} onChange={e => fp('gstin', e.target.value)} /></div>
              <div><label className="label">PAN</label><input className="input" value={profile.pan || ''} onChange={e => fp('pan', e.target.value)} /></div>
              <div><label className="label">Phone *</label><input className="input" value={profile.phone || ''} onChange={e => fp('phone', e.target.value)} /></div>
              <div><label className="label">Email</label><input className="input" value={profile.email || ''} onChange={e => fp('email', e.target.value)} /></div>
              <div><label className="label">State</label>
                <select className="input" value={profile.state_code || '36'} onChange={e => fp('state_code', e.target.value)}>
                  {Object.entries(INDIAN_STATES).map(([c, n]) => <option key={c} value={c}>{c} — {n}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className="label">Address Line 1</label><input className="input" value={profile.address_line1 || ''} onChange={e => fp('address_line1', e.target.value)} /></div>
              <div><label className="label">Address Line 2</label><input className="input" value={profile.address_line2 || ''} onChange={e => fp('address_line2', e.target.value)} /></div>
              <div><label className="label">City</label><input className="input" value={profile.city || ''} onChange={e => fp('city', e.target.value)} /></div>
              <div><label className="label">Pincode</label><input className="input" value={profile.pincode || ''} onChange={e => fp('pincode', e.target.value)} /></div>
            </div>

            {/* Scan to Pay Toggle */}
            <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <QrCode size={18} className="text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-gray-200">Scan to Pay QR Code</p>
                  <p className="text-xs text-gray-400">Uses default account configured in the UPI Accounts tab</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={profile.enable_scan_to_pay !== 0 && profile.enable_scan_to_pay !== false}
                  onChange={e => fp('enable_scan_to_pay', e.target.checked ? 1 : 0)}
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
                  checked={!!profile.show_purchase_price_in_pos}
                  onChange={e => fp('show_purchase_price_in_pos', e.target.checked ? 1 : 0)}
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
                  checked={profile.show_profit_loss_in_pos !== 0 && profile.show_profit_loss_in_pos !== false}
                  onChange={e => fp('show_profit_loss_in_pos', e.target.checked ? 1 : 0)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>

            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Bank Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Bank Name</label><input className="input" value={profile.bank_name || ''} onChange={e => fp('bank_name', e.target.value)} /></div>
              <div><label className="label">Account No.</label><input className="input" value={profile.bank_account_no || ''} onChange={e => fp('bank_account_no', e.target.value)} /></div>
              <div><label className="label">IFSC</label><input className="input" value={profile.bank_ifsc || ''} onChange={e => fp('bank_ifsc', e.target.value)} /></div>
              <div><label className="label">Branch</label><input className="input" value={profile.bank_branch || ''} onChange={e => fp('bank_branch', e.target.value)} /></div>
            </div>

            {msg && <p className="text-emerald-400 text-sm">{msg}</p>}
            <button onClick={saveProfile} disabled={loading} className="btn-primary w-full justify-center py-2.5">
              <Save size={16} />{loading ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        )}

        {/* Tab 2: UPI */}
        {tab === 'upi' && (
          <div className="space-y-4">
            {upiAccounts.length === 0 && <p className="text-sm text-gray-500">No UPI accounts added yet.</p>}
            {upiAccounts.map(acc => (
              <div key={acc.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${acc.is_default ? 'border-brand-500/50 bg-brand-600/10' : 'border-white/10 bg-white/5'}`}>
                <div>
                  <p className="font-medium text-gray-200">{acc.label} {acc.is_default && <span className="text-xs text-brand-400 ml-1">★ Default</span>}</p>
                  <p className="text-sm text-brand-300">{acc.upi_id}</p>
                  <p className="text-xs text-gray-500">{acc.payee_name}</p>
                </div>
                <div className="flex gap-1">
                  {!acc.is_default && (
                    <button type="button" onClick={(e) => setDefault(acc, e)} className="btn-ghost p-1.5 text-amber-400" title="Set Default for Scan to Pay">
                      <Star size={14} /> Set Default
                    </button>
                  )}
                  <button type="button" onClick={(e) => deleteUpi(acc.id, e)} className="btn-ghost p-1.5 text-red-400 hover:bg-red-500/20" title="Delete UPI Account">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            <div className="glass-card p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-300">Add New UPI Account</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">UPI ID *</label><input className="input" value={upiForm.upi_id} onChange={e => setUpiForm(u => ({ ...u, upi_id: e.target.value }))} placeholder="merchant@upi" /></div>
                <div><label className="label">Payee Name *</label><input className="input" value={upiForm.payee_name} onChange={e => setUpiForm(u => ({ ...u, payee_name: e.target.value }))} placeholder="Business Name" /></div>
                <div><label className="label">Label *</label><input className="input" value={upiForm.label} onChange={e => setUpiForm(u => ({ ...u, label: e.target.value }))} placeholder="GPay / PhonePe" /></div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={upiForm.is_default} onChange={e => setUpiForm(u => ({ ...u, is_default: e.target.checked }))} className="w-4 h-4 rounded accent-brand-500" />
                    <span className="text-sm text-gray-300">Set as Default Scan to Pay</span>
                  </label>
                </div>
              </div>
              <button onClick={addUpi} className="btn-primary"><Plus size={16} /> Add Account</button>
            </div>
          </div>
        )}

        {/* Tab 3: Admin System Maintenance & Data Resiliency */}
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
                    Export complete database (invoices, inventory, settings, customers) as a standalone JSON backup file.
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
          </div>
        )}
      </div>
    </div>
  )
}
