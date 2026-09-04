// components/billing/ItemEntryTable.tsx — Dynamic line items with product search (display all on focus)
import { useRef, useState, useEffect } from 'react'
import { Plus, Trash2, Search } from 'lucide-react'
import { useBillingStore } from '../../store/useBillingStore'
import { api } from '../../utils/api'
import { formatINR } from '../../utils/upiHelper'
import { GST_RATES } from '../../utils/gstEngine'
import { useDialogStore } from '../../store/useDialogStore'

export default function ItemEntryTable({ sellerProfile }: { sellerProfile?: any } = {}) {
  const showPurchasePrice = !!sellerProfile?.show_purchase_price_in_pos
  const { items, addItem, updateItem, removeItem, discountPct } = useBillingStore()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [allProducts, setAllProducts] = useState<any[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const blurTimerRef = useRef<any>(null)

  const [rowSearchId, setRowSearchId] = useState<string | null>(null)
  const rowBlurTimerRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
      if (rowBlurTimerRef.current) clearTimeout(rowBlurTimerRef.current)
    }
  }, [])

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

  const selectProduct = async (p: any) => {
    if (sellerProfile?.restrict_sales_to_stock_qty && p.stock_qty <= 0) {
      const confirmed = await useDialogStore.getState().show(
        `Order quantity of "${p.name}" (HSN: ${p.hsn_sac || 'N/A'}) exceeds inventory ${p.stock_qty}. Click OK to set quantity to inventory (0) or Cancel to allow quantity > inventory.`,
        true
      )
      if (confirmed) {
        return
      }
    }
    addItem({ productId: p.id, productName: p.name, hsnSac: p.hsn_sac, unit: p.unit || 'PCS', purchasePrice: p.purchase_price || 0, quantity: 1, unitPrice: p.selling_price, gstRate: p.tax_rate })
    setSearch(''); setResults([]); setSearchOpen(false)
    searchRef.current?.focus()
  }

  const selectProductForRow = (rowId: string, p: any) => {
    updateItem(rowId, {
      productId: p.id,
      productName: p.name,
      hsnSac: p.hsn_sac || '',
      unit: p.unit || 'PCS',
      unitPrice: p.selling_price,
      purchasePrice: p.purchase_price || 0,
      gstRate: p.tax_rate ?? 18
    })
    setRowSearchId(null)
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
            onBlur={() => {
              if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
              blurTimerRef.current = setTimeout(() => setSearchOpen(false), 200)
            }}
          />
          <button onClick={addBlank} className="btn-secondary px-3 flex-shrink-0" title="Add manual row"><Plus size={16} /></button>
        </div>
        {searchOpen && results.length > 0 && (
          <div className="absolute top-full left-0 right-12 mt-1.5 bg-[#111827] border border-gray-700/80 rounded-xl shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto divide-y divide-gray-800/60" style={{ backgroundColor: '#111827' }}>
            {results.map(p => (
              <div key={p.id} className="px-4 py-3 cursor-pointer hover:bg-gray-800/80 transition-colors"
                onMouseDown={() => selectProduct(p)}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-white">{p.name}</span>
                    {p.sku && <span className="ml-2 text-xs text-gray-400 font-mono">SKU: {p.sku}</span>}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-emerald-400">MRP: {formatINR(p.selling_price)}</span>
                    {showPurchasePrice && <span className="ml-2 text-xs text-amber-300">Buy: {formatINR(p.purchase_price)}</span>}
                    <span className="ml-2 text-xs text-gray-400">GST {p.tax_rate}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
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
              {items.map((item, idx) => {
                const netPrice = item.unitPrice * (1 - discountPct / 100)
                const isBelowCost = !!(item.purchasePrice && netPrice < item.purchasePrice)
                const query = item.productName ? item.productName.trim().toLowerCase() : ''
                const matchingProducts = query ? allProducts.filter(p =>
                  p.name.toLowerCase().includes(query) ||
                  (p.sku && p.sku.toLowerCase().includes(query)) ||
                  (p.hsn_sac && p.hsn_sac.toLowerCase().includes(query))
                ) : []

                return (
                  <tr key={item.id} className={`tr ${isBelowCost ? 'bg-red-950/20 border-red-500/30' : ''}`}>
                    <td className={`td ${isBelowCost ? 'text-red-400 font-semibold' : 'text-gray-500'}`}>{idx + 1}</td>
                    <td className="td relative">
                      <div className="relative">
                        <input
                          className={`input !bg-transparent !border-transparent !rounded-none focus:!border-brand-500 focus:!bg-white/5 !px-0 ${isBelowCost ? '!text-red-400 font-medium' : ''}`}
                          value={item.productName}
                          onChange={e => {
                            updateItem(item.id, { productName: e.target.value })
                            setRowSearchId(item.id)
                          }}
                          onFocus={() => {
                            if (item.productName?.trim()) {
                              setRowSearchId(item.id)
                            }
                          }}
                          onBlur={() => {
                            if (rowBlurTimerRef.current) clearTimeout(rowBlurTimerRef.current)
                            rowBlurTimerRef.current = setTimeout(() => setRowSearchId(null), 250)
                          }}
                          placeholder="Item name (auto-adds to inventory)"
                        />

                        {/* Realtime Inventory Dropdown for manual item typing */}
                        {rowSearchId === item.id && matchingProducts.length > 0 && (
                          <div className="absolute top-full left-0 mt-1 min-w-[320px] max-w-[420px] bg-[#111827] border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-56 overflow-y-auto divide-y divide-gray-800" style={{ backgroundColor: '#111827' }}>
                            <div className="px-3 py-1.5 bg-gray-900/90 text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                              <span>Existing Inventory Matches</span>
                              <span className="text-brand-400">{matchingProducts.length} found</span>
                            </div>
                            {matchingProducts.map(p => (
                              <div
                                key={p.id}
                                className="px-3.5 py-2.5 cursor-pointer hover:bg-brand-600/20 transition-colors text-xs"
                                onMouseDown={() => selectProductForRow(item.id, p)}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-white">{p.name}</span>
                                  <span className="font-bold text-emerald-400">{formatINR(p.selling_price)}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-gray-400 mt-0.5">
                                  <span>SKU: {p.sku || '—'} · HSN: {p.hsn_sac || '—'}</span>
                                  <span>Stock: {p.stock_qty} {p.unit}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {!item.productId && item.productName && (
                        <span className="text-[10px] text-emerald-400/80 font-medium block">
                          ✨ Manual item · will be auto-saved to inventory
                        </span>
                      )}
                    </td>
                    <td className="td">
                      <input className={`input !bg-transparent !border-transparent !rounded-none w-full text-xs focus:!border-brand-500 focus:!bg-white/5 !px-0 ${isBelowCost ? '!text-red-400' : ''}`}
                        value={item.hsnSac || ''} placeholder="HSN"
                        onChange={e => updateItem(item.id, { hsnSac: e.target.value })} />
                    </td>
                    <td className="td">
                      <select className={`input !bg-transparent !border-transparent !rounded-none w-full text-xs focus:!border-brand-500 focus:!bg-white/5 !px-0 ${isBelowCost ? '!text-red-400' : ''}`}
                        value={item.unit || 'PCS'}
                        onChange={e => updateItem(item.id, { unit: e.target.value })}>
                        {['PCS', 'KG', 'LTR', 'MTR', 'BOX', 'PKT', 'NOS'].map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="td">
                      <input type="number" min={1} className={`input !bg-transparent !border-transparent !rounded-none w-full focus:!border-brand-500 focus:!bg-white/5 !px-0 ${isBelowCost ? '!text-red-400' : ''}`}
                        value={item.quantity}
                        onChange={async e => {
                          const newQty = Math.max(1, parseInt(e.target.value) || 1)
                          if (sellerProfile?.restrict_sales_to_stock_qty && item.productId) {
                            const prod = allProducts.find(p => p.id === item.productId)
                            if (prod) {
                              const isEditing = !!useBillingStore.getState().editingDocId
                              const maxAllowedInventory = isEditing ? (item.quantity + prod.stock_qty) : prod.stock_qty
                              if (newQty > maxAllowedInventory) {
                                const confirmed = await useDialogStore.getState().show(
                                  `Order Qqantity of "${item.productName}" (HSN: ${item.hsnSac || 'N/A'}) exceeds inventory ${maxAllowedInventory}. Click OK to set quantity to inventory (${maxAllowedInventory}) or Cancel to allow quantity > inventory.`,
                                  true
                                )
                                if (confirmed) {
                                  updateItem(item.id, { quantity: maxAllowedInventory })
                                  return
                                }
                              }
                            }
                          }
                          updateItem(item.id, { quantity: newQty })
                        }} />
                    </td>
                    {showPurchasePrice && (
                      <td className="td text-amber-300/80 font-mono text-xs">
                        {formatINR(item.purchasePrice || 0)}
                      </td>
                    )}
                    <td className="td">
                      <input type="number" min={0} step={1} className={`input !bg-transparent !border-transparent !rounded-none w-full focus:!border-brand-500 focus:!bg-white/5 !px-0 ${isBelowCost ? '!text-red-400 font-bold' : ''}`}
                        value={item.unitPrice}
                        onChange={e => updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                        onBlur={async () => {
                          const netPrice = item.unitPrice * (1 - discountPct / 100)
                          if (item.purchasePrice && netPrice < item.purchasePrice) {
                            await useDialogStore.getState().show(
                              `Order price of "${item.productName}" is lesser than purchase price. Increase price.`,
                              false
                            )
                          }
                        }} />
                    </td>
                    <td className="td">
                      <select className={`input !bg-transparent !border-transparent !rounded-none !px-0 focus:!border-brand-500 focus:!bg-white/5 ${isBelowCost ? '!text-red-400' : ''}`}
                        value={item.gstRate}
                        onChange={e => updateItem(item.id, { gstRate: parseFloat(e.target.value) })}>
                        {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </td>
                    <td className={`td text-right font-medium ${isBelowCost ? 'text-red-400' : 'text-emerald-400'}`}>
                      {formatINR(item.quantity * item.unitPrice)}
                    </td>
                    <td className="td">
                      <button onClick={() => removeItem(item.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
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
