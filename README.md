# ApexBill — Modern Billing & POS System

An **offline-first**, browser-based billing, quotation, and inventory management system for Windows with:
- ✅ Local SQLite persistence (WAL mode)
- ✅ GST Tax Engine (CGST + SGST split, proportional discount)
- ✅ Dynamic UPI QR Code generation (NPCI-compliant)
- ✅ 5-slot POS memory (hold carts simultaneously)
- ✅ A4 GST Invoice + 80mm Thermal receipt printing
- ✅ Sales Dashboard with drill-down analytics
- ✅ CSV batch inventory import (2000+ SKUs)

---

## Quick Start

### Prerequisites
- Node.js 18+ ([nodejs.org](https://nodejs.org))

### 1. Install Dependencies

```powershell
# Server
cd server
npm install

# Client
cd ..\client
npm install
```

### 2. Development Mode (two terminals)

**Terminal 1 — Backend:**
```powershell
cd d:\Github\ApexBill\server
npm run dev
# Server starts at http://localhost:54321
```

**Terminal 2 — Frontend:**
```powershell
cd d:\Github\ApexBill\client
npm run dev
# UI starts at http://localhost:5173
```

Open **http://localhost:5173** in your browser.

### 3. Production Build

```powershell
# Build React UI into server/public
cd d:\Github\ApexBill\client
npm run build

# Start the production server (serves both API + UI)
cd ..\server
npm run build
npm start
# Open http://localhost:54321
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F2` | Focus item search |
| `F4` | Save as Quotation |
| `F7` | Cash Checkout |
| `F8` | UPI / QR Checkout |
| `Alt+1..5` | Switch POS memory slots |
| `Alt+B` | Go to Billing |
| `Alt+D` | Go to Dashboard |

---

## CSV Import Format

Upload products in bulk via **Inventory → Import CSV**:

```csv
sku,name,hsn_sac,unit,purchase_price,selling_price,tax_rate,stock_qty
PROD-001,Widget A,12345,PCS,80,100,18,500
PROD-002,Service B,998314,NOS,0,2000,18,0
```

---

## Database

SQLite file is stored at:
```
%APPDATA%\ApexBill\billing_app.db
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| State | Zustand |
| Backend | Fastify (TypeScript) on port 54321 |
| Database | SQLite (better-sqlite3, WAL mode) |
| QR Code | qrcode.react |
| Icons | lucide-react |

---

## Project Structure

```
ApexBill/
├── server/                  # Fastify backend
│   ├── src/
│   │   ├── db/              # SQLite connection + schema
│   │   ├── routes/          # API route handlers
│   │   └── services/        # Business logic
│   └── package.json
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── store/           # Zustand stores
│   │   └── utils/           # GST engine, API client, helpers
│   └── package.json
└── build-scripts/           # Windows packaging
```
