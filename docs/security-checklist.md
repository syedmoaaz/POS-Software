# Security Checklist

Use this before every production deploy of Mega Modern Solutions POS.

## Auth & sessions
- [ ] `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` are unique, ≥32 random chars (not repo defaults)
- [ ] Access token TTL short (default 15m); refresh rotation enabled
- [ ] Cookies are `HttpOnly`; in production `Secure` + `SameSite=None` (cross-site) or `Lax` (same-site)
- [ ] `COOKIE_DOMAIN` set only when needed for shared subdomain auth
- [ ] Password change bumps `sessionVersion` / revokes refresh sessions
- [ ] Rate limit on `/api/v1/auth/*` enabled

## Tenant isolation
- [ ] `tenantId` always taken from session (`req.auth.tenantId`), never from client body for scoping
- [ ] Integration test `tenant-isolation` passes
- [ ] Super-admin impersonation is audited

## API hardening
- [ ] Helmet enabled
- [ ] CORS allowlist is production domains only (`CORS_ORIGIN`)
- [ ] JSON body size limited (1mb)
- [ ] Zod validation on mutating routes
- [ ] Idempotency keys required for checkout / sync sales
- [ ] Profit/cost fields gated by `reports.profit` / `products.cost.view`

## Data & secrets
- [ ] MongoDB Atlas network allowlist + strong DB user password
- [ ] No secrets in git (`.env` ignored)
- [ ] Seed/demo passwords disabled or rotated in production
- [ ] Backups enabled (Atlas continuous or scheduled)

## Hardware / bridge
- [ ] Print bridge binds to `127.0.0.1` only
- [ ] Bridge token rotated per store (`BRIDGE_TOKEN` ≠ default in prod)
- [ ] No public exposure of port 9100

## Web / PWA
- [ ] API base URL uses HTTPS (`VITE_API_URL`)
- [ ] Service worker does not cache authenticated API responses
- [ ] CSP / security headers configured at CDN (Vercel) where applicable

## Ops
- [ ] Structured logs without raw tokens/passwords
- [ ] Health endpoint monitored
- [ ] Incident contacts documented in runbook
