import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireTenant } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import {
  BranchInventory,
  StockCount,
  StockMovement,
  StockTransfer,
} from "../../models/inventory.model.js";
import { ProductVariant, Product } from "../../models/product.model.js";
import { Branch } from "../../models/branch.model.js";
import { AppError } from "../../lib/errors.js";
import { applyStockMovement, withTransaction } from "../../lib/stock.js";
import { AuditLog } from "../../models/audit.model.js";

export const inventoryRouter = Router();
inventoryRouter.use(authenticate, requireTenant);

inventoryRouter.get("/", requirePermission("inventory.view"), async (req, res, next) => {
  try {
    const branchId = String(req.query.branchId ?? "");
    if (!branchId) throw new AppError(400, "branchId is required", "VALIDATION_ERROR");

    const branch = await Branch.findOne({
      _id: branchId,
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    });
    if (!branch) throw new AppError(404, "Branch not found", "BRANCH_NOT_FOUND");

    const lowOnly = String(req.query.lowStock ?? "") === "true";
    const rows = await BranchInventory.find({
      tenantId: req.auth!.tenantId,
      branchId,
    }).lean();

    const variants = await ProductVariant.find({
      tenantId: req.auth!.tenantId,
      _id: { $in: rows.map((r) => r.variantId) },
      deletedAt: null,
    }).lean();
    const variantMap = new Map(variants.map((v) => [String(v._id), v]));
    const products = await Product.find({
      tenantId: req.auth!.tenantId,
      _id: { $in: variants.map((v) => v.productId) },
    }).lean();
    const productMap = new Map(products.map((p) => [String(p._id), p]));
    const canSeeCost = req.auth!.permissions.includes("products.cost.view");

    let data = rows.map((r) => {
      const v = variantMap.get(String(r.variantId));
      const p = v ? productMap.get(String(v.productId)) : undefined;
      return {
        variantId: String(r.variantId),
        productName: p?.name ?? v?.name ?? "Unknown",
        sku: v?.sku ?? "",
        qtyOnHand: r.qtyOnHand,
        qtyReserved: r.qtyReserved,
        qtyDamaged: r.qtyDamaged,
        reorderLevel: v?.reorderLevel ?? 0,
        avgCostMinor: canSeeCost ? r.avgCostMinor : undefined,
        valuationMinor: canSeeCost ? Math.round(r.qtyOnHand * r.avgCostMinor) : undefined,
        isLow: (v?.reorderLevel ?? 0) > 0 && r.qtyOnHand <= (v?.reorderLevel ?? 0),
      };
    });

    if (lowOnly) data = data.filter((d) => d.isLow || d.qtyOnHand <= 0);

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

inventoryRouter.get("/movements", requirePermission("inventory.view"), async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = { tenantId: req.auth!.tenantId };
    if (req.query.branchId) filter.branchId = String(req.query.branchId);
    if (req.query.variantId) filter.variantId = String(req.query.variantId);
    if (req.query.type) filter.type = String(req.query.type);

    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));

    const [rows, total] = await Promise.all([
      StockMovement.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StockMovement.countDocuments(filter),
    ]);

    res.json({
      data: rows.map((m) => ({
        id: String(m._id),
        branchId: String(m.branchId),
        variantId: String(m.variantId),
        type: m.type,
        qtyDelta: m.qtyDelta,
        qtyAfter: m.qtyAfter,
        unitCostMinor: req.auth!.permissions.includes("products.cost.view")
          ? m.unitCostMinor
          : undefined,
        refType: m.refType,
        refId: m.refId,
        note: m.note,
        createdBy: String(m.createdBy),
        createdAt: m.createdAt,
      })),
      meta: { page, limit, total },
    });
  } catch (err) {
    next(err);
  }
});

