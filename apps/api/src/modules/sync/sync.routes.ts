import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireTenant } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { AppError, isAppError } from "../../lib/errors.js";
import { Sale } from "../../models/sale.model.js";
import { Product, ProductVariant, Barcode } from "../../models/product.model.js";
import { Category, Brand, Unit } from "../../models/catalogue-meta.model.js";
import { BranchInventory } from "../../models/inventory.model.js";
import { Branch } from "../../models/branch.model.js";
import { checkoutSale, serializeSale } from "../sales/sales.service.js";

export const syncRouter = Router();
syncRouter.use(authenticate, requireTenant);

const paymentSchema = z.object({
  method: z.enum(["cash", "card", "transfer", "wallet", "store_credit", "customer_credit"]),
  amountMinor: z.number().int().nonnegative(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const offlineSaleSchema = z.object({
  offlineId: z.string().min(8).max(80),
  idempotencyKey: z.string().min(8).max(120),
  branchId: z.string().min(1),
  registerId: z.string().min(1),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  notes: z.string().optional(),
  cartDiscountMinor: z.number().int().nonnegative().optional(),
  allowNegativeStock: z.boolean().optional(),
  soldAt: z.string().datetime().optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        qty: z.number().positive(),
        unitPriceMinor: z.number().int().nonnegative().optional(),
        discountMinor: z.number().int().nonnegative().optional(),
        note: z.string().optional(),
      }),
    )
    .min(1),
  payments: z.array(paymentSchema).min(1),
});

syncRouter.get("/status", requirePermission("pos.access"), async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId!;
    const recentOffline = await Sale.countDocuments({
      tenantId,
      offlineId: { $exists: true, $ne: null },
      soldAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      deletedAt: null,
    });

    res.json({
      data: {
        serverTime: new Date().toISOString(),
        features: {
          offlineSales: true,
          catalogueDelta: true,
          allowNegativeStockOffline: true,
        },
        offlineSalesLast24h: recentOffline,
        tenantId,
      },
    });
  } catch (err) {
    next(err);
  }
});

