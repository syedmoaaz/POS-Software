# POS Software

Multi-tenant retail Point of Sale (SaaS) monorepo — TypeScript throughout.

## How it’s built

| Part | Stack |
|------|--------|
| `apps/web` | React + Vite + Tailwind — POS, back office, super admin |
| `apps/api` | Express + Mongoose — auth, sales, stock, reports, sync |
| `apps/print-bridge` | Local Node agent — ESC/POS receipts + cash drawer |
| `packages/shared` | Shared money helpers + permissions |
| Data | MongoDB (PKR as integer minor units) |
| Auth | JWT in HTTP-only cookies, role permissions |

pnpm workspaces. Web → Vercel, API → Railway, bridge runs on the store PC only.

## How it works

**Online sale:** cashier opens a register session → scans or searches products → checkout hits the API (idempotent) → stock updates → optional print via localhost bridge.

**Offline:** PWA caches the app shell; IndexedDB holds catalogue + a sale queue. When the network returns, `POST /sync/sales` uploads queued sales and assigns real receipt numbers. Review failures at `/pos/offline-queue`.

**Hardware:** the browser cannot drive thermal printers reliably. The print bridge on `127.0.0.1:9100` accepts print/drawer requests with a pairing token and sends ESC/POS (58/80mm) or simulates to `.bin` files.

**Tenancy:** every API call is scoped by `tenantId` from the session (never from the client body). Super admin manages tenants separately under `/admin`.

> Note: the web UI still uses mock data in many screens; the API is fully implemented and tested. Wiring the UI to live APIs is the next product step.

## Quick start

```bash
pnpm install
cp .env.example .env
# start MongoDB locally, then:
pnpm seed
pnpm dev:api      # http://localhost:4000
pnpm dev:web      # http://localhost:5175
pnpm dev:bridge   # http://127.0.0.1:9100 (optional)
```

Or `pnpm dev:all`.

### Demo logins (password `demo1234`)

| Role | Email |
|------|--------|
| Owner | owner@karachimart.demo |
| Cashier | cashier@karachimart.demo (PIN `1234`) |
| Super admin | admin@megamodern.solutions |

## Scripts

```bash
pnpm typecheck
pnpm test
pnpm load:checkout   # needs seeded API running
```

## Docs

- Architecture: [`docs/architecture/`](./docs/architecture/)
- API: [`docs/api/README.md`](./docs/api/README.md)
- Deploy: [`docs/deployment.md`](./docs/deployment.md)
- Security: [`docs/security-checklist.md`](./docs/security-checklist.md)
- Phases: [`docs/phases/`](./docs/phases/)
