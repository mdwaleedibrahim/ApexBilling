\# IMPLEMENTATION\_PLAN.md

\# Windows Browser Billing & POS System — Implementation Roadmap

An offline-first, browser-based billing, quotation, and inventory management system for Windows with local SQLite persistence, dynamic UPI QR generation, and sales analytics.

\---

\#\# 1\. System Architecture & Tech Stack

┌────────────────────────────────────────────────────────┐ │ Browser Client (React \+ Vite \+ Tailwind CSS \+ Shadcn) │ │ \- POS Billing Table & 5 Memory Slots (Zustand) │ │ \- Customer Autocomplete (Phone PK) & Live Discount % │ │ \- Sales Dashboard & Seller Settings Modal │ │ \- Printable CSS Layouts (A4 GST \+ 80mm Thermal POS) │ └───────────────────────────┬────────────────────────────┘ │ HTTP / REST (localhost) ┌───────────────────────────▼────────────────────────────┐ │ Localhost Backend (Node.js Fastify / TypeScript) │ │ \- Tax & Proportionate Discount Engine (CGST \+ SGST) │ │ \- Inventory Reconciler (Atomic Stock Restock on Edits) │ │ \- SQLite Database Driver (WAL Mode enabled) │ │ \- CSV Batch Stream Parser │ └───────────────────────────┬────────────────────────────┘ │ ┌───────────────────────────▼────────────────────────────┐ │ Storage & Hardware Layer │ │ \- SQLite File (billing\_app.db in %AppData%) │ │ \- Windows Native Print Spooler (ESC/POS & A4 PDF) │ └────────────────────────────────────────────────────────┘  
\---

\#\# 2\. Master Database Schema (\`schema.sql\`)

