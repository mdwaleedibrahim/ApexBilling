/**
 * index.ts - Fastify Server Entry Point (Port 54321)
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import staticPlugin from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db/database.js';
import { billingRoutes } from './routes/billing.routes.js';
import { customerRoutes } from './routes/customer.routes.js';
import { inventoryRoutes } from './routes/inventory.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 54321;

const app = Fastify({ logger: { level: 'info' } });

// ── Plugins ────────────────────────────────────────────────────────────────
await app.register(cors, { origin: true });

// Serve built React app from server/public
const publicDir = path.join(__dirname, '..', 'public');
await app.register(staticPlugin, { root: publicDir, prefix: '/' });

// ── API Routes ─────────────────────────────────────────────────────────────
await app.register(billingRoutes);
await app.register(customerRoutes);
await app.register(inventoryRoutes);
await app.register(dashboardRoutes);
await app.register(settingsRoutes);

// Health check
app.get('/api/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// SPA fallback — serve index.html for all unmatched routes
app.setNotFoundHandler((_req, reply) => {
  reply.sendFile('index.html');
});

// ── Bootstrap ──────────────────────────────────────────────────────────────
try {
  // Initialize DB on startup
  getDb();

  await app.listen({ port: PORT, host: '127.0.0.1' });
  console.log(`\n  ✅  ApexBill Server running at http://localhost:${PORT}\n`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
