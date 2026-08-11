# Database Relationship Plan

## Design principles

- Multi-tenant: every business document has `tenantId`.
- Branch-scoped: inventory, sales, register sessions, expenses, stock docs include `branchId`.
- Monetary fields: `Decimal128` or integer minor units (prefer **integer minor units** in app layer, store as `Number` Int64-safe or `Long`; recommend `amountMinor: number` with Zod int validation + shared Money type).
- Soft delete via `deletedAt` where history matters.
- Stock truth = **StockMovement** ledger; `BranchInventory.qty*` fields are projections updated in the same transaction.
- Receipt numbers generated atomically (counters collection per tenant/branch/register).

---

## Entity relationship (logical)

```
SubscriptionPlan 1──* Subscription *──1 Tenant
Tenant 1──* Branch 1──* Register 1──* RegisterSession
Tenant 1──* Role 1──* Permission (embedded keys or join)
Tenant 1──* User *──* Role (or primary role + overrides)
Tenant 1──* Category / Brand / Unit / Product / ProductVariant / Barcode
Branch 1──* BranchInventory *──1 ProductVariant
Tenant 1──* StockMovement / StockCount / StockTransfer
Tenant 1──* Supplier / PurchaseOrder / Purchase / SupplierPayment
Tenant 1──* Customer / CustomerLedger / LoyaltyTransaction
Branch 1──* Sale 1──* SaleItem ; Sale 1──* Payment
Sale 1──0..* Return
Branch 1──* HeldSale / Expense
Tenant 1──* AuditLog / Notification / HardwareDevice / PrintJob
```

---

## Core models (fields summary)

### Platform

**Tenant**  
`name`, `slug`, `status` (trial|active|suspended|cancelled), `logoUrl`, `timezone`, `currency`, `locale`, `taxSettings`, `receiptSettings`, `featureFlags`, `limits`, `branding`, `createdAt`

**SubscriptionPlan**  
`code`, `name`, `priceMinor`, `interval`, `limits` (branches, users, products, registers), `features[]`, `active`

**Subscription**  
`tenantId`, `planId`, `status`, `trialEndsAt`, `currentPeriodStart/End`, `cancelAt`, `notes`

### Org structure

**Branch**  
`tenantId`, `name`, `code`, `address`, `phone`, `isActive`, `settings`

**Register**  
`tenantId`, `branchId`, `name`, `code`, `isActive`, `printerDeviceId?`

**RegisterSession**  
`tenantId`, `branchId`, `registerId`, `openedBy`, `closedBy?`, `openingCashMinor`, `closingCashMinor?`, `expectedCashMinor?`, `varianceMinor?`, `status` (open|closed), `blindClose`, `openedAt`, `closedAt?`

### Identity & RBAC

**User**  
`tenantId?` (null for SaaS super admins), `email`, `passwordHash`, `pinHash?`, `name`, `phone`, `roleIds[]`, `branchIds[]`, `status`, `mfaEnabled`, `lastLoginAt`

**Role**  
`tenantId?`, `key`, `name`, `isSystem`, `permissions: string[]`

**Permission** (catalog, can be code constants rather than collection)  
Keys like `sales.create`, `sales.refund`, `inventory.adjust`, `reports.profit`, `settings.manage`, `drawer.open`, …

**AuditLog**  
`tenantId?`, `actorUserId`, `action`, `entityType`, `entityId`, `meta`, `ip`, `requestId`, `createdAt`

### Catalogue

**Category** — nested via `parentId`  
**Brand**, **Unit** (`piece|kg|g|l|box|pack|custom`)  
**Product** — `name`, `description`, `categoryId`, `brandId`, `unitId`, `taxCategory`, `trackBatch`, `isWeighted`, `isComposite`, `components[]`, `status`, `images[]`  
**ProductVariant** — `sku`, `attributes` (size/color/…), `costMinor`, `retailPriceMinor`, `wholesalePriceMinor`, `minPriceMinor`, `reorderLevel`, `preferredSupplierId?`  
**Barcode** — `tenantId`, `variantId`, `code`, `isPrimary`