\`\`\`sql  
PRAGMA journal\_mode \= WAL;  
PRAGMA foreign\_keys \= ON;

\-- 1\. Seller Profile & Bank Settings  
CREATE TABLE IF NOT EXISTS seller\_profile (  
    id INTEGER PRIMARY KEY CHECK (id \= 1),  
    business\_name TEXT NOT NULL,  
    trade\_name TEXT,  
    gstin TEXT NOT NULL,  
    pan TEXT,  
    phone TEXT NOT NULL,  
    email TEXT,  
    address\_line1 TEXT NOT NULL,  
    address\_line2 TEXT,  
    city TEXT NOT NULL,  
    state\_code TEXT NOT NULL, \-- 2-digit GST state code (e.g., '36')  
    pincode TEXT NOT NULL,  
    bank\_name TEXT,  
    bank\_account\_no TEXT,  
    bank\_ifsc TEXT,  
    bank\_branch TEXT,  
    active\_upi\_id TEXT,  
    updated\_at DATETIME DEFAULT CURRENT\_TIMESTAMP  
);

\-- 2\. Configurable UPI Accounts  
CREATE TABLE IF NOT EXISTS seller\_upi\_accounts (  
    id TEXT PRIMARY KEY,  
    upi\_id TEXT UNIQUE NOT NULL,  
    payee\_name TEXT NOT NULL,  
    label TEXT NOT NULL,  
    is\_default BOOLEAN DEFAULT 0  
);

\-- 3\. Customer Master (Phone as Primary Key)  
CREATE TABLE IF NOT EXISTS customers (  
    phone TEXT PRIMARY KEY NOT NULL,  
    name TEXT NOT NULL,  
    email TEXT,  
    gstin TEXT,  
    billing\_address TEXT,  
    state\_code TEXT NOT NULL,  
    outstanding\_balance DECIMAL(12,2) DEFAULT 0.00,  
    created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at DATETIME DEFAULT CURRENT\_TIMESTAMP  
);  
CREATE INDEX IF NOT EXISTS idx\_customers\_name ON customers(name COLLATE NOCASE);

\-- 4\. Products Master  
CREATE TABLE IF NOT EXISTS products (  
    id TEXT PRIMARY KEY,  
    sku TEXT UNIQUE NOT NULL,  
    name TEXT NOT NULL,  
    hsn\_sac TEXT,  
    unit TEXT DEFAULT 'PCS',  
    purchase\_price DECIMAL(10,2) DEFAULT 0.00,  
    selling\_price DECIMAL(10,2) NOT NULL,  
    tax\_rate DECIMAL(5,2) DEFAULT 18.00,  
    stock\_qty INTEGER DEFAULT 0,  
    created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at DATETIME DEFAULT CURRENT\_TIMESTAMP  
);  
CREATE INDEX IF NOT EXISTS idx\_products\_search ON products(sku, name COLLATE NOCASE);

\-- 5\. Documents Master (Invoices & Quotations)  
CREATE TABLE IF NOT EXISTS documents (  
    id TEXT PRIMARY KEY,  
    doc\_type TEXT CHECK (doc\_type IN ('QUOTATION', 'INVOICE')) NOT NULL,  
    doc\_number TEXT UNIQUE NOT NULL,  
    parent\_doc\_id TEXT REFERENCES documents(id),  
    revision\_number INTEGER DEFAULT 1,  
    doc\_date DATE NOT NULL,  
    customer\_phone TEXT REFERENCES customers(phone) ON UPDATE CASCADE ON DELETE SET NULL,  
    customer\_snapshot TEXT NOT NULL, \-- Frozen JSON snapshot  
    gross\_subtotal DECIMAL(12,2) NOT NULL,  
    discount\_pct DECIMAL(5,2) DEFAULT 0.00,  
    discount\_amount DECIMAL(12,2) DEFAULT 0.00,  
    taxable\_amount DECIMAL(12,2) NOT NULL,  
    cgst\_total DECIMAL(12,2) NOT NULL,  
    sgst\_total DECIMAL(12,2) NOT NULL,  
    round\_off DECIMAL(4,2) DEFAULT 0.00,  
    grand\_total DECIMAL(12,2) NOT NULL,  
    payment\_mode TEXT CHECK (payment\_mode IN ('CASH', 'UPI', 'CARD', 'BANK\_TRANSFER', 'CREDIT')),  
    payment\_status TEXT CHECK (payment\_status IN ('PAID', 'PARTIAL', 'UNPAID', 'CANCELLED')) DEFAULT 'PAID',  
    selected\_upi\_id TEXT,  
    notes TEXT,  
    created\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at DATETIME DEFAULT CURRENT\_TIMESTAMP  
);  
CREATE INDEX IF NOT EXISTS idx\_documents\_date ON documents(doc\_date, doc\_type);

\-- 6\. Document Line Items  
CREATE TABLE IF NOT EXISTS document\_items (  
    id TEXT PRIMARY KEY,  
    document\_id TEXT REFERENCES documents(id) ON DELETE CASCADE,  
    product\_id TEXT REFERENCES products(id),  
    product\_name TEXT NOT NULL,  
    hsn\_sac TEXT,  
    quantity INTEGER NOT NULL,  
    unit\_price DECIMAL(10,2) NOT NULL,  
    gross\_amount DECIMAL(10,2) NOT NULL,  
    taxable\_value DECIMAL(10,2) NOT NULL,  
    gst\_rate DECIMAL(5,2) NOT NULL,  
    cgst\_rate DECIMAL(5,2) NOT NULL,  
    cgst\_amount DECIMAL(10,2) NOT NULL,  
    sgst\_rate DECIMAL(5,2) NOT NULL,  
    sgst\_amount DECIMAL(10,2) NOT NULL,  
    total\_amount DECIMAL(10,2) NOT NULL  
);

\-- 7\. POS Memory Slots (Persistent Active Sessions)  
CREATE TABLE IF NOT EXISTS pos\_memory\_slots (  
    slot\_id INTEGER PRIMARY KEY CHECK (slot\_id BETWEEN 1 AND 5),  
    slot\_label TEXT,  
    cart\_state TEXT NOT NULL, \-- JSON blob of items, customer, discount, mode  
    updated\_at DATETIME DEFAULT CURRENT\_TIMESTAMP  
);

## **3\. Directory Layout**

billing-app/  
├── package.json  
├── server/  
│   ├── src/  
│   │   ├── db/  
│   │   │   ├── database.ts  
│   │   │   └── schema.sql  
│   │   ├── routes/  
│   │   │   ├── billing.routes.ts  
│   │   │   ├── customer.routes.ts  
│   │   │   ├── inventory.routes.ts  
│   │   │   ├── dashboard.routes.ts  
│   │   │   └── settings.routes.ts  
│   │   ├── services/  
│   │   │   ├── calculation.service.ts  
│   │   │   ├── stock-reconciler.service.ts  
│   │   │   └── csv-importer.service.ts  
│   │   └── index.ts  
│   └── tsconfig.json  
├── src/  
│   ├── components/  
│   │   ├── billing/  
│   │   │   ├── BillingWorkspace.tsx  
│   │   │   ├── CustomerSelector.tsx  
│   │   │   ├── ItemEntryTable.tsx  
│   │   │   ├── MemorySlotBar.tsx  
│   │   │   ├── SummaryCheckoutCard.tsx  
│   │   │   └── QuickProductModal.tsx  
│   │   ├── dashboard/  
│   │   │   ├── SalesDashboard.tsx  
│   │   │   ├── MetricCard.tsx  
│   │   │   └── CustomerBreakdownModal.tsx  
│   │   ├── history/  
│   │   │   ├── RecordsHistoryTab.tsx  
│   │   │   └── RevisionBadge.tsx  
│   │   ├── inventory/  
│   │   │   ├── InventoryTable.tsx  
│   │   │   └── CsvDropzoneModal.tsx  
│   │   ├── settings/  
│   │   │   └── SellerSettingsModal.tsx  
│   │   └── print/  
│   │       ├── A4InvoiceTemplate.tsx  
│   │       ├── ThermalReceiptTemplate.tsx  
│   │       └── InvoiceQRCode.tsx  
│   ├── store/  
│   │   ├── useBillingStore.ts  
│   │   └── useSlotStore.ts  
│   ├── utils/  
│   │   ├── gstEngine.ts  
│   │   └── upiHelper.ts  
│   ├── App.tsx  
│   └── main.tsx  
└── build-scripts/  
    ├── inno-setup.iss  
    └── start-service.vbs

## **4\. Phased Task Checklist for Implementation**

### **Phase 1: Local Backend & SQLite Foundation**

> * \[ \] Initialize Fastify TypeScript server on port 54321\.  
> * \[ \] Implement SQLite connection manager with WAL mode enabled and foreign keys enforced.  
> * \[ \] Seed default seller profile and 5 empty memory slots into pos\_memory\_slots.  
> * \[ \] Create generic database transaction wrapper for atomic multi-table mutations.

### **Phase 2: Dual Tax & Proportionate Discount Engine**

> * \[ \] Implement calculateInvoiceTotals(items, discountPct) in calculation.service.ts:  
  * Calculate \\text{Gross} \= \\text{Qty} \\times \\text{Price}.  
  * Derive \\text{Taxable} \= \\text{Gross} \\times (1 \- D / 100).  
  * Derive 50/50 tax split: \\text{CGST} \= \\text{Taxable} \\times (\\text{GST} / 200), \\text{SGST} \= \\text{Taxable} \\times (\\text{GST} / 200).  
  * Compute mathematical round-off: \\text{RoundOff} \= \\text{Round}(\\text{RawGrandTotal}) \- \\text{RawGrandTotal}.  
> * \[ \] Write test suite verifying mixed GST rates (5\\%, 12\\%, 18\\%, 28\\%) with non-zero discounts.

### **Phase 3: Inventory Ingestion (CSV & UI) \+ Stock Reconciler**

> * \[ \] Build POST /api/inventory/import-csv streaming parser with SQLite UPSERT logic:  
>   INSERT INTO products (id, sku, name, hsn\_sac, unit, purchase\_price, selling\_price, tax\_rate, stock\_qty)  
>   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)  
>   ON CONFLICT(sku) DO UPDATE SET  
>     name \= excluded.name,  
>     selling\_price \= excluded.selling\_price,  
>     tax\_rate \= excluded.tax\_rate,  
>     stock\_qty \= products.stock\_qty \+ excluded.stock\_qty,  
>     updated\_at \= CURRENT\_TIMESTAMP;

> * \[ \] Implement in-line Quick Product modal (Alt \+ N) to insert products straight from billing cart.  
> * \[ \] Build atomic stock restoration engine for historical invoice modifications:  
  1. Read old invoice items \\to Increment stock by previous quantities.  
  2. Validate new requested quantities \\to Decrement stock by new quantities.  
  3. Replace line items, increment revision\_number, and recalculate tax totals.

### **Phase 4: Customer Management (Phone as PK)**

> * \[ \] Implement GET /api/customers/search?q=:query scanning phone LIKE ?% OR name LIKE %?%.  
> * \[ \] Build React CustomerSelector with debounced search, keyboard navigation (ArrowUp/ArrowDown/Enter), and auto-fill across GSTIN, Address, and State Code.  
> * \[ \] Implement automatic inline upsert: typing a new phone number automatically registers the customer upon invoice save.

### **Phase 5: Memory Slots & POS Billing UX (Sleek UI)**

> * \[ \] Build 5-slot persistent state switcher in Zustand synced with pos\_memory\_slots.  
> * \[ \] Implement high-speed keyboard shortcuts:  
  * F2: Item Search / SKU Focus  
  * F4: Save as Quotation  
  * F7: Quick Cash Checkout  
  * F8: UPI / QR Checkout & Print  
  * Alt \+ 1 to Alt \+ 5: Switch Hold Carts  
> * \[ \] Display active Edit Mode notification banner when revising a historical invoice.

### **Phase 6: Printable Invoices & Dynamic UPI QR Code**

> * \[ \] Implement NPCI-compliant UPI deep link string builder: upi://pay?pa={upiId}\&pn={payeeName}\&am={grandTotal}\&tn=Bill\_{docNumber}\&cu=INR  
> * \[ \] Implement InvoiceQRCode SVG component using qrcode.react.  
> * \[ \] Build A4 GST Tax Invoice layout with CSS @media print rules (clean borders, HSN summary, CGST/SGST table, Bank details, UPI QR).  
> * \[ \] Build 80mm ESC/POS thermal receipt CSS template for silent POS receipt printing.

### **Phase 7: Sales Dashboard & Drill-down Analytics**

> * \[ \] Implement GET /api/dashboard/metrics computing:  
  * Today's sales & bill count.  
  * Current week's sales (Monday to Sunday) & bill count.  
  * Current month's sales & bill count.  
  * 12-month historical monthly breakdown.  
> * \[ \] Implement GET /api/dashboard/customer-breakdown?period=:periodKey aggregating total spend per customer in descending order.  
> * \[ \] Create interactive React modal opening upon card/row click to render the ranked customer list.

### **Phase 8: Seller Profile & Multi-UPI Manager**

> * \[ \] Implement Seller Settings Modal: Business details, GSTIN, Bank account info.  
> * \[ \] Multi-UPI handle manager: Add/remove UPI accounts and select default invoice QR account from dropdown.  
> * \[ \] Synchronize default state code and trade name into active checkout session.

### **Phase 9: Windows Packaging & Desktop Deployment**

> * \[ \] Bundle Fastify server using @vercel/ncc or esbuild into a single server.cjs file.  
> * \[ \] Bundle Vite UI into server/public for unified local hosting.  
> * \[ \] Create Inno Setup script (.iss) to compile a one-click Windows installer:  
  * Installs embedded Node runtime \+ SQLite to AppData/Local/ModernBillingPOS.  
  * Creates Desktop & Start Menu shortcuts pointing to default browser at http://localhost:54321.  
  * Adds silent VBScript background launcher to Windows startup.

## **5\. Verification & Acceptance Test Suite**

| Test Case | Expected Outcome | Status |
| :---- | :---- | :---- |
| **TC-01: Proportional Discount Tax** | On items with ₹1,000 @ 18% and ₹500 @ 12% with a 10% discount: Taxable values must reduce to ₹900 and ₹450 before applying 9%+9% and 6%+6% CGST/SGST. | \[ \] |
| **TC-02: Phone PK Duplicate Handling** | Entering an existing customer's phone with an updated name/address updates the record without creating duplicate entries. | \[ \] |
| **TC-03: Stock Reversion on Edit** | Editing an invoice from Qty 5 \\to Qty 3 returns \+2 units to products.stock\_qty and increments revision\_number to v2. | \[ \] |
| **TC-04: Multi-Cart Slot Isolation** | Switching from Slot 1 (active bill) to Slot 2 (new bill) preserves Slot 1 state completely without data leakage. | \[ \] |
| **TC-05: Dynamic UPI QR Scan** | Scanning the printed invoice QR via PhonePe/GPay auto-fills the exact rounded grand total, bill reference, and correct merchant VPA. | \[ \] |
| **TC-06: CSV Inventory Upload** | Uploading 2,000 SKU items completes in \<1.5s with zero SQLite lock errors. | \[ \] |
| **TC-07: Dashboard Drill-down** | Clicking "This Month" accurately lists customers ranked by total spend in descending order. | \[ \] |

