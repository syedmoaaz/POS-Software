# Phased Implementation Plan

Each phase ends with: lint + typecheck (+ tests when present), runnable app, written summary, files changed, open decisions, test steps.

---

## Phase 0 — Requirements confirmation & architecture ✅ (this document set)

**Deliverables**
- Architecture overview
- Database relationship plan
- Folder structure
- Permission matrix
- API module list
- Page/navigation map
- This phased plan

**Exit criteria:** Product owner approves plan + supplies logo + confirms decisions listed in README plan summary.

---

## Phase 1 — Design system, auth screens, application shell

**Scope**
- Monorepo scaffold (`pnpm` + Turborepo): `apps/web`, `packages/shared`
- Tailwind + shadcn/ui + brand tokens from logo
- Auth screens: login, PIN, forgot/reset (UI + mock submit)
- Tenant shell: sidebar, top bar, branch selector, command palette, notifications, user menu
- Super Admin shell scaffold (empty dashboard frame)
- Theme: light commercial POS (not generic purple AI look)
- Responsive breakpoints; usable at 1366×768

**Exit:** Navigate shell with mock user; auth flows show success states without backend.

---

## Phase 2 — Frontend POS prototype (mock data)

**Scope**
- Full POS: grid/list, categories, search, barcode keyboard wedge, cart, variants, qty, discounts, notes
- Hold/resume, multi-park carts, price override gated in UI
- Checkout: multi-tender, change calc, split pay
- Stock warnings, negative-stock rule flag
- Keyboard shortcuts, touch targets, fullscreen checkout
- Cart persistence (localStorage/IndexedDB mock)
- Receipt preview modal (58/80mm layout mock)

**Exit:** Complete a mock sale end-to-end in UI.

---

## Phase 3 — Products, inventory, customers, suppliers, purchases, reports (frontend)

**Scope**
- All catalogue, inventory, purchasing, customer, expense, register, sales history, returns, report pages
- Realistic mock datasets + working filters/tables/forms
- Dashboard with charts (mock)
- Permission-aware UI (mock role switcher for demo)

**Exit:** Entire tenant IA clickable with coherent mock domain data.

---

## Phase 4 — Super Admin frontend

**Scope**
- Admin metrics, tenants CRUD UI, plans, subscriptions, suspend/activate, notes, audit log viewer, health
- Clear visual separation from tenant app

**Exit:** Admin journeys completable on mocks.

---

## ⏸ GATE: Frontend prototype approval

No production backend work until written approval.

---

## Phase 5 — Backend foundation

**Scope**
- `apps/api` Express + Mongoose + env validation + logger + error handler
- Auth cookies, refresh, password hashing, rate limits, helmet, CORS
- Tenant middleware, RBAC middleware
- Models: Tenant, User, Role, Branch, Register, AuditLog, Subscription*
- Seed: demo tenant + super admin
- OpenAPI stub

---

## Phase 6 — Product & inventory APIs

**Scope**
- Catalogue CRUD, barcodes, branch inventory, movements, adjustments, counts, transfers
- Indexes + transactions for stock updates

---

## Phase 7 — Sales, checkout, payments, returns

**Scope**
- Checkout atomic transaction + idempotency
- Held sales, payments, returns/refunds
- Register session hooks for cash

---

## Phase 8 — Purchasing, suppliers, customers, credit, expenses

**Scope**
- Full modules + ledgers + payables/receivables

---

## Phase 9 — Reports & analytics

**Scope**
- Aggregation pipelines, export endpoints, profit gating

---

## Phase 10 — Offline mode & sync

**Scope**
- PWA, IndexedDB, queue, sync API, conflict UI

---

## Phase 11 — Print bridge & hardware

**Scope**
- `apps/print-bridge`, ESC/POS 58/80mm, drawer kick, test print, job status

---

## Phase 12 — Testing, security, performance, deployment

**Scope**
- Unit/integration/e2e (login, checkout, returns, purchases, tenant isolation)
- Security checklist, load pass on checkout
- Vercel + Railway docs, `.env.example`, production runbook

---

## Prototype-first sequencing (immediate next work after approval)

```
Phase 0 (done as docs)
    → Phase 1 (design system + shell)
    → Phase 2 (POS)
    → Phase 3 (remaining tenant modules)
    → Phase 4 (super admin)
    → STOP for review
```

Backend phases 5–12 start only after approval.