### Inventory

**BranchInventory**  
`tenantId`, `branchId`, `variantId`, `qtyOnHand`, `qtyReserved`, `qtyDamaged`, `qtyExpired`, `avgCostMinor`

**StockMovement**  
`tenantId`, `branchId`, `variantId`, `type` (opening|purchase|sale|sale_return|purchase_return|adjust|damage|transfer_out|transfer_in|count), `qtyDelta`, `unitCostMinor?`, `refType`, `refId`, `note`, `createdBy`, `createdAt`

**StockCount** — lines with expected vs counted, variance, status  
**StockTransfer** — `fromBranchId`, `toBranchId`, status (draft|approved|dispatched|received|cancelled), lines

### Suppliers / Purchasing

**Supplier** — profile + `balanceMinor` projection  
**PurchaseOrder** — status draft|ordered|partial|received|cancelled  
**Purchase** — receiving / invoice, lines, costs, expenses  
**SupplierPayment** — method, amount, refs; ledger entry

### Customers

**Customer** — contact, group, creditLimitMinor, storeCreditMinor, loyaltyPoints, pricingTier  
**CustomerLedger** — type (sale|payment|credit|advance|adjustment), amountMinor, balanceAfter, ref  
**LoyaltyTransaction** — earn/redeem

### Sales

**Sale**  
`receiptNo`, `status` (completed|void|returned|partial_return), `customerId?`, `cashierId`, `registerId`, `registerSessionId`, `subtotalMinor`, `discountMinor`, `taxMinor`, `totalMinor`, `paidMinor`, `changeMinor`, `paymentStatus`, `notes`, `idempotencyKey`, `offlineId?`, `soldAt`

**SaleItem** — variant, qty (decimal allowed for weighted), prices, discounts, tax, notes  
**Payment** — method (cash|card|transfer|wallet|store_credit|customer_credit), amountMinor, reference, notes  
**HeldSale** — parked cart JSON + metadata  
**Return** — links to sale, lines, restock disposition, refund payments, approval

### Ops

**Expense** — category, branch/register optional, amount, method, attachment, approval  
**Notification** — user/tenant scoped  
**HardwareDevice** — type printer|scanner|drawer, connection meta, bridgeId  
**PrintJob** — payload, status queued|sent|failed|done, retries  
**Counter** — `{ tenantId, branchId, registerId?, key: 'receipt'|'po'|…, seq }` for atomic numbering

---

## Index plan (compound)

| Collection | Indexes |
|------------|---------|
| products/variants | `{tenantId, sku}`, `{tenantId, status}` |
| barcodes | `{tenantId, code}` unique |
| branchInventories | `{tenantId, branchId, variantId}` unique |
| stockMovements | `{tenantId, branchId, variantId, createdAt}`, `{tenantId, refType, refId}` |
| sales | `{tenantId, branchId, soldAt}`, `{tenantId, receiptNo}` unique, `{tenantId, idempotencyKey}` unique |
| customers | `{tenantId, phone}`, `{tenantId, name}` text/search |
| suppliers | `{tenantId, name}` |
| purchases/POs | `{tenantId, branchId, status, createdAt}` |
| registerSessions | `{tenantId, registerId, status}` |
| users | `{email}` unique global or `{tenantId, email}` |
| auditLogs | `{tenantId, createdAt}`, `{actorUserId, createdAt}` |

---

## Transaction boundaries (must be atomic)

1. Checkout: sale + payments + stock movements + inventory projections + register cash entry + customer ledger + receipt counter.  
2. Refund/return: return doc + stock + payments + ledger + sale status.  
3. Purchase receive: purchase lines + stock + avg cost update + supplier ledger.  
4. Stock transfer receive/dispatch.  
5. Register open/close.

Use MongoDB multi-document transactions (replica set / Atlas).

---

## Tenant resolution

```
Request → auth middleware → session.user
  → if superAdmin & impersonating: tenantId from impersonation grant
  → else tenantId from user.tenantId
  → attach to req.ctx
Services always filter: { tenantId: ctx.tenantId, ... }
```
