import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'

const DB_DIR = path.join(process.env.APPDATA || process.env.HOME || '.', 'ApexBill')
const DB_PATH = path.join(DB_DIR, 'billing_app.db')

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })

const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

console.log('Seeding rich demonstration data into ApexBill...')

// 1. Seller Profile
db.prepare(`
  INSERT OR REPLACE INTO seller_profile (
    id, business_name, trade_name, gstin, pan, phone, email,
    address_line1, address_line2, city, state_code, pincode,
    bank_name, bank_account_no, bank_ifsc, bank_branch, active_upi_id,
    enable_scan_to_pay, show_purchase_price_in_pos, show_profit_loss_in_pos, restrict_sales_to_stock_qty
  ) VALUES (
    1,
    'Apex Enterprise & Retail Systems',
    'ApexBill Solutions',
    '29ABCDE1234F1Z5',
    'ABCDE1234F',
    '+91 98765 00000',
    'billing@apexbill.io',
    'Suite 402, Prestige Cyber Towers',
    '100 Feet Road, Indiranagar',
    'Bengaluru',
    '29',
    '560038',
    'HDFC Bank Ltd',
    '50200084729104',
    'HDFC0000128',
    'Indiranagar Branch',
    'apexbill@okhdfcbank',
    1, 1, 1, 0
  )
`).run()

// 2. UPI Accounts
db.prepare('DELETE FROM seller_upi_accounts').run()
const upiStmt = db.prepare(`
  INSERT INTO seller_upi_accounts (id, upi_id, payee_name, label, is_default)
  VALUES (?, ?, ?, ?, ?)
`)
upiStmt.run('upi-1', 'apexbill@okhdfcbank', 'Apex Solutions India', 'HDFC Primary Merchant', 1)
upiStmt.run('upi-2', 'apexretail@icici', 'Apex Retail POS', 'ICICI Backup QR', 0)

// 3. Customers
const custStmt = db.prepare(`
  INSERT OR REPLACE INTO customers (phone, name, email, gstin, billing_address, state_code, outstanding_balance)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`)
custStmt.run('+91 98765 43210', 'Rajesh Kumar', 'rajesh.k@gmail.com', '29AABCR1234A1Z1', '#42, 4th Cross, Koramangala 4th Block, Bengaluru', '29', 0.00)
custStmt.run('+91 98450 11223', 'Priya Sharma', 'priya.sharma@techcorp.in', '27AABCS5678B1Z2', 'B-1204, Lodha Bellissimo, Lower Parel, Mumbai', '27', 4500.00)
custStmt.run('+91 98200 99887', 'TechVanguard Systems Pvt Ltd', 'finance@techvanguard.io', '36AABCT9988C1Z2', 'Plot 18, HITEC City, Madhapur, Hyderabad', '36', 0.00)
custStmt.run('+91 98111 22334', 'Amit Patel', 'amit.patel@nexusgroup.com', '24AABCA1122D1Z3', '7th Floor, Silicon Arcade, SG Highway, Ahmedabad', '24', 1200.00)
custStmt.run('+91 98333 44556', 'Anita Rao', 'anita.rao@designcraft.org', '', '14/2, Wallace Garden, Nungambakkam, Chennai', '33', 0.00)

