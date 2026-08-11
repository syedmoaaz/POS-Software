# Mega Modern Solutions POS — Product Architecture Overview

**Product name:** Mega Modern Solutions POS  
**Delivery model:** Multi-tenant SaaS for independent retail shops  
**Stack:** TypeScript MERN (React/Vite + Express + MongoDB) monorepo  
**Status:** Greenfield repository (empty). Planning phase only.

---

## 1. Goals

- Sell a production-ready POS to many retail businesses with **strict tenant isolation**.
- Support multi-branch operations, registers, inventory, purchasing, credit, and reporting.
- Deliver a premium commercial UI aligned with the Mega Modern Solutions brand.
- Keep every phase **runnable and stable**; no dead UI or unfinished actions in shipped screens.
- Build **frontend prototype with mock data first**, then backend after explicit approval.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Clients                                         │
│  Web App (Vercel)  │  PWA Offline  │  Print Bridge (Electron/local)     │
└────────────┬───────────────────┬───────────────────┬────────────────────┘
             │ HTTPS             │ IndexedDB sync    │ localhost WS/HTTP
             ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    API Gateway / Express (Railway)                        │
│  /api/v1  · Helmet · CORS · Rate limit · Request ID · Zod validation     │
└────────────┬────────────────────────────────────────────────────────────┘
             │
     ┌───────┼───────────────┬──────────────────┐
     ▼       ▼               ▼                  ▼
 Auth/Session   Tenant Context   Domain Services   Jobs/Webhooks
 JWT cookies    from session     controllers →     sync, reminders
 refresh/rot.   NEVER from body  services → repos
     │               │               │
     └───────────────┴───────────────┘
                     ▼
            MongoDB Atlas (tenantId on every tenant record)
            Cloudinary / S3 (images)
            Structured logs
```

### Isolation rules (non-negotiable)

1. Every tenant-owned document includes `tenantId`.
2. Branch-scoped documents also include `branchId`.
3. `tenantId` is resolved from the authenticated session — **never trusted from the client body/query**.
4. Super Admin portal uses separate routes, guards, and UI shell from tenant apps.
5. Impersonation (if enabled) is short-lived, audited, and requires Super Admin confirmation.

---

## 3. Applications & Packages

| Path | Purpose |
|------|---------|
| `apps/web` | Tenant app + Super Admin portal (route-separated) |
| `apps/api` | Express REST API `/api/v1` |
| `apps/print-bridge` | Local Electron/Node agent for ESC/POS + cash drawer |
| `packages/shared` | Zod schemas, types, permission keys, money helpers, constants |
| `packages/eslint-config` | Shared ESLint |
| `packages/tsconfig` | Shared TS configs |
| `docs/` | Architecture, phases, deployment, security |

**Monorepo tooling:** pnpm workspaces + Turborepo (recommended).

---

## 4. Money, Time, Identity

| Concern | Decision |
|---------|----------|
| Money | Integer **minor units** (paisa for PKR). Helpers in `packages/shared`. Never `number` floats for money in domain logic. |
| Dates | Store UTC (`Date` / ISO). Display via tenant timezone (`Asia/Karachi` default). |
| IDs | MongoDB ObjectId primary; business keys (SKU, receiptNo) unique per tenant/branch scope. |
| Soft delete | `deletedAt` on financial/master records; never hard-delete finalized sales/payments/stock movements. |

---

## 5. Auth Model

- Access token (short) + refresh token (long) in **HTTP-only Secure cookies**.
- Password hashing: **Argon2id** (bcrypt fallback only if env constraint).
- Optional employee **PIN login** scoped to register/terminal (rate-limited).
- Optional **2FA** for Business Owners.
- Session revocation list / version bump on password change.
- Login history + audit trail for sensitive actions.

---

## 6. Offline Strategy (Phase 11)

- PWA + IndexedDB: products/prices cache, cart, offline sale queue.
- Local UUID for offline sales → server assigns official receipt number on sync.
- Idempotency keys on checkout + sync.
- UI shows online/offline and “stock may be stale” banners.
- Failed-sync review screen for cashiers/managers.

---

## 7. Hardware Strategy (Phase 12)

- Browser print = fallback only.
- ESC/POS + drawer kick via **local print bridge** (`apps/print-bridge`).
- Web app talks to bridge on `localhost` with a device pairing token.
- Do not claim browsers can reliably drive all USB printers/drawers directly.

---

## 8. Deployment Targets

| Component | Host |
|-----------|------|
| `apps/web` | Vercel |
| `apps/api` | Railway |
| MongoDB | Atlas |
| Media | Cloudinary or S3-compatible |
| Print bridge | Installed on store PCs |

---

## 9. Branding

- Official logo: `brand/mega-modern-solutions-logo.jpeg`
- Theme locked: **white + red** (brand red `#E00818`) — see `docs/brand/THEME.md`
- Premium commercial POS look: dense operational screens, calm reporting screens
- Avoid generic purple-gradient / AI-dashboard aesthetics; no default dark mode

---

## 10. Build Sequence Gate

1. **This plan** → review & approve key decisions.  
2. **Frontend prototype** (mock data, complete navigable UI) → review.  
3. **Backend & integrations** only after frontend approval.