syncRouter.get(
  "/catalogue",
  requirePermission("products.view"),
  validate({
    query: z.object({
      branchId: z.string().min(1),
      since: z.string().datetime().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const branchId = String(req.query.branchId);
      const since = req.query.since ? new Date(String(req.query.since)) : null;

      const branch = await Branch.findOne({ _id: branchId, tenantId, deletedAt: null }).lean();
      if (!branch) throw new AppError(404, "Branch not found", "BRANCH_NOT_FOUND");

      const updatedFilter = since ? { updatedAt: { $gt: since } } : {};
      const canSeeCost = req.auth!.permissions.includes("products.cost.view");

      const [categories, brands, units, products, variants, barcodes, inventory] = await Promise.all([
        Category.find({ tenantId, deletedAt: null, ...updatedFilter }).lean(),
        Brand.find({ tenantId, deletedAt: null, ...updatedFilter }).lean(),
        Unit.find({ tenantId, deletedAt: null, ...updatedFilter }).lean(),
        Product.find({ tenantId, deletedAt: null, ...updatedFilter }).lean(),
        ProductVariant.find({ tenantId, deletedAt: null, ...updatedFilter }).lean(),
        Barcode.find({ tenantId, deletedAt: null, ...updatedFilter }).lean(),
        BranchInventory.find({ tenantId, branchId, ...updatedFilter }).lean(),
      ]);

      const serverTime = new Date();
      const stamps = [
        ...categories.map((r) => r.updatedAt),
        ...brands.map((r) => r.updatedAt),
        ...units.map((r) => r.updatedAt),
        ...products.map((r) => r.updatedAt),
        ...variants.map((r) => r.updatedAt),
        ...barcodes.map((r) => r.updatedAt),
        ...inventory.map((r) => r.updatedAt),
      ].filter(Boolean) as Date[];
      const cursor = stamps.length
        ? new Date(Math.max(...stamps.map((d) => d.getTime()))).toISOString()
        : serverTime.toISOString();

      res.json({
        data: {
          branchId,
          serverTime: serverTime.toISOString(),
          cursor,
          full: !since,
          categories: categories.map((c) => ({
            id: String(c._id),
            name: c.name,
            updatedAt: c.updatedAt,
          })),
          brands: brands.map((b) => ({
            id: String(b._id),
            name: b.name,
            updatedAt: b.updatedAt,
          })),
          units: units.map((u) => ({
            id: String(u._id),
            name: u.name,
            code: u.code,
            allowsDecimal: u.allowsDecimal,
            updatedAt: u.updatedAt,
          })),
          products: products.map((p) => ({
            id: String(p._id),
            name: p.name,
            categoryId: p.categoryId ? String(p.categoryId) : null,
            brandId: p.brandId ? String(p.brandId) : null,
            unitId: String(p.unitId),
            isWeighted: p.isWeighted,
            status: p.status,
            updatedAt: p.updatedAt,
          })),
          variants: variants.map((v) => ({
            id: String(v._id),
            productId: String(v.productId),
            sku: v.sku,
            name: v.name,
            retailPriceMinor: v.retailPriceMinor,
            wholesalePriceMinor: v.wholesalePriceMinor,
            minPriceMinor: v.minPriceMinor,
            reorderLevel: v.reorderLevel,
            isActive: v.isActive,
            ...(canSeeCost ? { costMinor: v.costMinor } : {}),
            updatedAt: v.updatedAt,
          })),
          barcodes: barcodes.map((b) => ({
            id: String(b._id),
            variantId: String(b.variantId),
            code: b.code,
            isPrimary: b.isPrimary,
            updatedAt: b.updatedAt,
          })),
          inventory: inventory.map((i) => ({
            variantId: String(i.variantId),
            qtyOnHand: i.qtyOnHand,
            qtyReserved: i.qtyReserved,
            avgCostMinor: canSeeCost ? i.avgCostMinor : undefined,
            updatedAt: i.updatedAt,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

syncRouter.post(
  "/sales",
  requirePermission("sales.create"),
  validate({
    body: z.object({
      sales: z.array(offlineSaleSchema).min(1).max(50),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const results = [];

      for (const sale of req.body.sales) {
        try {
          if (sale.cartDiscountMinor && !req.auth!.permissions.includes("sales.discount")) {
            throw new AppError(403, "Discount not permitted", "FORBIDDEN");
          }
          for (const item of sale.items) {
            if (
              item.unitPriceMinor !== undefined &&
              !req.auth!.permissions.includes("sales.price_override")
            ) {
              throw new AppError(403, "Price override not permitted", "FORBIDDEN");
            }
          }

          const result = await checkoutSale({
            tenantId,
            userId: req.auth!.userId,
            branchId: sale.branchId,
            registerId: sale.registerId,
            idempotencyKey: sale.idempotencyKey,
            items: sale.items,
            payments: sale.payments,
            cartDiscountMinor: sale.cartDiscountMinor,
            customerId: sale.customerId,
            customerName: sale.customerName,
            notes: sale.notes,
            offlineId: sale.offlineId,
            soldAt: sale.soldAt ? new Date(sale.soldAt) : undefined,
            // Offline sync may race stock; allow through then flag for review via audit
            allowNegativeStock: sale.allowNegativeStock ?? true,
            requestId: req.requestId,
            ip: req.ip,
          });

          const includeCost = req.auth!.permissions.includes("products.cost.view");
          results.push({
            offlineId: sale.offlineId,
            status: "synced" as const,
            replayed: result.replayed,
            sale: serializeSale(result.sale as never, { includeCost }),
          });
        } catch (err) {
          results.push({
            offlineId: sale.offlineId,
            status: "failed" as const,
            error: {
              code: isAppError(err) ? err.code : "SYNC_FAILED",
              message: err instanceof Error ? err.message : "Failed to sync sale",
            },
          });
        }
      }

      const synced = results.filter((r) => r.status === "synced").length;
      const failed = results.filter((r) => r.status === "failed").length;

      res.status(failed && !synced ? 422 : 200).json({
        data: {
          serverTime: new Date().toISOString(),
          synced,
          failed,
          results,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

syncRouter.get(
  "/sales/:offlineId",
  requirePermission("sales.view"),
  async (req, res, next) => {
    try {
      const sale = await Sale.findOne({
        tenantId: req.auth!.tenantId,
        offlineId: req.params.offlineId,
        deletedAt: null,
      }).lean();
      if (!sale) throw new AppError(404, "Offline sale not found on server", "OFFLINE_SALE_NOT_FOUND");
      const includeCost = req.auth!.permissions.includes("products.cost.view");
      res.json({ data: serializeSale(sale as never, { includeCost }) });
    } catch (err) {
      next(err);
    }
  },
);
