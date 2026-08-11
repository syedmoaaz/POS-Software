# Phase 6 — Products & Inventory APIs

**Status:** Complete  
**Date:** 2026-08-11

## Delivered

### Models
- Category, Brand, Unit
- Product, ProductVariant, Barcode
- BranchInventory, StockMovement, StockCount, StockTransfer

### Stock engine
- `applyStockMovement()` updates ledger + inventory projection together
- MongoDB transactions via `withTransaction()`
- Weighted average cost on inbound stock
- Negative-stock guard (configurable per adjustment)

### Catalogue routes (`/api/v1`)
- `GET/POST /categories`, `/brands`, `/units`
- `GET/POST/PATCH/DELETE /products`
- `GET /products/search` (name / SKU / barcode)
- `PATCH /products/variants/:id`
- `POST /products/variants/:id/barcodes`
- Cost fields stripped without `products.cost.view`

### Inventory routes (`/api/v1/inventory`)
- `GET /` branch stock
- `GET /movements` ledger
- `GET /alerts/low-stock`
- `POST /adjustments`, `POST /opening`
- `GET/POST /counts`, line update, complete (posts count variances)
- `GET/POST /transfers` + approve / dispatch / receive

### Seed
- 7 demo products with barcodes and Gulshan opening stock

## Verify

```bash
pnpm seed
pnpm dev:api
```

Login as owner, then:
- `GET /api/v1/products`
- `GET /api/v1/products/search?q=8901058846120`
- `GET /api/v1/inventory?branchId=<gulshanId>`

## Next

Phase 7 — Sales, checkout, payments, returns
