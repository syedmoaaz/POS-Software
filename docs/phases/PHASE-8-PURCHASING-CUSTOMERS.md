# Phase 8 — Suppliers, Purchasing, Customers, Credit, Expenses

**Status:** Complete  
**Date:** 2026-08-11

## Delivered

### Models
- `Supplier`, `SupplierLedger`, `PurchaseOrder`, `Purchase`, `SupplierPayment`
- `Customer`, `CustomerLedger`, `LoyaltyTransaction`
- `ExpenseCategory`, `Expense`

### Ledgers (`apps/api/src/lib/ledgers.ts`)
- `postSupplierLedger` — purchase (+), payment (−), adjustments
- `postCustomerLedger` — credit (+), payment/advance (−), optional credit-limit enforcement

### Suppliers & purchasing
| Method | Path |
|--------|------|
| GET/POST | `/api/v1/suppliers` |
| GET | `/api/v1/suppliers/:id` |
| GET | `/api/v1/suppliers/:id/ledger` |
| GET/POST | `/api/v1/purchase-orders` |
| POST | `/api/v1/purchase-orders/:id/order\|cancel` |
| GET | `/api/v1/purchases` |
| POST | `/api/v1/purchases/receive` |
| GET/POST | `/api/v1/supplier-payments` |

Receive flow: GRN number → stock `purchase` movements → supplier payable → optional pay-now → PO qtyReceived / status update.

### Customers & credit
| Method | Path |
|--------|------|
| GET/POST | `/api/v1/customers` |
| GET/PATCH | `/api/v1/customers/:id` |
| GET | `/api/v1/customers/:id/ledger\|statement` |
| POST | `/api/v1/customers/:id/payments` |
| POST | `/api/v1/customers/:id/loyalty` |
| POST | `/api/v1/customers/:id/credit-charge` |

Loyalty / credit gated by tenant `featureFlags.loyalty` and `featureFlags.customerCredit`.

### Expenses
| Method | Path |
|--------|------|
| GET/POST | `/api/v1/expenses/categories` |
| GET/POST | `/api/v1/expenses` |
| POST | `/api/v1/expenses/:id/approve` |

### Seed
- 3 suppliers, 4 customers (incl. walk-in), 5 expense categories

## Verified smoke test
- PO `PO-2026-0001` → ordered → receive `GRN-000001` (partial pay)
- Supplier payment + ledger (`purchase` / `payment`)
- Customer payment (balance 450000 → 400000) + loyalty earn (320 → 330)
- Expense create (approved)

## Next
Phase 9 — Reports & analytics APIs
