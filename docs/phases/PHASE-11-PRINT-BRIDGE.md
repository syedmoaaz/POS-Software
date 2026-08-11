# Phase 11 — Print Bridge & Hardware

**Status:** Complete  
**Date:** 2026-08-11

## Delivered

### API
- Models: `HardwareDevice`, `PrintJob`
- Permissions: `hardware.manage`, `hardware.print_test`
- Routes:
  - `GET/POST/PATCH/DELETE /api/v1/hardware/devices`
  - `POST /api/v1/hardware/devices/:id/rotate-token`
  - `GET/POST /api/v1/print-jobs`
  - `GET /api/v1/print-jobs/:id`
  - `POST /api/v1/print-jobs/:id/status`
  - `POST /api/v1/print-jobs/:id/retry`
  - `POST /api/v1/registers/:registerId/open-drawer` (audited)

### Print bridge (`apps/print-bridge`)
- Localhost Express agent on `127.0.0.1:9100`
- Token auth (`X-Bridge-Token`)
- ESC/POS builders for **58mm** and **80mm**
- Drawer kick (`ESC p`)
- Modes: `simulate` (writes `.bin` under `.output/`) or `network` TCP
- Endpoints: `/health`, `/status`, `/print`, `/test`, `/drawer/open`, `/jobs`

### Web
- `/settings/printers` — bridge URL/token, test print, open drawer
- POS receipt dialog → local bridge print
- Client helper: `src/lib/print-bridge.ts`

### Seed
- Default Gulshan printer + drawer linked to Counter 1
- Bridge token: `mms-dev-bridge-token`

## Run
```bash
pnpm dev:bridge   # or pnpm --filter @mms/print-bridge dev
```

## Verified smoke test
- Bridge health OK (simulate)
- Devices listed (printer + drawer)
- Print job created + test page done
- Drawer kick job + bridge drawer done
- 58mm receipt simulated OK

## Next
Phase 12 — Testing, security, performance, deployment
