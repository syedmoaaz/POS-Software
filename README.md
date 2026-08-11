# Mega Modern Solutions POS

Multi-tenant retail Point of Sale SaaS by **Mega Modern Solutions**.

## Status

Phases **0–12** complete (architecture → frontend prototype → backend → offline → print bridge → tests/deploy docs).

## Quick start

```bash
pnpm install
cp .env.example .env   # if needed
pnpm seed              # demo tenant + catalogue into MongoDB
pnpm dev:api           # http://localhost:4000
pnpm dev:web           # http://localhost:5173
pnpm dev:bridge        # http://127.0.0.1:9100 (optional)
```

Or `pnpm dev:all` for web + api + print-bridge.

### Demo logins

| Role | Email | Password |
|------|-------|----------|
| Business owner | owner@karachimart.demo | demo1234 |
| Cashier | cashier@karachimart.demo | demo1234 (PIN `1234`) |
| Super admin | admin@megamodern.solutions | demo1234 |

API health: http://localhost:4000/api/v1/health

## Quality gates

```bash
pnpm typecheck
pnpm test                 # shared unit + API integration (needs local Mongo)
pnpm load:checkout        # optional checkout load pass (API must be seeded & running)
```

## Docs

| Doc | Path |
|-----|------|
| Plan | [PLAN.md](./PLAN.md) |
| Architecture | [docs/architecture/](./docs/architecture/) |
| Phase notes | [docs/phases/](./docs/phases/) |
| API index | [docs/api/README.md](./docs/api/README.md) |
| Security checklist | [docs/security-checklist.md](./docs/security-checklist.md) |
| Deployment (Vercel + Railway) | [docs/deployment.md](./docs/deployment.md) |
| Production runbook | [docs/production-runbook.md](./docs/production-runbook.md) |

## Theme

White + red (`#E00818`) from the official Mega Modern Solutions logo.
