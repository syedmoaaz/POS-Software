# Deployment Guide

## Targets

| App | Host | Notes |
|-----|------|-------|
| `apps/web` | **Vercel** | Static Vite build + SPA rewrites |
| `apps/api` | **Railway** | Node 20+, MongoDB Atlas |
| `apps/print-bridge` | Store PCs | Localhost only — not cloud-hosted |
| MongoDB | **Atlas** (recommended) | Replica set for multi-doc transactions |

## 1. MongoDB Atlas

1. Create cluster (M0+ for staging; M10+ for production).
2. Create DB user; store URI as `MONGODB_URI`.
3. Prefer replica set (required for production transactions; API falls back on standalone).
4. Allow Railway egress IPs / `0.0.0.0/0` only if necessary.

## 2. API on Railway

1. New project → deploy from repo root.
2. Set root directory / start command:
   - Build: `pnpm install && pnpm --filter @mms/api build`
   - Start: `pnpm --filter @mms/api start`
3. Environment variables (see `.env.example`):

```env
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb+srv://...
CORS_ORIGIN=https://your-app.vercel.app
COOKIE_DOMAIN=
ACCESS_TOKEN_SECRET=<openssl rand -hex 32>
REFRESH_TOKEN_SECRET=<openssl rand -hex 32>
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
LOG_LEVEL=info
```

4. Health check path: `/api/v1/health`
5. Run seed once against staging only: `pnpm --filter @mms/api seed` (never with demo passwords in prod).

## 3. Web on Vercel

1. Import monorepo; set root to `apps/web` **or** use:
   - Install: `pnpm install`
   - Build: `pnpm --filter @mms/web build`
   - Output: `apps/web/dist`
2. Env:

```env
VITE_API_URL=https://your-api.up.railway.app
```

3. SPA rewrites are in `apps/web/vercel.json` (`/(.*) → /index.html`).
4. Ensure API `CORS_ORIGIN` includes the Vercel domain (preview + production).

## 4. Print bridge (in-store)

```bash
pnpm --filter @mms/print-bridge start
```

Set a strong `BRIDGE_TOKEN`. Keep `BRIDGE_MODE=network` only on LAN printers. Do not publish port 9100 to the internet.

## 5. Post-deploy smoke

1. `GET /api/v1/health` → 200  
2. Login owner → cookies set  
3. Open register → checkout with Idempotency-Key  
4. `/reports/dashboard`  
5. Optional: `node scripts/checkout-load.mjs` against staging  

See also [production-runbook.md](./production-runbook.md) and [security-checklist.md](./security-checklist.md).
