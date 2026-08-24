PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1. Seller Profile & Bank Settings
CREATE TABLE IF NOT EXISTS seller_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    business_name TEXT NOT NULL DEFAULT 'My Business',
    trade_name TEXT,
    gstin TEXT NOT NULL DEFAULT '00AAAAA0000A1Z5',
    pan TEXT,
    phone TEXT NOT NULL DEFAULT '9999999999',
    email TEXT,
    address_line1 TEXT NOT NULL DEFAULT 'Address Line 1',
    address_line2 TEXT,
    city TEXT NOT NULL DEFAULT 'City',
    state_code TEXT NOT NULL DEFAULT '36', -- 2-digit GST state code
    pincode TEXT NOT NULL DEFAULT '500001',
    bank_name TEXT,
    bank_account_no TEXT,
    bank_ifsc TEXT,
    bank_branch TEXT,
    active_upi_id TEXT,
    enable_scan_to_pay INTEGER DEFAULT 1,
    show_purchase_price_in_pos INTEGER DEFAULT 0,
    show_profit_loss_in_pos INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Configurable UPI Accounts
CREATE TABLE IF NOT EXISTS seller_upi_accounts (
    id TEXT PRIMARY KEY,
    upi_id TEXT UNIQUE NOT NULL,
    payee_name TEXT NOT NULL,
    label TEXT NOT NULL,
    is_default BOOLEAN DEFAULT 0
);

-- 3. Customer Master (Phone as Primary Key)
CREATE TABLE IF NOT EXISTS customers (
    phone TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    gstin TEXT,
    billing_address TEXT,
    state_code TEXT NOT NULL DEFAULT '36',
    outstanding_balance DECIMAL(12,2) DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name COLLATE NOCASE);

-- 4. Products Master
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    hsn_sac TEXT,
    unit TEXT DEFAULT 'PCS',
    purchase_price DECIMAL(10,2) DEFAULT 0.00,
    selling_price DECIMAL(10,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 18.00,
    stock_qty INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_products_search ON products(sku, name COLLATE NOCASE);

-- 5. Documents Master (Invoices & Quotations)
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    doc_type TEXT CHECK (doc_type IN ('QUOTATION', 'INVOICE')) NOT NULL,
    doc_number TEXT UNIQUE NOT NULL,
    parent_doc_id TEXT REFERENCES documents(id),
    revision_number INTEGER DEFAULT 1,
    doc_date DATE NOT NULL,
    customer_phone TEXT REFERENCES customers(phone) ON UPDATE CASCADE ON DELETE SET NULL,
    customer_snapshot TEXT NOT NULL, -- Frozen JSON snapshot
    gross_subtotal DECIMAL(12,2) NOT NULL,
    discount_pct DECIMAL(5,2) DEFAULT 0.00,
    discount_amount DECIMAL(12,2) DEFAULT 0.00,
    taxable_amount DECIMAL(12,2) NOT NULL,
    cgst_total DECIMAL(12,2) NOT NULL,
    sgst_total DECIMAL(12,2) NOT NULL,
    round_off DECIMAL(4,2) DEFAULT 0.00,
    grand_total DECIMAL(12,2) NOT NULL,
    payment_mode TEXT CHECK (payment_mode IN ('CASH', 'UPI', 'CREDIT')),
    payment_status TEXT CHECK (payment_status IN ('PAID', 'PARTIAL', 'UNPAID', 'CANCELLED')) DEFAULT 'PAID',
    selected_upi_id TEXT,
    notes TEXT,
    hide_tax_on_invoice INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(doc_date, doc_type);

-- 6. Document Line Items
CREATE TABLE IF NOT EXISTS document_items (
    id TEXT PRIMARY KEY,
    document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    product_name TEXT NOT NULL,
    hsn_sac TEXT,
    unit TEXT DEFAULT 'PCS',
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    gross_amount DECIMAL(10,2) NOT NULL,
    taxable_value DECIMAL(10,2) NOT NULL,
    gst_rate DECIMAL(5,2) NOT NULL,
    cgst_rate DECIMAL(5,2) NOT NULL,
    cgst_amount DECIMAL(10,2) NOT NULL,
    sgst_rate DECIMAL(5,2) NOT NULL,
    sgst_amount DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    purchase_price DECIMAL(10,2) DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_document_items_doc_id ON document_items(document_id);

-- 7. POS Memory Slots (Persistent Active Sessions)
CREATE TABLE IF NOT EXISTS pos_memory_slots (
    slot_id INTEGER PRIMARY KEY CHECK (slot_id BETWEEN 1 AND 5),
    slot_label TEXT,
    cart_state TEXT NOT NULL DEFAULT '{}', -- JSON blob of items, customer, discount, mode
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default seller profile (id=1 enforced by CHECK constraint)
INSERT OR IGNORE INTO seller_profile (id, business_name, gstin, phone, address_line1, city, state_code, pincode)
VALUES (1, 'My Business', '00AAAAA0000A1Z5', '9999999999', 'Address Line 1', 'Hyderabad', '36', '500001');

-- Seed 5 empty POS memory slots
INSERT OR IGNORE INTO pos_memory_slots (slot_id, slot_label, cart_state) VALUES
    (1, 'Slot 1', '{"items":[],"customer":null,"discountPct":0,"paymentMode":"CASH"}'),
    (2, 'Slot 2', '{"items":[],"customer":null,"discountPct":0,"paymentMode":"CASH"}'),
    (3, 'Slot 3', '{"items":[],"customer":null,"discountPct":0,"paymentMode":"CASH"}'),
    (4, 'Slot 4', '{"items":[],"customer":null,"discountPct":0,"paymentMode":"CASH"}'),
    (5, 'Slot 5', '{"items":[],"customer":null,"discountPct":0,"paymentMode":"CASH"}');
