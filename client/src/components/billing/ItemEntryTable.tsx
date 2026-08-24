// components/billing/ItemEntryTable.tsx — Dynamic line items with product search (display all on focus)
import { useRef, useState, useEffect } from 'react'
import { Plus, Trash2, Search } from 'lucide-react'
import { useBillingStore } from '../../store/useBillingStore'
import { api } from '../../utils/api'
import { formatINR } from '../../utils/upiHelper'
import { GST_RATES } from '../../utils/gstEngine'

export default function ItemEntryTable({ sellerProfile }: { sellerProfile?: any } = {}) {
  const showPurchasePrice = !!sellerProfile?.show_purchase_price_in_pos
  const { items, addItem, updateItem, removeItem } = useBillingStore()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [allProducts, setAllProducts] = useState<any[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const loadAll = async () => {
    try {
      const list = await api.inventory.list()
      setAllProducts(list || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => { loadAll() }, [])

  const filterProducts = (q: string) => {
    setSearch(q)
    setSearchOpen(true)
    if (!q.trim()) {
      setResults(allProducts)
    } else {
      const lower = q.toLowerCase()
      setResults(allProducts.filter(p =>
        p.name.toLowerCase().includes(lower) ||
        (p.sku && p.sku.toLowerCase().includes(lower)) ||
        (p.hsn_sac && p.hsn_sac.toLowerCase().includes(lower))
      ))
    }
  }

  const handleFocus = async () => {
    const list = await api.inventory.list()
    setAllProducts(list || [])
    if (!search.trim()) {
      setResults(list || [])
    } else {
      filterProducts(search)
    }
    setSearchOpen(true)
  }

  const selectProduct = (p: any) => {
    addItem({ productId: p.id, productName: p.name, hsnSac: p.hsn_sac, unit: p.unit || 'PCS', purchasePrice: p.purchase_price || 0, quantity: 1, unitPrice: p.selling_price, gstRate: p.tax_rate })
    setSearch(''); setResults([]); setSearchOpen(false)
    searchRef.current?.focus()
  }

  const addBlank = () => {
    addItem({ productName: '', hsnSac: '', unit: 'PCS', purchasePrice: 0, quantity: 1, unitPrice: 0, gstRate: 18 })
  }

  return (
    <div className="space-y-3">
      {/* Product Search (F2) */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            ref={searchRef}
            id="item-search"
            className="input pl-8 flex-1"
            placeholder="Click to view all products or search by name/SKU… (F2)"
            value={search}
            onChange={e => filterProducts(e.target.value)}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
          />
          <button onClick={addBlank} className="btn-secondary px-3 flex-shrink-0" title="Add blank row"><Plus size={16} /></button>
        </div>
        {searchOpen && results.length > 0 && (
          <div className="absolute top-full left-0 right-12 mt-1 glass-card z-30 overflow-hidden max-h-60 overflow-y-auto">
            {results.map(p => (
              <div key={p.id} className="px-4 py-2.5 cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                onMouseDown={() => selectProduct(p)}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-100">{p.name}</span>
                    {p.sku && <span className="ml-2 text-xs text-gray-500 font-mono">SKU: {p.sku}</span>}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-emerald-400">MRP: {formatINR(p.selling_price)}</span>
                    {showPurchasePrice && <span className="ml-2 text-xs text-amber-300">Buy: {formatINR(p.purchase_price)}</span>}
                    <span className="ml-2 text-xs text-gray-500">GST {p.tax_rate}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 mt-0.5">
                  <span>HSN: {p.hsn_sac || '—'}</span>
                  <span>Stock: {p.stock_qty} {p.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Line Items Table */}
      {items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="th w-8">#</th>
                <th className="th">Item</th>
                <th className="th w-20">HSN</th>
                <th className="th w-20">Unit</th>
                <th className="th w-20">Qty</th>
                {showPurchasePrice && <th className="th w-28 text-amber-300">Pur. Price</th>}
                <th className="th w-28">MRP Price</th>
                <th className="th w-20">GST%</th>
                <th className="th w-28 text-right">Total</th>
                <th className="th w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="tr">
                  <td className="td text-gray-500">{idx + 1}</td>
                  <td className="td">
                    <input
                      className="input !bg-transparent !border-transparent !rounded-none focus:!border-brand-500 focus:!bg-white/5 !px-0"
                      value={item.productName}
                      onChange={e => updateItem(item.id, { productName: e.target.value })}
                      placeholder="Item name"
                    />
                  </td>
                  <td className="td">
                    <input className="input !bg-transparent !border-transparent !rounded-none w-full text-xs focus:!border-brand-500 focus:!bg-white/5 !px-0"
                      value={item.hsnSac || ''} placeholder="HSN"
                      onChange={e => updateItem(item.id, { hsnSac: e.target.value })} />
                  </td>
                  <td className="td">
                    <select className="input !bg-transparent !border-transparent !rounded-none w-full text-xs focus:!border-brand-500 focus:!bg-white/5 !px-0"
                      value={item.unit || 'PCS'}
                      onChange={e => updateItem(item.id, { unit: e.target.value })}>
                      {['PCS','KG','LTR','MTR','BOX','PKT','NOS'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="td">
                    <input type="number" min={1} className="input !bg-transparent !border-transparent !rounded-none w-full focus:!border-brand-500 focus:!bg-white/5 !px-0"
                      value={item.quantity}
                      onChange={e => updateItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} />
                  </td>
                  {showPurchasePrice && (
                    <td className="td">
                      <input type="number" min={0} step={1} className="input !bg-transparent !border-transparent !rounded-none w-full text-amber-300 focus:!border-brand-500 focus:!bg-white/5 !px-0"
                        value={item.purchasePrice || 0}
                        onChange={e => updateItem(item.id, { purchasePrice: parseFloat(e.target.value) || 0 })} />
                    </td>
                  )}
                  <td className="td">
                    <input type="number" min={0} step={1} className="input !bg-transparent !border-transparent !rounded-none w-full focus:!border-brand-500 focus:!bg-white/5 !px-0"
                      value={item.unitPrice}
                      onChange={e => updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })} />
                  </td>
                  <td className="td">
                    <select className="input !bg-transparent !border-transparent !rounded-none !px-0 focus:!border-brand-500 focus:!bg-white/5"
                      value={item.gstRate}
                      onChange={e => updateItem(item.id, { gstRate: parseFloat(e.target.value) })}>
                      {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </td>
                  <td className="td text-right font-medium text-emerald-400">
                    {formatINR(item.quantity * item.unitPrice)}
                  </td>
                  <td className="td">
                    <button onClick={() => removeItem(item.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 && (
        <div className="text-center py-10 text-gray-500 border border-dashed border-white/10 rounded-xl">
          <p className="text-sm">Search a product above or click <strong>+</strong> to add a blank row</p>
        </div>
      )}
    </div>
  )
}
