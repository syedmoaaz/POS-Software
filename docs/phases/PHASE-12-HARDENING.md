# Phase 12 — Testing, Security, Performance, Deployment

**Status:** Complete  
**Date:** 2026-08-11

## Delivered

### Tests
- Vitest + Supertest for `@mms/api`
- Shared money unit tests (`packages/shared`)
- Integration coverage:
  - Auth login / me / unauthorized
  - Checkout + idempotency + return
  - Tenant isolation (products + cross-tenant checkout blocked)
  - Purchase receive
  - Password hash/verify
- Faster bcrypt rounds when `NODE_ENV=test`
- Checkout load script: `pnpm load:checkout` (`scripts/checkout-load.mjs`)

### Security & ops docs
- [docs/security-checklist.md](../security-checklist.md)
- [docs/deployment.md](../deployment.md) — Vercel web + Railway API + Atlas + print bridge
- [docs/production-runbook.md](../production-runbook.md)
- Expanded root `.env.example`
- `apps/web/vercel.json` SPA rewrites + basic security headers

### Scripts
```bash
pnpm test
pnpm typecheck
pnpm load:checkout
```

## Verified
- Shared: 2 tests passed
- API: 8 tests passed
- Typecheck clean across packages
- Checkout load pass: **20/20 OK** @ concurrency 5 (avg ~132ms, p95 ~154ms)
- Fixed Sale `offlineId` unique index (partial filter) so online checkouts are not blocked by `null` duplicates

## Roadmap complete
Phases 0–12 are delivered. Remaining work is production wiring (wire web fully to API), CI pipeline, and real-device printer validation.
