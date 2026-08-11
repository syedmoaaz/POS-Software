import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireTenant } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { AppError } from "../../lib/errors.js";
import { Sale, HeldSale, ReturnModel } from "../../models/sale.model.js";
import { checkoutSale, createReturn, serializeSale } from "./sales.service.js";

export const salesRouter = Router();
salesRouter.use(authenticate, requireTenant);

const paymentSchema = z.object({
  method: z.enum(["cash", "card", "transfer", "wallet", "store_credit", "customer_credit"]),
  amountMinor: z.number().int().nonnegative(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const checkoutSchema = z.object({
  branchId: z.string().min(1),
  registerId: z.string().min(1),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  notes: z.string().optional(),
  cartDiscountMinor: z.number().int().nonnegative().optional(),
  offlineId: z.string().optional(),
  allowNegativeStock: z.boolean().optional(),
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

salesRouter.post(
  "/checkout",
  requirePermission("sales.create"),
  validate({ body: checkoutSchema }),
  async (req, res, next) => {
    try {
      if (req.body.cartDiscountMinor && !req.auth!.permissions.includes("sales.discount")) {
        throw new AppError(403, "Discount not permitted", "FORBIDDEN");
      }
      for (const item of req.body.items) {
        if (
          item.unitPriceMinor !== undefined &&
          !req.auth!.permissions.includes("sales.price_override")
        ) {
          throw new AppError(403, "Price override not permitted", "FORBIDDEN");
        }
      }

      const idempotencyKey =
        (req.get("idempotency-key") || req.body.idempotencyKey || "").trim() || randomUUID();

      const result = await checkoutSale({
        tenantId: req.auth!.tenantId!,
        userId: req.auth!.userId,
        branchId: req.body.branchId,
        registerId: req.body.registerId,
        idempotencyKey,
        items: req.body.items,
        payments: req.body.payments,
        cartDiscountMinor: req.body.cartDiscountMinor,
        customerId: req.body.customerId,
        customerName: req.body.customerName,
        notes: req.body.notes,
        offlineId: req.body.offlineId,
        allowNegativeStock: req.body.allowNegativeStock,
        requestId: req.requestId,
        ip: req.ip,
      });

      const includeCost = req.auth!.permissions.includes("products.cost.view");
      res.status(result.replayed ? 200 : 201).json({
        data: serializeSale(result.sale as never, { includeCost }),
        meta: { replayed: result.replayed, idempotencyKey },
      });
    } catch (err) {
      next(err);
    }
  },
);

salesRouter.get("/", requirePermission("sales.view"), async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = {
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    };
    if (req.query.branchId) filter.branchId = String(req.query.branchId);
    if (req.query.q) {
      filter.receiptNo = { $regex: String(req.query.q), $options: "i" };
    }
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));

    const [rows, total] = await Promise.all([
      Sale.find(filter)
        .sort({ soldAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Sale.countDocuments(filter),
    ]);

    const includeCost = req.auth!.permissions.includes("products.cost.view");
    res.json({
      data: rows.map((s) => serializeSale(s as never, { includeCost })),
      meta: { page, limit, total },
    });
  } catch (err) {
    next(err);
  }
});

salesRouter.get("/by-receipt/:receiptNo", requirePermission("sales.view"), async (req, res, next) => {
  try {
    const sale = await Sale.findOne({
      tenantId: req.auth!.tenantId,
      receiptNo: req.params.receiptNo,
      deletedAt: null,
    }).lean();
    if (!sale) throw new AppError(404, "Sale not found", "SALE_NOT_FOUND");
    res.json({
      data: serializeSale(sale as never, {
        includeCost: req.auth!.permissions.includes("products.cost.view"),
      }),
    });
  } catch (err) {
    next(err);
  }
});

// Held sales (before /:id)
salesRouter.get("/held", requirePermission("sales.hold"), async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = {
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    };
    if (req.query.branchId) filter.branchId = String(req.query.branchId);
    const rows = await HeldSale.find(filter).sort({ heldAt: -1 }).limit(50).lean();
    res.json({
      data: rows.map((h) => ({
        id: String(h._id),
        label: h.label,
        branchId: String(h.branchId),
        registerId: String(h.registerId),
        customerName: h.customerName,
        itemCount: h.items.length,
        cartDiscountMinor: h.cartDiscountMinor,
        heldAt: h.heldAt,
        items: h.items,
      })),
    });
  } catch (err) {
    next(err);
  }
});

salesRouter.post(
  "/held",
  requirePermission("sales.hold"),
  validate({
    body: z.object({
      branchId: z.string().min(1),
      registerId: z.string().min(1),
      label: z.string().min(1).optional(),
      customerId: z.string().optional(),
      customerName: z.string().optional(),
      cartDiscountMinor: z.number().int().nonnegative().optional(),
      notes: z.string().optional(),
      items: z
        .array(
          z.object({
            variantId: z.string().min(1),
            productId: z.string().min(1),
            name: z.string().min(1),
            sku: z.string().min(1),
            qty: z.number().positive(),
            unitPriceMinor: z.number().int().nonnegative(),
            costMinor: z.number().int().nonnegative().optional(),
            discountMinor: z.number().int().nonnegative().optional(),
            lineTotalMinor: z.number().int().nonnegative(),
            note: z.string().optional(),
          }),
        )
        .min(1),
    }),
  }),
  async (req, res, next) => {
    try {
      const count = await HeldSale.countDocuments({
        tenantId: req.auth!.tenantId,
        branchId: req.body.branchId,
        deletedAt: null,
      });
      const held = await HeldSale.create({
        tenantId: req.auth!.tenantId,
        branchId: req.body.branchId,
        registerId: req.body.registerId,
        label: req.body.label || `Hold #${count + 1}`,
        customerId: req.body.customerId,
        customerName: req.body.customerName || "Walk-in Customer",
        cartDiscountMinor: req.body.cartDiscountMinor ?? 0,
        notes: req.body.notes ?? "",
        items: req.body.items.map(
          (i: {
            variantId: string;
            productId: string;
            name: string;
            sku: string;
            qty: number;
            unitPriceMinor: number;
            costMinor?: number;
            discountMinor?: number;
            lineTotalMinor: number;
            note?: string;
          }) => ({
            ...i,
            costMinor: i.costMinor ?? 0,
            discountMinor: i.discountMinor ?? 0,
            taxMinor: 0,
          }),
        ),
        heldBy: req.auth!.userId,
      });
      res.status(201).json({ data: { id: String(held._id), label: held.label } });
    } catch (err) {
      next(err);
    }
  },
);

salesRouter.post("/held/:id/resume", requirePermission("sales.hold"), async (req, res, next) => {
  try {
    const held = await HeldSale.findOne({
      _id: req.params.id,
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    });
    if (!held) throw new AppError(404, "Held sale not found", "HELD_NOT_FOUND");
    held.deletedAt = new Date();
    await held.save();
    res.json({
      data: {
        id: String(held._id),
        label: held.label,
        branchId: String(held.branchId),
        registerId: String(held.registerId),
        customerId: held.customerId ? String(held.customerId) : null,
        customerName: held.customerName,
        cartDiscountMinor: held.cartDiscountMinor,
        notes: held.notes,
        items: held.items,
      },
    });
  } catch (err) {
    next(err);
  }
});

salesRouter.delete("/held/:id", requirePermission("sales.hold"), async (req, res, next) => {
  try {
    const held = await HeldSale.findOne({
      _id: req.params.id,
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    });
    if (!held) throw new AppError(404, "Held sale not found", "HELD_NOT_FOUND");
    held.deletedAt = new Date();
    await held.save();
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

salesRouter.get("/:id", requirePermission("sales.view"), async (req, res, next) => {
  try {
    const sale = await Sale.findOne({
      _id: req.params.id,
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    }).lean();
    if (!sale) throw new AppError(404, "Sale not found", "SALE_NOT_FOUND");
    res.json({
      data: serializeSale(sale as never, {
        includeCost: req.auth!.permissions.includes("products.cost.view"),
      }),
    });
  } catch (err) {
    next(err);
  }
});

export const returnsRouter = Router();
returnsRouter.use(authenticate, requireTenant);

returnsRouter.get("/", requirePermission("returns.create"), async (req, res, next) => {
  try {
    const rows = await ReturnModel.find({
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({
      data: rows.map((r) => ({
        id: String(r._id),
        returnNo: r.returnNo,
        saleId: String(r.saleId),
        status: r.status,
        totalRefundMinor: r.totalRefundMinor,
        reason: r.reason,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

returnsRouter.post(
  "/",
  requirePermission("returns.create"),
  validate({
    body: z.object({
      saleId: z.string().min(1),
      reason: z.string().optional(),
      registerSessionId: z.string().optional(),
      lines: z
        .array(
          z.object({
            saleItemId: z.string().min(1),
            qty: z.number().positive(),
            disposition: z.enum(["restock", "damaged", "discard"]).optional(),
          }),
        )
        .min(1),
      refundPayments: z.array(paymentSchema).min(1),
    }),
  }),
  async (req, res, next) => {
    try {
      const ret = await createReturn({
        tenantId: req.auth!.tenantId!,
        userId: req.auth!.userId,
        saleId: req.body.saleId,
        reason: req.body.reason,
        registerSessionId: req.body.registerSessionId,
        lines: req.body.lines,
        refundPayments: req.body.refundPayments,
        requestId: req.requestId,
        ip: req.ip,
      });
      res.status(201).json({
        data: {
          id: String(ret._id),
          returnNo: ret.returnNo,
          totalRefundMinor: ret.totalRefundMinor,
          status: ret.status,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
