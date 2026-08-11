# API Foundation (Phase 5+)

Versioned REST API under `/api/v1`.

## Hardware & print

| Method | Path |
|--------|------|
| GET/POST | `/api/v1/hardware/devices` |
| PATCH/DELETE | `/api/v1/hardware/devices/:id` |
| POST | `/api/v1/hardware/devices/:id/rotate-token` |
| GET/POST | `/api/v1/print-jobs` |
| GET | `/api/v1/print-jobs/:id` |
| POST | `/api/v1/print-jobs/:id/status` |
| POST | `/api/v1/print-jobs/:id/retry` |
| POST | `/api/v1/registers/:registerId/open-drawer` |

Local agent: `apps/print-bridge` on `http://127.0.0.1:9100` (header `X-Bridge-Token`).

## Offline sync

| Method | Path |
|--------|------|
| GET | `/api/v1/sync/status` |
| GET | `/api/v1/sync/catalogue?branchId=&since=` |
| POST | `/api/v1/sync/sales` |
| GET | `/api/v1/sync/sales/:offlineId` |

Batch body: `{ sales: [{ offlineId, idempotencyKey, branchId, registerId, items, payments, soldAt?, … }] }` (max 50). Each row returns `synced` or `failed`.

## Reports

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/reports/dashboard` | `reports.sales` |
| GET | `/api/v1/reports/sales` | `reports.sales` |
| GET | `/api/v1/reports/sales-by-product` | `reports.sales` |
| GET | `/api/v1/reports/sales-by-category` | `reports.sales` |
| GET | `/api/v1/reports/sales-by-cashier` | `reports.sales` |
| GET | `/api/v1/reports/payments` | `reports.sales` |
| GET | `/api/v1/reports/profit` | `reports.profit` |
| GET | `/api/v1/reports/inventory/valuation` | `reports.inventory` |
| GET | `/api/v1/reports/inventory/low-stock` | `reports.inventory` |
| GET | `/api/v1/reports/purchases` | `reports.purchases` |
| GET | `/api/v1/reports/payables` | `reports.purchases` |
| GET | `/api/v1/reports/receivables` | `reports.sales` |
| GET | `/api/v1/reports/expenses` | `expenses.view` |
| GET | `/api/v1/reports/tax` | `reports.sales` |
| GET | `/api/v1/reports/returns` | `reports.sales` |
| GET | `/api/v1/reports/employees` | `reports.sales` |
| GET | `/api/v1/reports/registers` | `reports.sales` |
| GET | `/api/v1/reports/export?type=&format=csv` | `reports.export` |

Query: `from`, `to`, `branchId` (optional). Export `type`: `sales` \| `payments` \| `profit` \| `purchases` \| `payables` \| `receivables` \| `expenses` \| `inventory`.

## Suppliers & purchasing

| Method | Path |
|--------|------|
| GET/POST | `/api/v1/suppliers` |
| GET | `/api/v1/suppliers/:id` |
| GET | `/api/v1/suppliers/:id/ledger` |
| GET/POST | `/api/v1/purchase-orders` |
| POST | `/api/v1/purchase-orders/:id/order` |
| POST | `/api/v1/purchase-orders/:id/cancel` |
| GET | `/api/v1/purchases` |
| POST | `/api/v1/purchases/receive` |
| GET/POST | `/api/v1/supplier-payments` |

## Customers & credit

| Method | Path |
|--------|------|
| GET/POST | `/api/v1/customers` |
| GET/PATCH | `/api/v1/customers/:id` |
| GET | `/api/v1/customers/:id/ledger` |
| GET | `/api/v1/customers/:id/statement` |
| POST | `/api/v1/customers/:id/payments` |
| POST | `/api/v1/customers/:id/loyalty` |
| POST | `/api/v1/customers/:id/credit-charge` |

## Expenses

| Method | Path |
|--------|------|
| GET/POST | `/api/v1/expenses/categories` |
| GET/POST | `/api/v1/expenses` |
| POST | `/api/v1/expenses/:id/approve` |

## Sales & returns

| Method | Path |
|--------|------|
| POST | `/api/v1/sales/checkout` (header `Idempotency-Key`) |
| GET | `/api/v1/sales` |
| GET | `/api/v1/sales/by-receipt/:receiptNo` |
| GET | `/api/v1/sales/:id` |
| GET/POST | `/api/v1/sales/held` |
| POST | `/api/v1/sales/held/:id/resume` |
| DELETE | `/api/v1/sales/held/:id` |
| GET/POST | `/api/v1/returns` |

## Register sessions

| Method | Path |
|--------|------|
| POST | `/api/v1/register-sessions/open` |
| GET | `/api/v1/register-sessions/current?registerId=` |
| POST | `/api/v1/register-sessions/:id/cash-in\|cash-out\|close` |
| GET | `/api/v1/register-sessions/:id` |
| GET | `/api/v1/register-sessions/:id/x-report` |
| GET | `/api/v1/register-sessions/:id/z-report` |

---

## Catalogue

| Method | Path |
|--------|------|
| GET/POST | `/api/v1/categories` |
| GET/POST | `/api/v1/brands` |
| GET/POST | `/api/v1/units` |
| GET/POST | `/api/v1/products` |
| GET | `/api/v1/products/search?q=` |
| GET/PATCH/DELETE | `/api/v1/products/:id` |
| PATCH | `/api/v1/products/variants/:variantId` |
| POST | `/api/v1/products/variants/:variantId/barcodes` |

## Inventory

| Method | Path |
|--------|------|
| GET | `/api/v1/inventory?branchId=` |
| GET | `/api/v1/inventory/movements` |
| GET | `/api/v1/inventory/alerts/low-stock?branchId=` |
| POST | `/api/v1/inventory/adjustments` |
| POST | `/api/v1/inventory/opening` |
| GET/POST | `/api/v1/inventory/counts` |
| POST | `/api/v1/inventory/counts/:id/lines` |
| POST | `/api/v1/inventory/counts/:id/complete` |
| GET/POST | `/api/v1/inventory/transfers` |
| POST | `/api/v1/inventory/transfers/:id/approve\|dispatch\|receive` |

---

## Auth

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/v1/auth/login` | email/password → HTTP-only cookies |
| POST | `/api/v1/auth/login/pin` | PIN (+ optional tenantSlug) |
| POST | `/api/v1/auth/refresh` | rotate refresh |
| POST | `/api/v1/auth/logout` | revoke refresh |
| GET | `/api/v1/auth/me` | current user + tenant context |
| GET | `/api/v1/auth/sessions` | list sessions |
| DELETE | `/api/v1/auth/sessions/:id` | revoke one |
| POST | `/api/v1/auth/change-password` | bumps sessionVersion |

Cookies: `access_token`, `refresh_token` (HTTP-only).

## Context & org

| GET | `/api/v1/context` | tenant, branches, registers, plan, permissions |
| GET/POST | `/api/v1/branches` | tenant-scoped |
| GET/POST | `/api/v1/registers` | tenant-scoped |

## Super admin

| GET | `/api/v1/admin/metrics` |
| GET | `/api/v1/admin/tenants` |
| POST | `/api/v1/admin/tenants/:id/suspend\|activate` |
| POST | `/api/v1/admin/impersonate` | audited |
| GET | `/api/v1/admin/audit-logs` |
| GET | `/api/v1/admin/health` |

## Health

`GET /api/v1/health`

## Isolation rule

`tenantId` is always taken from the authenticated session (`req.auth.tenantId`), never from the request body.
