// components/billing/TermsAndConditionsCard.tsx — Select, edit, and persist Terms & Conditions
import { useState, useEffect } from 'react'
import { FileText, Edit3, Plus, Trash2, Save, X } from 'lucide-react'
import { useBillingStore } from '../../store/useBillingStore'
import { api } from '../../utils/api'

interface Props {
  sellerProfile: any
  onProfileUpdated?: (updatedProfile: any) => void
}

const DEFAULT_INVOICE_TERMS = [
  "Goods once sold can't be returned",
  "Goods can be exchanged with valid bill within 7 days of purchase"
]

const DEFAULT_QUOTATION_TERMS = [
  "Quotation valid for 3 days only"
]

export default function TermsAndConditionsCard({ sellerProfile, onProfileUpdated }: Props) {
  const { docType, selectedTerms, setSelectedTerms, editingDocId } = useBillingStore()
  const isInvoice = docType === 'INVOICE'

  const [isEditingMaster, setIsEditingMaster] = useState(false)
  const [editableTerms, setEditableTerms] = useState<string[]>([])
  const [newTermText, setNewTermText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Parse available terms for current mode from sellerProfile
  const getAvailableTerms = (): string[] => {
    try {
      if (isInvoice) {
        if (!sellerProfile?.invoice_terms) return DEFAULT_INVOICE_TERMS
        const parsed = typeof sellerProfile.invoice_terms === 'string'
          ? JSON.parse(sellerProfile.invoice_terms)
          : sellerProfile.invoice_terms
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_INVOICE_TERMS
      } else {
        if (!sellerProfile?.quotation_terms) return DEFAULT_QUOTATION_TERMS
        const parsed = typeof sellerProfile.quotation_terms === 'string'
          ? JSON.parse(sellerProfile.quotation_terms)
          : sellerProfile.quotation_terms
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_QUOTATION_TERMS
      }
    } catch {
      return isInvoice ? DEFAULT_INVOICE_TERMS : DEFAULT_QUOTATION_TERMS
    }
  }

  const availableTerms = getAvailableTerms()

  // Initialize selectedTerms when switching docType or loading if empty
  useEffect(() => {
    if (!editingDocId && selectedTerms.length === 0 && availableTerms.length > 0) {
      setSelectedTerms(availableTerms)
    }
  }, [docType, sellerProfile])

  const toggleTerm = (term: string) => {
    if (selectedTerms.includes(term)) {
      setSelectedTerms(selectedTerms.filter(t => t !== term))
    } else {
      setSelectedTerms([...selectedTerms, term])
    }
  }

  const selectAll = () => {
    setSelectedTerms(availableTerms)
  }

  const clearAll = () => {
    setSelectedTerms([])
  }

  const startEditingMaster = () => {
    setEditableTerms([...availableTerms])
    setIsEditingMaster(true)
    setNewTermText('')
  }

  const handleAddTerm = () => {
    if (!newTermText.trim()) return
    setEditableTerms([...editableTerms, newTermText.trim()])
    setNewTermText('')
  }

  const handleRemoveTerm = (index: number) => {
    setEditableTerms(editableTerms.filter((_, i) => i !== index))
  }

  const handleUpdateTerm = (index: number, val: string) => {
    const updated = [...editableTerms]
    updated[index] = val
    setEditableTerms(updated)
  }

  const saveMasterTerms = async () => {
    setSaving(true)
    try {
      const filtered = editableTerms.filter(t => t.trim().length > 0)
      const patch = isInvoice
        ? { invoice_terms: filtered }
        : { quotation_terms: filtered }

      const updated = await api.settings.updateProfile(patch)
      if (onProfileUpdated) onProfileUpdated(updated)

      // Also update selected terms with the active items
      setSelectedTerms(filtered)
      setIsEditingMaster(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (e) {
      console.error('Failed to save terms:', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-brand-400" />
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Terms & Conditions ({isInvoice ? 'Invoice' : 'Quotation'})
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          {!isEditingMaster ? (
            <>
              <button
                type="button"
                onClick={selectAll}
                className="text-[11px] text-brand-300 hover:text-brand-200 px-1.5 py-0.5"
                title="Select all terms"
              >
                Select All
              </button>
              <span className="text-gray-600 text-xs">·</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-[11px] text-gray-400 hover:text-gray-300 px-1.5 py-0.5"
                title="Clear all terms"
              >
                Clear
              </button>
              <span className="text-gray-600 text-xs">·</span>
              <button
                type="button"
                onClick={startEditingMaster}
                className="btn-ghost !px-2 !py-1 text-xs text-amber-300 hover:bg-amber-500/20 flex items-center gap-1 rounded-lg"
                title="Edit Master Terms"
              >
                <Edit3 size={12} /> Edit Terms
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingMaster(false)}
              className="btn-ghost !p-1 text-gray-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-2 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs">
          ✓ Terms & Conditions saved and persisted successfully!
        </div>
      )}

      {/* Mode 1: Select Checkbox Options for Bill */}
      {!isEditingMaster ? (
        <div className="space-y-2">
          {availableTerms.map((term, idx) => {
            const isSelected = selectedTerms.includes(term)
            return (
              <label
                key={idx}
                className={`flex items-start gap-2.5 p-2 rounded-xl border transition-colors cursor-pointer text-xs ${
                  isSelected
                    ? 'bg-brand-600/15 border-brand-500/40 text-gray-100'
                    : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleTerm(term)}
                  className="mt-0.5 w-3.5 h-3.5 rounded accent-brand-500 cursor-pointer flex-shrink-0"
                />
                <span className="leading-snug">{term}</span>
              </label>
            )
          })}
          <p className="text-[11px] text-gray-500 italic pt-1">
            Checked terms will be included at the end of the printed {isInvoice ? 'invoice' : 'quotation'}.
          </p>
        </div>
      ) : (
        /* Mode 2: Inline Master Terms Editor & Persistence */
        <div className="space-y-3 bg-black/20 p-3 rounded-xl border border-amber-500/30">
          <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
            <Edit3 size={13} /> Update Master {isInvoice ? 'Invoice' : 'Quotation'} Terms
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {editableTerms.map((term, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  className="input !text-xs !py-1.5 flex-1"
                  value={term}
                  onChange={e => handleUpdateTerm(idx, e.target.value)}
                  placeholder="Term clause text…"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveTerm(idx)}
                  className="btn-ghost !p-1.5 text-red-400 hover:bg-red-500/20 flex-shrink-0"
                  title="Remove clause"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <input
              className="input !text-xs !py-1.5 flex-1"
              value={newTermText}
              onChange={e => setNewTermText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTerm() } }}
              placeholder="Add new term clause…"
            />
            <button
              type="button"
              onClick={handleAddTerm}
              className="btn-secondary !text-xs !py-1.5 !px-2.5 flex-shrink-0"
            >
              <Plus size={14} /> Add
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsEditingMaster(false)}
              className="btn-ghost text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveMasterTerms}
              disabled={saving}
              className="btn-primary text-xs !py-1.5 !px-3"
            >
              <Save size={13} /> {saving ? 'Saving…' : 'Save & Persist'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
