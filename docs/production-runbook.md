# Production Runbook

## Services

| Service | URL / location | Owner |
|---------|----------------|-------|
| Web | Vercel production domain | |
| API | Railway service URL | |
| DB | MongoDB Atlas | |
| Print bridge | Each store POS PC (`127.0.0.1:9100`) | Store IT |

## Routine checks

Morning / on-call:
1. API health `GET /api/v1/health`
2. Atlas metrics (connections, disk, opcounters)
3. Railway / Vercel error rates
4. Failed offline sync queue volume (if cashiers report issues)

## Deploy

1. Merge to main after CI (`pnpm typecheck`, `pnpm test`)
2. Railway auto-deploys API; confirm health
3. Vercel auto-deploys web; confirm login
4. Tick [security-checklist.md](./security-checklist.md) for secret/CORS changes

Rollback: redeploy previous Railway/Vercel deployment; Atlas point-in-time restore only if data corruption.

## Incidents

### API down
1. Check Railway logs + Atlas connectivity
2. Confirm `MONGODB_URI` / IP allowlist
3. Scale or restart Railway service
4. Communicate POS offline mode: cashiers can queue sales locally

### Auth / cookie failures after deploy
1. Verify `CORS_ORIGIN` matches exact web origin(s)
2. Verify `Secure` cookies need HTTPS on both sides
3. Clear stale cookies; check `COOKIE_DOMAIN`

### Checkout failures / stock errors
1. Inspect API logs for `STOCK_SHORT`, `REGISTER_CLOSED`, `IDEMPOTENCY`
2. Confirm register session open
3. For transaction errors on standalone Mongo, migrate to Atlas replica set

### Print bridge offline
1. Confirm process on store PC (`pnpm --filter @mms/print-bridge start`)
2. Token mismatch → Settings → Printers
3. Simulate mode writes `.output/*.bin` — switch to `BRIDGE_MODE=network` for live printers

## Backups

- Atlas continuous backup / PITR enabled on production
- Test restore quarterly into a scratch cluster

## Contacts

| Role | Contact |
|------|---------|
| On-call eng | |
| Store ops | |
| Mega Modern Solutions admin | |
