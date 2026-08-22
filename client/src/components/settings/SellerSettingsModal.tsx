// components/settings/SellerSettingsModal.tsx
import { useEffect, useState } from 'react'
import { X, Save, Plus, Trash2, Star, QrCode } from 'lucide-react'
import { api } from '../../utils/api'
import { INDIAN_STATES } from '../../utils/gstEngine'

export default function SellerSettingsModal({ onClose }: { onClose: () => void }) {
  const [profile, setProfile] = useState<any>(null)
  const [upiAccounts, setUpiAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'profile' | 'upi'>('profile')
  const [upiForm, setUpiForm] = useState({ upi_id: '', payee_name: '', label: '', is_default: false })
  const [msg, setMsg] = useState('')

  const load = async () => {
    const r = await api.settings.getProfile()
    setProfile(r.profile); setUpiAccounts(r.upiAccounts)
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

  const fp = (k: string, v: any) => setProfile((p: any) => ({ ...p, [k]: v }))

  if (!profile) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="section-title text-xl">Settings</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-white/5 p-1 rounded-xl">
          {(['profile', 'upi'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all capitalize
                ${tab === t ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
              {t === 'profile' ? '🏢 Business Profile' : '📱 UPI Accounts'}
            </button>
          ))}
        </div>

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

        {tab === 'upi' && (
          <div className="space-y-4">
            {/* Existing accounts */}
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

            {/* Add new UPI */}
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
      </div>
    </div>
  )
}
