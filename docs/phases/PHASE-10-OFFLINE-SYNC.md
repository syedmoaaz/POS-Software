# Phase 10 — Offline Mode & Sync

**Status:** Complete  
**Date:** 2026-08-11

## Delivered

### Sync API (`/api/v1/sync`)
| Method | Path | Notes |
|--------|------|-------|
| GET | `/sync/status` | Server time + offline features |
| GET | `/sync/catalogue?branchId=&since=` | Full or delta catalogue + branch stock |
| POST | `/sync/sales` | Batch offline checkouts (max 50), idempotent |
| GET | `/sync/sales/:offlineId` | Lookup synced sale |

- Sale model: sparse unique index on `(tenantId, offlineId)`
- Checkout accepts `soldAt` + offline replay by `offlineId` / `idempotencyKey`
- Offline sync allows negative stock by default (race-safe), failures returned per row

### Web offline stack
- PWA: `manifest.webmanifest` + `public/sw.js` (shell cache)
- IndexedDB (`mms-pos-offline`): catalogue cache + sale queue
- Sync engine: pull catalogue, enqueue offline sales, flush on online
- POS: offline banner, `OFF-` receipts, queue on offline checkout
- `/pos/offline-queue`: pending/failed/conflict review + pull/sync actions
- Nav: POS → Offline queue

### Env
- Web API base: `VITE_API_URL` (default `http://localhost:4000`)

## Verified smoke test
- `/sync/status` OK
- Catalogue pull: 7 products / variants / inventory
- Offline sale sync → `GUL-01-000002`
- Idempotent replay OK
- Lookup by `offlineId` OK
- Delta catalogue (`full: false`) OK

## Next
Phase 11 — Print bridge & hardware
