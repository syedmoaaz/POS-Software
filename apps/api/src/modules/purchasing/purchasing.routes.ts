import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireTenant } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { AppError } from "../../lib/errors.js";
import { nextSequence } from "../../models/counter.model.js";
import { ProductVariant, Product } from "../../models/product.model.js";
import {
  Supplier,
  SupplierLedger,
  PurchaseOrder,
  Purchase,
  SupplierPayment,
} from "../../models/supplier.model.js";
import { applyStockMovement, withTransaction } from "../../lib/stock.js";
import { postSupplierLedger } from "../../lib/ledgers.js";
import { AuditLog } from "../../models/audit.model.js";

export const suppliersRouter = Router();
suppliersRouter.use(authenticate, requireTenant);

suppliersRouter.get("/", requirePermission("suppliers.view"), async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const filter: Record<string, unknown> = { tenantId: req.auth!.tenantId, deletedAt: null };
    if (q) filter.name = { $regex: q, $options: "i" };
    const rows = await Supplier.find(filter).sort({ name: 1 }).lean();
    res.json({
      data: rows.map((s) => ({
        id: String(s._id),
        name: s.name,
        phone: s.phone,
        email: s.email,
        balanceMinor: s.balanceMinor,
        isActive: s.isActive,
      })),
    });
  } catch (err) {
    next(err);
  }
});