// 4. Products Catalog
const prodStmt = db.prepare(`
  INSERT OR REPLACE INTO products (id, sku, name, hsn_sac, unit, purchase_price, selling_price, tax_rate, stock_qty)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const products = [
  { id: 'prod-1', sku: 'LAP-DELL-3520', name: 'Dell Latitude 15 3520 (Intel i7, 16GB, 512GB SSD)', hsn: '84713010', unit: 'PCS', buy: 48500, sell: 58990, tax: 18, stock: 12 },
  { id: 'prod-2', sku: 'MON-LG-27UP850', name: 'LG 27" UltraFine 4K UHD IPS USB-C Monitor', hsn: '85285200', unit: 'PCS', buy: 22400, sell: 29499, tax: 18, stock: 18 },
  { id: 'prod-3', sku: 'KB-LOGI-MXMECH', name: 'Logitech MX Mechanical Wireless Tactile Keyboard', hsn: '84716060', unit: 'PCS', buy: 8200, sell: 11495, tax: 18, stock: 32 },
  { id: 'prod-4', sku: 'MS-LOGI-MX3S', name: 'Logitech MX Master 3S Ergonomic Wireless Mouse', hsn: '84716060', unit: 'PCS', buy: 5600, sell: 7995, tax: 18, stock: 45 },
  { id: 'prod-5', sku: 'PRN-APEX-POS80', name: 'Apex 80mm Thermal Receipt Printer (USB + LAN + BT)', hsn: '84433200', unit: 'PCS', buy: 3100, sell: 4850, tax: 18, stock: 24 },
  { id: 'prod-6', sku: 'SSD-SAMS-980P', name: 'Samsung 980 Pro 1TB NVMe M.2 PCIe Gen 4 SSD', hsn: '84717020', unit: 'PCS', buy: 6400, sell: 8990, tax: 18, stock: 40 },
  { id: 'prod-7', sku: 'CAB-HDMI-4K2M', name: 'Braided Ultra High Speed HDMI 2.1 8K/4K 2M Cable', hsn: '85444290', unit: 'PCS', buy: 320, sell: 799, tax: 18, stock: 110 },
  { id: 'prod-8', sku: 'MAT-DESK-EXEC', name: 'Executive Vegan Leather Waterproof Desk Mat 900x400', hsn: '39269099', unit: 'PCS', buy: 420, sell: 999, tax: 18, stock: 65 },
  { id: 'prod-9', sku: 'CHG-GAN-65W', name: 'Apex 65W GaN Dual USB-C + USB-A Ultra-Fast Charger', hsn: '85044090', unit: 'PCS', buy: 890, sell: 1799, tax: 18, stock: 55 },
  { id: 'prod-10', sku: 'ROL-THERM-80X50', name: 'Premium 80mm x 50m Thermal Paper Rolls (Pack of 10)', hsn: '48119000', unit: 'BOX', buy: 380, sell: 650, tax: 12, stock: 150 },
  { id: 'prod-11', sku: 'HUB-USBC-7IN1', name: 'Apex 7-in-1 USB-C Hub (4K HDMI, 100W PD, SD Reader)', hsn: '84718000', unit: 'PCS', buy: 1400, sell: 2499, tax: 18, stock: 38 },
  { id: 'prod-12', sku: 'SPK-JBL-GO3', name: 'JBL Go 3 Ultra-Portable Waterproof Bluetooth Speaker', hsn: '85182100', unit: 'PCS', buy: 2100, sell: 2999, tax: 18, stock: 25 },
]

for (const p of products) {
  prodStmt.run(p.id, p.sku, p.name, p.hsn, p.unit, p.buy, p.sell, p.tax, p.stock)
}

// 5. Historical Documents (Invoices & Quotations)
const docStmt = db.prepare(`
  INSERT OR REPLACE INTO documents (
    id, doc_type, doc_number, revision_number, doc_date,
    customer_phone, customer_snapshot, gross_subtotal, discount_pct,
    discount_amount, taxable_amount, cgst_total, sgst_total, round_off,
    grand_total, payment_mode, payment_status, selected_upi_id, notes, hide_tax_on_invoice
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const itemStmt = db.prepare(`
  INSERT OR REPLACE INTO document_items (
    id, document_id, product_id, product_name, hsn_sac, quantity,
    unit_price, gross_amount, taxable_value, gst_rate, cgst_rate, cgst_amount,
    sgst_rate, sgst_amount, total_amount, purchase_price, unit
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

// Helper to format date
const today = new Date().toISOString().split('T')[0]
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]

// Invoice 1: Recent Cash Sale (Today)
const doc1Id = 'doc-inv-001'
docStmt.run(
  doc1Id, 'INVOICE', 'INV-20260831-001', 1, today,
  '+91 98765 43210',
  JSON.stringify({ phone: '+91 98765 43210', name: 'Rajesh Kumar', gstin: '29AABCR1234A1Z1', billing_address: '#42, 4th Cross, Koramangala 4th Block, Bengaluru', state_code: '29' }),
  70485.00, 5.00, 3524.25, 56746.40, 5107.18, 5107.18, 0.24, 66961.00,
  'UPI', 'PAID', 'apexbill@okhdfcbank', 'Delivered with 1-year on-site warranty', 0
)
itemStmt.run('item-1-1', doc1Id, 'prod-1', 'Dell Latitude 15 3520 (Intel i7, 16GB, 512GB SSD)', '84713010', 1, 58990.00, 58990.00, 47492.46, 18, 9, 4274.32, 9, 4274.32, 56041.10, 48500, 'PCS')
itemStmt.run('item-1-2', doc1Id, 'prod-3', 'Logitech MX Mechanical Wireless Tactile Keyboard', '84716060', 1, 11495.00, 11495.00, 9253.94, 18, 9, 832.86, 9, 832.86, 10919.66, 8200, 'PCS')

// Invoice 2: Yesterday UPI Sale
const doc2Id = 'doc-inv-002'
docStmt.run(
  doc2Id, 'INVOICE', 'INV-20260830-002', 1, yesterday,
  '+91 98450 11223',
  JSON.stringify({ phone: '+91 98450 11223', name: 'Priya Sharma', gstin: '27AABCS5678B1Z2', billing_address: 'B-1204, Lodha Bellissimo, Lower Parel, Mumbai', state_code: '27' }),
  37494.00, 0.00, 0.00, 31774.58, 2859.71, 2859.71, 0.00, 37494.00,
  'UPI', 'PAID', 'apexbill@okhdfcbank', 'Payment confirmed via PhonePe UPI', 0
)
itemStmt.run('item-2-1', doc2Id, 'prod-2', 'LG 27" UltraFine 4K UHD IPS USB-C Monitor', '85285200', 1, 29499.00, 29499.00, 24999.15, 18, 9, 2249.92, 9, 2249.92, 29499.00, 22400, 'PCS')
itemStmt.run('item-2-2', doc2Id, 'prod-4', 'Logitech MX Master 3S Ergonomic Wireless Mouse', '84716060', 1, 7995.00, 7995.00, 6775.42, 18, 9, 609.79, 9, 609.79, 7995.00, 5600, 'PCS')

// Invoice 3: Corporate Bulk Order (3 days ago)
const doc3Id = 'doc-inv-003'
docStmt.run(
  doc3Id, 'INVOICE', 'INV-20260828-003', 1, threeDaysAgo,
  '+91 98200 99887',
  JSON.stringify({ phone: '+91 98200 99887', name: 'TechVanguard Systems Pvt Ltd', gstin: '36AABCT9988C1Z2', billing_address: 'Plot 18, HITEC City, Madhapur, Hyderabad', state_code: '36' }),
  147450.00, 8.00, 11796.00, 114961.02, 10346.49, 10346.49, -0.00, 135654.00,
  'UPI', 'PAID', 'apexbill@okhdfcbank', 'PO Ref: TV-PO-8842 / NEFT transfer completed', 0
)
itemStmt.run('item-3-1', doc3Id, 'prod-2', 'LG 27" UltraFine 4K UHD IPS USB-C Monitor', '85285200', 5, 29499.00, 147495.00, 114961.02, 18, 9, 10346.49, 9, 10346.49, 135654.00, 22400, 'PCS')

// Document 4: Pending Quotation ready to convert
const doc4Id = 'doc-quo-001'
docStmt.run(
  doc4Id, 'QUOTATION', 'QUO-20260831-001', 1, today,
  '+91 98111 22334',
  JSON.stringify({ phone: '+91 98111 22334', name: 'Amit Patel', gstin: '24AABCA1122D1Z3', billing_address: '7th Floor, Silicon Arcade, SG Highway, Ahmedabad', state_code: '24' }),
  26487.00, 10.00, 2648.70, 20202.80, 1818.25, 1818.25, 0.00, 23839.00,
  'UPI', 'UNPAID', 'apexbill@okhdfcbank', 'Valid for 15 days. Subject to stock availability.', 0
)
itemStmt.run('item-4-1', doc4Id, 'prod-5', 'Apex 80mm Thermal Receipt Printer (USB + LAN + BT)', '84433200', 2, 4850.00, 9700.00, 7401.70, 18, 9, 666.15, 9, 666.15, 8734.00, 3100, 'PCS')
itemStmt.run('item-4-2', doc4Id, 'prod-6', 'Samsung 980 Pro 1TB NVMe M.2 PCIe Gen 4 SSD', '84717020', 1, 8990.00, 8990.00, 6859.32, 18, 9, 617.34, 9, 617.34, 8094.00, 6400, 'PCS')
itemStmt.run('item-4-3', doc4Id, 'prod-9', 'Apex 65W GaN Dual USB-C + USB-A Ultra-Fast Charger', '85044090', 4, 1799.00, 7196.00, 5490.51, 18, 9, 494.15, 9, 494.15, 6478.80, 890, 'PCS')

// 6. POS Active Memory Slot 1 (Live cart session for screenshot)
const slot1Cart = {
  items: [
    {
      id: 'cart-1',
      productId: 'prod-1',
      productName: 'Dell Latitude 15 3520 (Intel i7, 16GB, 512GB SSD)',
      hsnSac: '84713010',
      quantity: 1,
      unitPrice: 58990,
      gstRate: 18,
      purchasePrice: 48500,
      unit: 'PCS',
      availableStock: 12
    },
    {
      id: 'cart-2',
      productId: 'prod-3',
      productName: 'Logitech MX Mechanical Wireless Tactile Keyboard',
      hsnSac: '84716060',
      quantity: 2,
      unitPrice: 11495,
      gstRate: 18,
      purchasePrice: 8200,
      unit: 'PCS',
      availableStock: 32
    },
    {
      id: 'cart-3',
      productId: 'prod-9',
      productName: 'Apex 65W GaN Dual USB-C + USB-A Ultra-Fast Charger',
      hsnSac: '85044090',
      quantity: 3,
      unitPrice: 1799,
      gstRate: 18,
      purchasePrice: 890,
      unit: 'PCS',
      availableStock: 55
    }
  ],
  customer: {
    phone: '+91 98765 43210',
    name: 'Rajesh Kumar',
    email: 'rajesh.k@gmail.com',
    gstin: '29ABCDE1234F1Z5',
    billing_address: '#42, 4th Cross, Koramangala 4th Block, Bengaluru',
    state_code: '29'
  },
  discountPct: 5,
  paymentMode: 'UPI',
  paymentStatus: 'PAID',
  docDate: today,
  notes: 'Express 1-day delivery. Serial numbers noted.',
  docType: 'INVOICE',
  selectedUpiId: 'apexbill@okhdfcbank',
  hideTaxOnInvoice: false,
  editingDocId: null,
  editingDocNumber: null,
  revisionNumber: 1
}

db.prepare(`
  INSERT OR REPLACE INTO pos_memory_slots (slot_id, slot_label, cart_state, updated_at)
  VALUES (?, ?, ?, CURRENT_TIMESTAMP)
`).run(1, 'Billing - Rajesh Kumar', JSON.stringify(slot1Cart))

db.prepare(`
  INSERT OR REPLACE INTO pos_memory_slots (slot_id, slot_label, cart_state, updated_at)
  VALUES (?, ?, ?, CURRENT_TIMESTAMP)
`).run(2, 'VIP Client (Hold)', JSON.stringify({ items: [], customer: null, discountPct: 0, paymentMode: 'CASH', paymentStatus: 'PAID', docDate: today, notes: '', docType: 'INVOICE', selectedUpiId: null, hideTaxOnInvoice: false, editingDocId: null, editingDocNumber: null, revisionNumber: 1 }))

console.log('✅ Demo data seeded successfully!')
