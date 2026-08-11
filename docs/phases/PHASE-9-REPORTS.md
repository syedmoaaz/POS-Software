# Phase 9 — Reports & Analytics

**Status:** Complete  
**Date:** 2026-08-11

## Delivered

### Module
- `apps/api/src/modules/reports/reports.helpers.ts` — date range, ObjectId match, CSV helper
- `apps/api/src/modules/reports/reports.routes.ts` — aggregation endpoints
- Mounted at `/api/v1/reports`

### Endpoints

| Method | Path | Permission |
|--------|------|------------|
| GET | `/reports/dashboard` | `reports.sales` |
| GET | `/reports/sales` | `reports.sales` |
| GET | `/reports/sales-by-product` | `reports.sales` |
| GET | `/reports/sales-by-category` | `reports.sales` |
| GET | `/reports/sales-by-cashier` | `reports.sales` |
| GET | `/reports/payments` | `reports.sales` |
| GET | `/reports/profit` | `reports.profit` |
| GET | `/reports/inventory/valuation` | `reports.inventory` |
| GET | `/reports/inventory/low-stock` | `reports.inventory` |
| GET | `/reports/purchases` | `reports.purchases` |
| GET | `/reports/payables` | `reports.purchases` |
| GET | `/reports/receivables` | `reports.sales` |
| GET | `/reports/expenses` | `expenses.view` |
| GET | `/reports/tax` | `reports.sales` |
| GET | `/reports/returns` | `reports.sales` |
| GET | `/reports/employees` | `reports.sales` |
| GET | `/reports/registers` | `reports.sales` |
| GET | `/reports/export?type=&format=csv` | `reports.export` (+ profit gate) |

Common query params: `from`, `to` (ISO), `branchId`.

### Notes
- Dashboard hides `todayProfitMinor` unless caller has `reports.profit`
- Profit / COGS uses sale line `costMinor × qty`
- Export types: `sales`, `payments`, `profit`, `purchases`, `payables`, `receivables`, `expenses`, `inventory`

## Verified smoke test
- Checkout `GUL-01-000001` → dashboard today sales / profit
- Sales, by-product, profit, payables, receivables, inventory valuation, purchases, expenses
- CSV export header + row
- Cashier blocked from `/reports/profit` (403)

## Next
Phase 10 — Offline mode & sync