suppliersRouter.post(
  "/",
  requirePermission("suppliers.manage"),
  validate({
    body: z.object({
      name: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      address: z.string().optional(),
      notes: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const s = await Supplier.create({
        tenantId: req.auth!.tenantId,
        name: req.body.name,
        phone: req.body.phone ?? "",
        email: req.body.email ?? "",
        address: req.body.address ?? "",
        notes: req.body.notes ?? "",
      });
      res.status(201).json({ data: { id: String(s._id), name: s.name } });
    } catch (err) {
      next(err);
    }
  },
);

suppliersRouter.get("/:id", requirePermission("suppliers.view"), async (req, res, next) => {
  try {
    const s = await Supplier.findOne({
      _id: req.params.id,
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    }).lean();
    if (!s) throw new AppError(404, "Supplier not found", "SUPPLIER_NOT_FOUND");
    res.json({
      data: {
        id: String(s._id),
        name: s.name,
        phone: s.phone,
        email: s.email,
        address: s.address,
        balanceMinor: s.balanceMinor,
        notes: s.notes,
        isActive: s.isActive,
      },
    });
  } catch (err) {
    next(err);
  }
});

suppliersRouter.get("/:id/ledger", requirePermission("suppliers.view"), async (req, res, next) => {
  try {
    const rows = await SupplierLedger.find({
      tenantId: req.auth!.tenantId,
      supplierId: req.params.id,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({
      data: rows.map((r) => ({
        id: String(r._id),
        type: r.type,
        amountMinor: r.amountMinor,
        balanceAfterMinor: r.balanceAfterMinor,
        note: r.note,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export const purchaseOrdersRouter = Router();
purchaseOrdersRouter.use(authenticate, requireTenant);

purchaseOrdersRouter.get("/", requirePermission("purchases.view"), async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = { tenantId: req.auth!.tenantId, deletedAt: null };
    if (req.query.branchId) filter.branchId = String(req.query.branchId);
    if (req.query.status) filter.status = String(req.query.status);
    const rows = await PurchaseOrder.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json({
      data: rows.map((p) => ({
        id: String(p._id),
        number: p.number,
        supplierId: String(p.supplierId),
        branchId: String(p.branchId),
        status: p.status,
        totalMinor: p.totalMinor,
        lineCount: p.lines.length,
        orderedAt: p.orderedAt,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

purchaseOrdersRouter.post(
  "/",
  requirePermission("purchases.create"),
  validate({
    body: z.object({
      branchId: z.string().min(1),
      supplierId: z.string().min(1),
      notes: z.string().optional(),
      expectedAt: z.string().datetime().optional(),
      lines: z
        .array(
          z.object({
            variantId: z.string().min(1),
            qtyOrdered: z.number().positive(),
            unitCostMinor: z.number().int().nonnegative(),
          }),
        )
        .min(1),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const supplier = await Supplier.findOne({
        _id: req.body.supplierId,
        tenantId,
        deletedAt: null,
      });
      if (!supplier) throw new AppError(404, "Supplier not found", "SUPPLIER_NOT_FOUND");

      const lines = [];
      let totalMinor = 0;
      for (const line of req.body.lines) {
        const variant = await ProductVariant.findOne({
          _id: line.variantId,
          tenantId,
          deletedAt: null,
        });
        if (!variant) throw new AppError(404, "Variant not found", "VARIANT_NOT_FOUND");
        const product = await Product.findById(variant.productId);
        lines.push({
          variantId: variant._id,
          name: product?.name ?? variant.name,
          sku: variant.sku,
          qtyOrdered: line.qtyOrdered,
          qtyReceived: 0,
          unitCostMinor: line.unitCostMinor,
        });
        totalMinor += Math.round(line.qtyOrdered * line.unitCostMinor);
      }

      const seq = await nextSequence({ tenantId, key: "po", branchId: req.body.branchId });
      const number = `PO-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;

      const po = await PurchaseOrder.create({
        tenantId,
        branchId: req.body.branchId,
        supplierId: req.body.supplierId,
        number,
        status: "draft",
        lines,
        totalMinor,
        notes: req.body.notes ?? "",
        expectedAt: req.body.expectedAt ? new Date(req.body.expectedAt) : undefined,
        createdBy: req.auth!.userId,
      });

      res.status(201).json({ data: { id: String(po._id), number: po.number, status: po.status } });
    } catch (err) {
      next(err);
    }
  },
);

purchaseOrdersRouter.post("/:id/order", requirePermission("purchases.create"), async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findOne({
      _id: req.params.id,
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    });
    if (!po) throw new AppError(404, "PO not found", "PO_NOT_FOUND");
    if (po.status !== "draft") throw new AppError(400, "Only draft POs can be ordered", "INVALID_STATUS");
    po.status = "ordered";
    po.orderedAt = new Date();
    await po.save();
    res.json({ data: { id: String(po._id), status: po.status } });
  } catch (err) {
    next(err);
  }
});

purchaseOrdersRouter.post("/:id/cancel", requirePermission("purchases.create"), async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findOne({
      _id: req.params.id,
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    });
    if (!po) throw new AppError(404, "PO not found", "PO_NOT_FOUND");
    if (po.status === "received") throw new AppError(400, "Cannot cancel received PO", "INVALID_STATUS");
    po.status = "cancelled";
    await po.save();
    res.json({ data: { id: String(po._id), status: po.status } });
  } catch (err) {
    next(err);
  }
});

export const purchasesRouter = Router();
purchasesRouter.use(authenticate, requireTenant);

purchasesRouter.get("/", requirePermission("purchases.view"), async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = { tenantId: req.auth!.tenantId, deletedAt: null };
    if (req.query.branchId) filter.branchId = String(req.query.branchId);
    const rows = await Purchase.find(filter).sort({ receivedAt: -1 }).limit(100).lean();
    res.json({
      data: rows.map((p) => ({
        id: String(p._id),
        number: p.number,
        supplierId: String(p.supplierId),
        branchId: String(p.branchId),
        status: p.status,
        totalMinor: p.totalMinor,
        paidMinor: p.paidMinor,
        paymentStatus: p.paymentStatus,
        receivedAt: p.receivedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

purchasesRouter.post(
  "/receive",
  requirePermission("purchases.receive"),
  validate({
    body: z.object({
      branchId: z.string().min(1),
      supplierId: z.string().min(1),
      purchaseOrderId: z.string().optional(),
      invoiceNo: z.string().optional(),
      expenseMinor: z.number().int().nonnegative().optional(),
      notes: z.string().optional(),
      dueAt: z.string().datetime().optional(),
      payNowMinor: z.number().int().nonnegative().optional(),
      payMethod: z.enum(["cash", "card", "transfer", "wallet"]).optional(),
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
      const body = req.body;

      const result = await withTransaction(async (session) => {
        const lines = [];
        let subtotalMinor = 0;
        for (const line of body.lines) {
          const variant = await ProductVariant.findOne({
            _id: line.variantId,
            tenantId,
            deletedAt: null,
          }).session(session ?? null);
          if (!variant) throw new AppError(404, "Variant not found", "VARIANT_NOT_FOUND");
          const product = await Product.findById(variant.productId).session(session ?? null);
          const lineTotalMinor = Math.round(line.qty * line.unitCostMinor);
          subtotalMinor += lineTotalMinor;
          lines.push({
            variantId: variant._id,
            name: product?.name ?? variant.name,
            sku: variant.sku,
            qty: line.qty,
            unitCostMinor: line.unitCostMinor,
            lineTotalMinor,
          });

          // update variant cost to latest purchase cost
          variant.costMinor = line.unitCostMinor;
          await variant.save(session ? { session } : undefined);
        }

        const expenseMinor = body.expenseMinor ?? 0;
        const totalMinor = subtotalMinor + expenseMinor;
        const seq = await nextSequence(
          { tenantId, key: "purchase", branchId: body.branchId },
          session,
        );
        const number = `GRN-${String(seq).padStart(6, "0")}`;

        const payNow = body.payNowMinor ?? 0;
        if (payNow > totalMinor) {
          throw new AppError(400, "Pay now cannot exceed total", "INVALID_PAYMENT");
        }

        const [purchase] = await Purchase.create(
          [
            {
              tenantId,
              branchId: body.branchId,
              supplierId: body.supplierId,
              purchaseOrderId: body.purchaseOrderId,
              number,
              invoiceNo: body.invoiceNo ?? "",
              status: "received",
              lines,
              subtotalMinor,
              expenseMinor,
              totalMinor,
              paidMinor: payNow,
              paymentStatus: payNow <= 0 ? "unpaid" : payNow >= totalMinor ? "paid" : "partial",
              notes: body.notes ?? "",
              dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
              createdBy: req.auth!.userId,
            },
          ],
          session ? { session } : undefined,
        );

        for (const line of lines) {
          await applyStockMovement({
            tenantId,
            branchId: body.branchId,
            variantId: String(line.variantId),
            type: "purchase",
            qtyDelta: line.qty,
            unitCostMinor: line.unitCostMinor,
            createdBy: req.auth!.userId,
            refType: "purchase",
            refId: String(purchase._id),
            session,
          });
        }

        // payable increases by unpaid portion
        await postSupplierLedger({
          tenantId,
          supplierId: body.supplierId,
          type: "purchase",
          amountMinor: totalMinor,
          createdBy: req.auth!.userId,
          refType: "purchase",
          refId: String(purchase._id),
          note: `Purchase ${number}`,
          session,
        });

        if (payNow > 0) {
          const [payment] = await SupplierPayment.create(
            [
              {
                tenantId,
                supplierId: body.supplierId,
                purchaseId: purchase._id,
                amountMinor: payNow,
                method: body.payMethod ?? "cash",
                createdBy: req.auth!.userId,
              },
            ],
            session ? { session } : undefined,
          );
          await postSupplierLedger({
            tenantId,
            supplierId: body.supplierId,
            type: "payment",
            amountMinor: -payNow,
            createdBy: req.auth!.userId,
            refType: "supplier_payment",
            refId: String(payment._id),
            session,
          });
        }

        if (body.purchaseOrderId) {
          const po = await PurchaseOrder.findOne({
            _id: body.purchaseOrderId,
            tenantId,
            deletedAt: null,
          }).session(session ?? null);
          if (po) {
            for (const recv of body.lines) {
              const poLine = po.lines.find((l) => String(l.variantId) === recv.variantId);
              if (poLine) poLine.qtyReceived += recv.qty;
            }
            const allReceived = po.lines.every((l) => l.qtyReceived >= l.qtyOrdered);
            const anyReceived = po.lines.some((l) => l.qtyReceived > 0);
            po.status = allReceived ? "received" : anyReceived ? "partial" : po.status;
            await po.save(session ? { session } : undefined);
          }
        }

        return purchase;
      });

      await AuditLog.create({
        tenantId,
        actorUserId: req.auth!.userId,
        action: "purchase.receive",
        entityType: "Purchase",
        entityId: String(result._id),
        requestId: req.requestId,
        ip: req.ip,
      });

      res.status(201).json({
        data: {
          id: String(result._id),
          number: result.number,
          totalMinor: result.totalMinor,
          paymentStatus: result.paymentStatus,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export const supplierPaymentsRouter = Router();
supplierPaymentsRouter.use(authenticate, requireTenant);

supplierPaymentsRouter.get("/", requirePermission("purchases.view"), async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = { tenantId: req.auth!.tenantId, deletedAt: null };
    if (req.query.supplierId) filter.supplierId = String(req.query.supplierId);
    const rows = await SupplierPayment.find(filter).sort({ paidAt: -1 }).limit(100).lean();
    res.json({
      data: rows.map((p) => ({
        id: String(p._id),
        supplierId: String(p.supplierId),
        purchaseId: p.purchaseId ? String(p.purchaseId) : null,
        amountMinor: p.amountMinor,
        method: p.method,
        reference: p.reference,
        paidAt: p.paidAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

supplierPaymentsRouter.post(
  "/",
  requirePermission("purchases.create"),
  validate({
    body: z.object({
      supplierId: z.string().min(1),
      purchaseId: z.string().optional(),
      amountMinor: z.number().int().positive(),
      method: z.enum(["cash", "card", "transfer", "wallet"]),
      reference: z.string().optional(),
      notes: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const payment = await withTransaction(async (session) => {
        const [created] = await SupplierPayment.create(
          [
            {
              tenantId,
              supplierId: req.body.supplierId,
              purchaseId: req.body.purchaseId,
              amountMinor: req.body.amountMinor,
              method: req.body.method,
              reference: req.body.reference ?? "",
              notes: req.body.notes ?? "",
              createdBy: req.auth!.userId,
            },
          ],
          session ? { session } : undefined,
        );

        await postSupplierLedger({
          tenantId,
          supplierId: req.body.supplierId,
          type: "payment",
          amountMinor: -req.body.amountMinor,
          createdBy: req.auth!.userId,
          refType: "supplier_payment",
          refId: String(created._id),
          note: req.body.notes,
          session,
        });

        if (req.body.purchaseId) {
          const purchase = await Purchase.findOne({
            _id: req.body.purchaseId,
            tenantId,
            deletedAt: null,
          }).session(session ?? null);
          if (purchase) {
            purchase.paidMinor += req.body.amountMinor;
            purchase.paymentStatus =
              purchase.paidMinor >= purchase.totalMinor
                ? "paid"
                : purchase.paidMinor > 0
                  ? "partial"
                  : "unpaid";
            await purchase.save(session ? { session } : undefined);
          }
        }

        return created;
      });

      res.status(201).json({
        data: { id: String(payment._id), amountMinor: payment.amountMinor },
      });
    } catch (err) {
      next(err);
    }
  },
);
