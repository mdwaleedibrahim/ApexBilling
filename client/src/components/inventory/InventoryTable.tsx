// components/inventory/InventoryTable.tsx — Product CRUD + CSV import
import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, Edit, Upload, Search, Save, X } from 'lucide-react'
import { api } from '../../utils/api'
import { formatINR } from '../../utils/upiHelper'
import { GST_RATES } from '../../utils/gstEngine'

const EMPTY = { sku: '', name: '', hsn_sac: '', unit: 'PCS', purchase_price: 0, selling_price: 0, tax_rate: 18, stock_qty: 0 }

export default function InventoryTable() {
  const [products, setProducts] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [csvModal, setCsvModal] = useState(false)
  const [csvResult, setCsvResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const q = search.trim()
    const data = q ? await api.inventory.search(q) : await api.inventory.list()
    setProducts(data)
  }

  useEffect(() => { load() }, [search])

  const save = async () => {
    setLoading(true)
    try {
      if (editId) { await api.inventory.update(editId, form) }
      else { await api.inventory.create(form) }
      setShowForm(false); setEditId(null); setForm(EMPTY); load()
    } finally { setLoading(false) }
  }

  const del = async (id: string) => {
    if (!confirm('Delete this product?')) return
    await api.inventory.delete(id); load()
  }

  const startEdit = (p: any) => {
    setForm({ sku: p.sku, name: p.name, hsn_sac: p.hsn_sac || '', unit: p.unit, purchase_price: p.purchase_price, selling_price: p.selling_price, tax_rate: p.tax_rate, stock_qty: p.stock_qty })
    setEditId(p.id); setShowForm(true)
  }

  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const text = await file.text()
    const result = await api.inventory.importCsv(text)
    setCsvResult(result); load()
  }

  const f = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }))

  return (
    <div className="p-6 space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-8" placeholder="Search SKU or name…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY) }} className="btn-primary"><Plus size={16} /> Add Product</button>
        <button onClick={() => fileRef.current?.click()} className="btn-secondary"><Upload size={16} /> Import CSV</button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
      </div>

      {/* CSV Result */}
      {csvResult && (
        <div className="glass-card p-4 text-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-gray-200">Import Result</p>
            <button onClick={() => setCsvResult(null)} className="btn-ghost p-1"><X size={14} /></button>
          </div>
          <p className="text-emerald-400">✓ Inserted: {csvResult.inserted} &nbsp; Updated: {csvResult.updated}</p>
          {csvResult.errors.length > 0 && <p className="text-red-400 mt-1">⚠ {csvResult.errors.length} errors</p>}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="section-title">{editId ? 'Edit Product' : 'New Product'}</h3>
            <button onClick={() => { setShowForm(false); setEditId(null) }} className="btn-ghost p-1"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="label">SKU *</label><input className="input" value={form.sku} onChange={e => f('sku', e.target.value)} placeholder="PROD-001" /></div>
            <div className="col-span-2"><label className="label">Name *</label><input className="input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Product Name" /></div>
            <div><label className="label">Unit</label>
              <select className="input" value={form.unit} onChange={e => f('unit', e.target.value)}>
                {['PCS','KG','LTR','MTR','BOX','PKT','NOS'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div><label className="label">HSN/SAC</label><input className="input" value={form.hsn_sac} onChange={e => f('hsn_sac', e.target.value)} placeholder="HSN Code" /></div>
            <div><label className="label">Purchase Price</label><input type="number" className="input" value={form.purchase_price} onChange={e => f('purchase_price', parseFloat(e.target.value) || 0)} /></div>
            <div><label className="label">Selling Price *</label><input type="number" className="input" value={form.selling_price} onChange={e => f('selling_price', parseFloat(e.target.value) || 0)} /></div>
            <div><label className="label">GST %</label>
              <select className="input" value={form.tax_rate} onChange={e => f('tax_rate', parseFloat(e.target.value))}>
                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <div><label className="label">Stock Qty</label><input type="number" className="input" value={form.stock_qty} onChange={e => f('stock_qty', parseInt(e.target.value) || 0)} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={loading} className="btn-primary"><Save size={16} />{loading ? 'Saving…' : 'Save Product'}</button>
            <button onClick={() => { setShowForm(false); setEditId(null) }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-white/10">
              <th className="th">SKU</th><th className="th">Name</th><th className="th">HSN</th>
              <th className="th">Unit</th><th className="th text-right">Buy</th>
              <th className="th text-right">Sell</th><th className="th">GST</th>
              <th className="th text-right">Stock</th><th className="th">Actions</th>
            </tr></thead>
            <tbody>
              {products.length === 0 && <tr><td colSpan={9} className="td text-center text-gray-500 py-8">No products. Add one or import CSV.</td></tr>}
              {products.map(p => (
                <tr key={p.id} className="tr">
                  <td className="td font-mono text-xs text-gray-400">{p.sku}</td>
                  <td className="td font-medium">{p.name}</td>
                  <td className="td text-gray-500 text-xs">{p.hsn_sac || '—'}</td>
                  <td className="td text-gray-400">{p.unit}</td>
                  <td className="td text-right text-gray-400">{formatINR(p.purchase_price)}</td>
                  <td className="td text-right font-medium text-emerald-400">{formatINR(p.selling_price)}</td>
                  <td className="td text-center text-xs text-gray-400">{p.tax_rate}%</td>
                  <td className={`td text-right font-medium ${p.stock_qty <= 5 ? 'text-red-400' : 'text-gray-200'}`}>{p.stock_qty}</td>
                  <td className="td">
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(p)} className="btn-ghost p-1.5 text-brand-400"><Edit size={14} /></button>
                      <button onClick={() => del(p.id)} className="btn-ghost p-1.5 text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
