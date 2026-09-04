# ApexBill — Project Dependencies & Environment Specifications

This document outlines all system, runtime, backend, and frontend dependencies required to run, develop, and build **ApexBill**.

---

## 🖥️ 1. Runtime & Environment Requirements

| Requirement | Minimum Version | Notes |
| :--- | :--- | :--- |
| **Node.js** | `>= 22.5.0` | **Mandatory** for native `node:sqlite` (`DatabaseSync` & WAL mode). No native C++ node-gyp compilation needed. |
| **Operating System** | Windows 10 / 11 (x64) | Tested on Windows 10/11. Works on macOS/Linux with Node 22+. |
| **PowerShell** | `5.1+` | Used by `./scripts/package-release.ps1` for building portable releases. |

---

## 📦 2. Root Orchestration Dependencies (`package.json`)

Manages concurrent execution of both the client and server during local development.

| Package | Version | Type | Purpose |
| :--- | :--- | :--- | :--- |
| [`concurrently`](https://www.npmjs.com/package/concurrently) | `^8.2.2` | devDependency | Runs client dev server and backend Fastify server concurrently with a single command (`npm run dev`). |

---

## ⚙️ 3. Backend Server Dependencies (`server/package.json`)

Fastify API server, SQLite database layer, stock reconciler, and billing engine.

### Production Dependencies
| Package | Version | Purpose |
| :--- | :--- | :--- |
| [`fastify`](https://www.npmjs.com/package/fastify) | `^4.28.1` | Ultra-fast HTTP API framework with low overhead. |
| [`@fastify/cors`](https://www.npmjs.com/package/@fastify/cors) | `^9.0.1` | Enables Cross-Origin Resource Sharing for API routes. |
| [`@fastify/static`](https://www.npmjs.com/package/@fastify/static) | `^7.0.4` | Serves compiled React frontend production assets from `server/public`. |

### Development Dependencies
| Package | Version | Purpose |
| :--- | :--- | :--- |
| [`typescript`](https://www.npmjs.com/package/typescript) | `^5.4.5` | TypeScript compiler for backend type checking and compilation to `dist/`. |
| [`tsx`](https://www.npmjs.com/package/tsx) | `^4.15.6` | TypeScript execute & watch engine for instant backend development. |
| [`@types/node`](https://www.npmjs.com/package/@types/node) | `^22.0.0` | TypeScript type declarations for Node.js 22. |

### Built-in Node.js Engines (Zero-install)
- `node:sqlite`: Built-in SQLite3 engine with Write-Ahead Logging (WAL) and atomic transactions.
- `node:crypto`: Cryptographic functions and `randomUUID()` generator.

---

## 🎨 4. Frontend Client Dependencies (`client/package.json`)

Modern Single Page Application built with React 18, Vite, Tailwind CSS, and Zustand.

### Production Dependencies
| Package | Version | Purpose |
| :--- | :--- | :--- |
| [`react`](https://www.npmjs.com/package/react) | `^18.3.1` | Core React UI library. |
| [`react-dom`](https://www.npmjs.com/package/react-dom) | `^18.3.1` | React DOM renderer. |
| [`zustand`](https://www.npmjs.com/package/zustand) | `^4.5.4` | Fast, lightweight state store for POS carts, slots, and active documents. |
| [`lucide-react`](https://www.npmjs.com/package/lucide-react) | `^0.395.0` | Icon set for POS, navigation, dashboard, and modals. |
| [`qrcode.react`](https://www.npmjs.com/package/qrcode.react) | `^3.1.0` | Generates standard NPCI-compliant dynamic UPI QR payment codes. |

### Development Dependencies
| Package | Version | Purpose |
| :--- | :--- | :--- |
| [`vite`](https://www.npmjs.com/package/vite) | `^5.3.1` | High-speed frontend build tool and dev server. |
| [`@vitejs/plugin-react`](https://www.npmjs.com/package/@vitejs/plugin-react) | `^4.3.1` | Official Vite React plugin with Fast Refresh support. |
| [`typescript`](https://www.npmjs.com/package/typescript) | `^5.4.5` | TypeScript compiler for frontend types. |
| [`tailwindcss`](https://www.npmjs.com/package/tailwindcss) | `^3.4.4` | Utility-first CSS styling framework. |
| [`postcss`](https://www.npmjs.com/package/postcss) | `^8.4.39` | CSS post-processing pipeline. |
| [`autoprefixer`](https://www.npmjs.com/package/autoprefixer) | `^10.4.19` | Cross-browser CSS prefixing. |
| [`@types/react`](https://www.npmjs.com/package/@types/react) | `^18.3.3` | React TypeScript typings. |
| [`@types/react-dom`](https://www.npmjs.com/package/@types/react-dom) | `^18.3.0` | React DOM TypeScript typings. |

---

## 🚀 Quick Setup & Installation

To install all dependencies across the entire project in one go:

```bash
# 1. Install root dependencies
npm install

# 2. Install server dependencies
cd server && npm install && cd ..

# 3. Install client dependencies
cd client && npm install && cd ..
```

### Starting Development Mode
```bash
npm run dev
```

### Compiling Production Release
```bash
npm run build
```