inventoryRouter.get("/alerts/low-stock", requirePermission("inventory.view"), async (req, res, next) => {
  try {
    const branchId = String(req.query.branchId ?? "");
    if (!branchId) throw new AppError(400, "branchId is required", "VALIDATION_ERROR");

    req.query.lowStock = "true";
    // reuse list logic via redirecting query — call same handler path inline
    const rows = await BranchInventory.find({
      tenantId: req.auth!.tenantId,
      branchId,
    }).lean();
    const variants = await ProductVariant.find({
      tenantId: req.auth!.tenantId,
      _id: { $in: rows.map((r) => r.variantId) },
      deletedAt: null,
    }).lean();
    const variantMap = new Map(variants.map((v) => [String(v._id), v]));
    const products = await Product.find({
      _id: { $in: variants.map((v) => v.productId) },
    }).lean();
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const data = rows
      .map((r) => {
        const v = variantMap.get(String(r.variantId));
        const p = v ? productMap.get(String(v.productId)) : undefined;
        const reorder = v?.reorderLevel ?? 0;
        return {
          variantId: String(r.variantId),
          productName: p?.name ?? "",
          sku: v?.sku ?? "",
          qtyOnHand: r.qtyOnHand,
          reorderLevel: reorder,
          status: r.qtyOnHand <= 0 ? "out_of_stock" : "low",
        };
      })
      .filter((d) => d.qtyOnHand <= 0 || (d.reorderLevel > 0 && d.qtyOnHand <= d.reorderLevel));

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post(
  "/adjustments",
  requirePermission("inventory.adjust"),
  validate({
    body: z.object({
      branchId: z.string().min(1),
      variantId: z.string().min(1),
      qtyDelta: z.number().refine((n) => n !== 0),
      reason: z.enum(["adjust", "damage", "opening"]),
      note: z.string().optional(),
      unitCostMinor: z.number().int().nonnegative().optional(),
      allowNegative: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const body = req.body;

      const branch = await Branch.findOne({
        _id: body.branchId,
        tenantId,
        deletedAt: null,
      });
      if (!branch) throw new AppError(404, "Branch not found", "BRANCH_NOT_FOUND");

      const variant = await ProductVariant.findOne({
        _id: body.variantId,
        tenantId,
        deletedAt: null,
      });
      if (!variant) throw new AppError(404, "Variant not found", "VARIANT_NOT_FOUND");

      const result = await withTransaction(async (session) =>
        applyStockMovement({
          tenantId,
          branchId: body.branchId,
          variantId: body.variantId,
          type: body.reason,
          qtyDelta: body.qtyDelta,
          unitCostMinor: body.unitCostMinor,
          note: body.note,
          createdBy: req.auth!.userId,
          allowNegative: body.allowNegative ?? false,
          refType: "adjustment",
          session,
        }),
      );

      await AuditLog.create({
        tenantId,
        actorUserId: req.auth!.userId,
        action: "inventory.adjust",
        entityType: "StockMovement",
        entityId: String(result.movement._id),
        meta: { qtyDelta: body.qtyDelta, reason: body.reason },
        requestId: req.requestId,
        ip: req.ip,
      });

      res.status(201).json({
        data: {
          movementId: String(result.movement._id),
          qtyOnHand: result.inventory.qtyOnHand,
          qtyAfter: result.movement.qtyAfter,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

inventoryRouter.post(
  "/opening",
  requirePermission("inventory.adjust"),
  validate({
    body: z.object({
      branchId: z.string().min(1),
      lines: z
        .array(
          z.object({
            variantId: z.string().min(1),
            qty: z.number().positive(),
            unitCostMinor: z.number().int().nonnegative(),
          }),
        )
        .min(1),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const { branchId, lines } = req.body as {
        branchId: string;
        lines: { variantId: string; qty: number; unitCostMinor: number }[];
      };

      const result = await withTransaction(async (session) => {
        const created = [];
        for (const line of lines) {
          const movement = await applyStockMovement({
            tenantId,
            branchId,
            variantId: line.variantId,
            type: "opening",
            qtyDelta: line.qty,
            unitCostMinor: line.unitCostMinor,
            createdBy: req.auth!.userId,
            refType: "opening_stock",
            session,
          });
          created.push(movement.movement._id);
        }
        return created;
      });

      res.status(201).json({ data: { movementIds: result.map(String) } });
    } catch (err) {
      next(err);
    }
  },
);

// --- Stock counts ---
inventoryRouter.get("/counts", requirePermission("inventory.count"), async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = { tenantId: req.auth!.tenantId, deletedAt: null };
    if (req.query.branchId) filter.branchId = String(req.query.branchId);
    const counts = await StockCount.find(filter).sort({ createdAt: -1 }).limit(50).lean();
    res.json({
      data: counts.map((c) => ({
        id: String(c._id),
        branchId: String(c.branchId),
        status: c.status,
        lineCount: c.lines.length,
        createdAt: c.createdAt,
        completedAt: c.completedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post(
  "/counts",
  requirePermission("inventory.count"),
  validate({
    body: z.object({
      branchId: z.string().min(1),
      notes: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const inv = await BranchInventory.find({ tenantId, branchId: req.body.branchId }).lean();
      const count = await StockCount.create({
        tenantId,
        branchId: req.body.branchId,
        status: "in_progress",
        notes: req.body.notes ?? "",
        createdBy: req.auth!.userId,
        lines: inv.map((r) => ({
          variantId: r.variantId,
          expectedQty: r.qtyOnHand,
        })),
      });
      res.status(201).json({
        data: { id: String(count._id), status: count.status, lineCount: count.lines.length },
      });
    } catch (err) {
      next(err);
    }
  },
);

inventoryRouter.post(
  "/counts/:id/lines",
  requirePermission("inventory.count"),
  validate({
    body: z.object({
      variantId: z.string().min(1),
      countedQty: z.number(),
    }),
  }),
  async (req, res, next) => {
    try {
      const count = await StockCount.findOne({
        _id: req.params.id,
        tenantId: req.auth!.tenantId,
        deletedAt: null,
      });
      if (!count) throw new AppError(404, "Count not found", "COUNT_NOT_FOUND");
      if (count.status !== "in_progress" && count.status !== "draft") {
        throw new AppError(400, "Count is not editable", "COUNT_LOCKED");
      }

      const line = count.lines.find((l) => String(l.variantId) === req.body.variantId);
      if (!line) throw new AppError(404, "Line not found", "LINE_NOT_FOUND");
      line.countedQty = req.body.countedQty;
      line.varianceQty = req.body.countedQty - line.expectedQty;
      await count.save();
      res.json({ data: { ok: true, varianceQty: line.varianceQty } });
    } catch (err) {
      next(err);
    }
  },
);

inventoryRouter.post(
  "/counts/:id/complete",
  requirePermission("inventory.count"),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const count = await StockCount.findOne({
        _id: req.params.id,
        tenantId,
        deletedAt: null,
      });
      if (!count) throw new AppError(404, "Count not found", "COUNT_NOT_FOUND");
      if (count.status === "completed") {
        throw new AppError(400, "Count already completed", "COUNT_DONE");
      }

      await withTransaction(async (session) => {
        for (const line of count.lines) {
          if (typeof line.countedQty !== "number") continue;
          const delta = line.countedQty - line.expectedQty;
          if (delta === 0) continue;
          await applyStockMovement({
            tenantId,
            branchId: String(count.branchId),
            variantId: String(line.variantId),
            type: "count",
            qtyDelta: delta,
            createdBy: req.auth!.userId,
            allowNegative: true,
            refType: "stock_count",
            refId: String(count._id),
            note: "Physical count variance",
            session,
          });
        }
        count.status = "completed";
        count.completedAt = new Date();
        count.completedBy = req.auth!.userId as never;
        await count.save({ session });
      });

      res.json({ data: { id: String(count._id), status: "completed" } });
    } catch (err) {
      next(err);
    }
  },
);

// --- Transfers ---
inventoryRouter.get("/transfers", requirePermission("inventory.transfer"), async (req, res, next) => {
  try {
    const transfers = await StockTransfer.find({
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({
      data: transfers.map((t) => ({
        id: String(t._id),
        fromBranchId: String(t.fromBranchId),
        toBranchId: String(t.toBranchId),
        status: t.status,
        itemCount: t.lines.length,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post(
  "/transfers",
  requirePermission("inventory.transfer"),
  validate({
    body: z.object({
      fromBranchId: z.string().min(1),
      toBranchId: z.string().min(1),
      notes: z.string().optional(),
      lines: z
        .array(z.object({ variantId: z.string().min(1), qty: z.number().positive() }))
        .min(1),
    }),
  }),
  async (req, res, next) => {
    try {
      if (req.body.fromBranchId === req.body.toBranchId) {
        throw new AppError(400, "From and to branch must differ", "INVALID_TRANSFER");
      }
      const transfer = await StockTransfer.create({
        tenantId: req.auth!.tenantId,
        fromBranchId: req.body.fromBranchId,
        toBranchId: req.body.toBranchId,
        lines: req.body.lines,
        notes: req.body.notes ?? "",
        createdBy: req.auth!.userId,
        status: "draft",
      });
      res.status(201).json({ data: { id: String(transfer._id), status: transfer.status } });
    } catch (err) {
      next(err);
    }
  },
);

async function loadTransfer(req: import("express").Request) {
  const transfer = await StockTransfer.findOne({
    _id: req.params.id,
    tenantId: req.auth!.tenantId,
    deletedAt: null,
  });
  if (!transfer) throw new AppError(404, "Transfer not found", "TRANSFER_NOT_FOUND");
  return transfer;
}

inventoryRouter.post(
  "/transfers/:id/approve",
  requirePermission("inventory.transfer"),
  async (req, res, next) => {
    try {
      const transfer = await loadTransfer(req);
      if (transfer.status !== "draft") {
        throw new AppError(400, "Only draft transfers can be approved", "INVALID_STATUS");
      }
      // approve permission is ideal; owners/managers with transfer can approve in Phase 6
      transfer.status = "approved";
      transfer.approvedBy = req.auth!.userId as never;
      transfer.approvedAt = new Date();
      await transfer.save();
      res.json({ data: { id: String(transfer._id), status: transfer.status } });
    } catch (err) {
      next(err);
    }
  },
);

inventoryRouter.post(
  "/transfers/:id/dispatch",
  requirePermission("inventory.transfer"),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const transfer = await loadTransfer(req);
      if (transfer.status !== "approved" && transfer.status !== "draft") {
        throw new AppError(400, "Transfer cannot be dispatched", "INVALID_STATUS");
      }

      await withTransaction(async (session) => {
        for (const line of transfer.lines) {
          await applyStockMovement({
            tenantId,
            branchId: String(transfer.fromBranchId),
            variantId: String(line.variantId),
            type: "transfer_out",
            qtyDelta: -line.qty,
            createdBy: req.auth!.userId,
            refType: "stock_transfer",
            refId: String(transfer._id),
            session,
          });
        }
        transfer.status = "dispatched";
        transfer.dispatchedBy = req.auth!.userId as never;
        transfer.dispatchedAt = new Date();
        await transfer.save({ session });
      });

      res.json({ data: { id: String(transfer._id), status: "dispatched" } });
    } catch (err) {
      next(err);
    }
  },
);

inventoryRouter.post(
  "/transfers/:id/receive",
  requirePermission("inventory.transfer"),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const transfer = await loadTransfer(req);
      if (transfer.status !== "dispatched") {
        throw new AppError(400, "Transfer must be dispatched before receiving", "INVALID_STATUS");
      }

      await withTransaction(async (session) => {
        for (const line of transfer.lines) {
          await applyStockMovement({
            tenantId,
            branchId: String(transfer.toBranchId),
            variantId: String(line.variantId),
            type: "transfer_in",
            qtyDelta: line.qty,
            createdBy: req.auth!.userId,
            refType: "stock_transfer",
            refId: String(transfer._id),
            session,
          });
        }
        transfer.status = "received";
        transfer.receivedBy = req.auth!.userId as never;
        transfer.receivedAt = new Date();
        await transfer.save({ session });
      });

      res.json({ data: { id: String(transfer._id), status: "received" } });
    } catch (err) {
      next(err);
    }
  },
);
