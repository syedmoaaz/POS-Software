# Phase 7 — Sales, Checkout, Payments, Returns

**Status:** Complete  
**Date:** 2026-08-11

## Delivered

### Models
- `Sale` (+ embedded items & payments)
- `HeldSale`
- `Return`
- `RegisterSession`
- `Counter` (atomic receipt / return numbers)

### Checkout (`POST /api/v1/sales/checkout`)
- Requires open register session
- Idempotency via `Idempotency-Key` header (replay-safe)
- Atomic sale + stock movements + cash drawer totals
- Split payments, change calculation
- Min-price and permission checks (discount / price override)
- Fallback when MongoDB is not a replica set (local standalone)

### Sales
- List / get / by-receipt
- Hold / resume / delete held carts

### Returns (`POST /api/v1/returns`)
- Partial/full return
- Restock / damaged / discard dispositions
- Refund payment matching
- Register cash refund tracking

### Register sessions
- Open / current / cash-in / cash-out / close
- X report and Z report

## Verified smoke test
- Checkout `GUL-01-000001` (Bread ×2)
- Idempotent replay OK
- Return `RET-000001`
- X report sale count / gross OK

## Next
Phase 8 — Purchasing, suppliers, customers, credit, expenses
