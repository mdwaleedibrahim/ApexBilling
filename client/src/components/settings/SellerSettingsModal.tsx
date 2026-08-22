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

  const addUpi = async () => {
    if (!upiForm.upi_id || !upiForm.payee_name || !upiForm.label) return
    await api.settings.addUpi(upiForm)
    setUpiForm({ upi_id: '', payee_name: '', label: '', is_default: false })
    load()
  }

  const deleteUpi = async (id: string) => {
    await api.settings.deleteUpi(id)
    load()
  }

  const setDefault = async (acc: any) => {
    await api.settings.updateUpi(acc.id, { ...acc, is_default: true })
    load()
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

            {/* Configurable Scan to Pay UPI Selector */}
            <div className="p-3 bg-brand-600/10 border border-brand-500/30 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <QrCode size={16} className="text-brand-400" />
                <span className="text-xs font-semibold text-brand-300 uppercase tracking-wider">Scan to Pay UPI Configuration</span>
              </div>
              <div>
                <label className="label">Active Scan to Pay UPI ID</label>
                {upiAccounts.length > 0 ? (
                  <select className="input" value={profile.active_upi_id || ''} onChange={e => fp('active_upi_id', e.target.value)}>
                    <option value="">-- Select Saved UPI ID --</option>
                    {upiAccounts.map(a => (
                      <option key={a.id} value={a.upi_id}>{a.label} ({a.upi_id}) {a.is_default ? '★ Default' : ''}</option>
                    ))}
                  </select>
                ) : (
                  <input className="input" placeholder="e.g. merchant@upi" value={profile.active_upi_id || ''} onChange={e => fp('active_upi_id', e.target.value)} />
                )}
              </div>
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
                    <button onClick={() => setDefault(acc)} className="btn-ghost p-1.5 text-amber-400" title="Set Default for Scan to Pay">
                      <Star size={14} /> Set Default
                    </button>
                  )}
                  <button onClick={() => deleteUpi(acc.id)} className="btn-ghost p-1.5 text-red-400"><Trash2 size={14} /></button>
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
