import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireTenant } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { AppError } from "../../lib/errors.js";
import {
  Customer,
  CustomerLedger,
  LoyaltyTransaction,
} from "../../models/customer.model.js";
import { postCustomerLedger } from "../../lib/ledgers.js";
import { withTransaction } from "../../lib/stock.js";
import { Tenant } from "../../models/tenant.model.js";
import { Sale } from "../../models/sale.model.js";

export const customersRouter = Router();
customersRouter.use(authenticate, requireTenant);

customersRouter.get("/", requirePermission("customers.view"), async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const filter: Record<string, unknown> = { tenantId: req.auth!.tenantId, deletedAt: null };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }
    const rows = await Customer.find(filter).sort({ name: 1 }).limit(100).lean();
    res.json({
      data: rows.map((c) => ({
        id: String(c._id),
        name: c.name,
        phone: c.phone,
        email: c.email,
        group: c.group,
        balanceMinor: c.balanceMinor,
        creditLimitMinor: c.creditLimitMinor,
        storeCreditMinor: c.storeCreditMinor,
        loyaltyPoints: c.loyaltyPoints,
        isActive: c.isActive,
      })),
    });
  } catch (err) {
    next(err);
  }
});

customersRouter.post(
  "/",
  requirePermission("customers.manage"),
  validate({
    body: z.object({
      name: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      address: z.string().optional(),
      group: z.enum(["retail", "wholesale"]).optional(),
      creditLimitMinor: z.number().int().nonnegative().optional(),
      notes: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const c = await Customer.create({
        tenantId: req.auth!.tenantId,
        name: req.body.name,
        phone: req.body.phone ?? "",
        email: req.body.email ?? "",
        address: req.body.address ?? "",
        group: req.body.group ?? "retail",
        creditLimitMinor: req.body.creditLimitMinor ?? 0,
        notes: req.body.notes ?? "",
      });
      res.status(201).json({ data: { id: String(c._id), name: c.name } });
    } catch (err) {
      next(err);
    }
  },
);

customersRouter.get("/:id", requirePermission("customers.view"), async (req, res, next) => {
  try {
    const c = await Customer.findOne({
      _id: req.params.id,
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    }).lean();
    if (!c) throw new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND");
    res.json({
      data: {
        id: String(c._id),
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        group: c.group,
        balanceMinor: c.balanceMinor,
        creditLimitMinor: c.creditLimitMinor,
        storeCreditMinor: c.storeCreditMinor,
        loyaltyPoints: c.loyaltyPoints,
        notes: c.notes,
        isActive: c.isActive,
      },
    });
  } catch (err) {
    next(err);
  }
});

customersRouter.patch(
  "/:id",
  requirePermission("customers.manage"),
  validate({
    body: z.object({
      name: z.string().min(1).optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      group: z.enum(["retail", "wholesale"]).optional(),
      creditLimitMinor: z.number().int().nonnegative().optional(),
      notes: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const c = await Customer.findOne({
        _id: req.params.id,
        tenantId: req.auth!.tenantId,
        deletedAt: null,
      });
      if (!c) throw new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND");
      if (req.body.creditLimitMinor !== undefined && !req.auth!.permissions.includes("customers.credit.manage")) {
        throw new AppError(403, "Cannot change credit limit", "FORBIDDEN");
      }
      Object.assign(c, req.body);
      await c.save();
      res.json({ data: { id: String(c._id), name: c.name } });
    } catch (err) {
      next(err);
    }
  },
);

customersRouter.get("/:id/ledger", requirePermission("customers.view"), async (req, res, next) => {
  try {
    const rows = await CustomerLedger.find({
      tenantId: req.auth!.tenantId,
      customerId: req.params.id,
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

customersRouter.get("/:id/statement", requirePermission("customers.view"), async (req, res, next) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    }).lean();
    if (!customer) throw new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND");

    const ledger = await CustomerLedger.find({
      tenantId: req.auth!.tenantId,
      customerId: customer._id,
    })
      .sort({ createdAt: 1 })
      .lean();

    const sales = await Sale.find({
      tenantId: req.auth!.tenantId,
      customerId: customer._id,
      deletedAt: null,
    })
      .sort({ soldAt: -1 })
      .limit(20)
      .lean();

    res.json({
      data: {
        customer: {
          id: String(customer._id),
          name: customer.name,
          phone: customer.phone,
          balanceMinor: customer.balanceMinor,
          creditLimitMinor: customer.creditLimitMinor,
        },
        ledger: ledger.map((r) => ({
          id: String(r._id),
          type: r.type,
          amountMinor: r.amountMinor,
          balanceAfterMinor: r.balanceAfterMinor,
          createdAt: r.createdAt,
          note: r.note,
        })),
        recentSales: sales.map((s) => ({
          id: String(s._id),
          receiptNo: s.receiptNo,
          totalMinor: s.totalMinor,
          soldAt: s.soldAt,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

customersRouter.post(
  "/:id/payments",
  requirePermission("customers.credit.manage"),
  validate({
    body: z.object({
      amountMinor: z.number().int().positive(),
      method: z.enum(["cash", "card", "transfer", "wallet", "store_credit"]),
      type: z.enum(["payment", "advance"]).default("payment"),
      note: z.string().optional(),
      reference: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const result = await withTransaction(async (session) => {
        const amount =
          req.body.type === "advance" ? -req.body.amountMinor : -req.body.amountMinor;

        const posted = await postCustomerLedger({
          tenantId,
          customerId: req.params.id,
          type: req.body.type === "advance" ? "advance" : "payment",
          amountMinor: amount,
          createdBy: req.auth!.userId,
          note: req.body.note ?? `Payment via ${req.body.method}`,
          refType: "customer_payment",
          session,
        });

        if (req.body.method === "store_credit" && req.body.type === "advance") {
          posted.customer.storeCreditMinor += req.body.amountMinor;
          await posted.customer.save(session ? { session } : undefined);
        }

        return posted;
      });

      res.status(201).json({
        data: {
          customerId: String(result.customer._id),
          balanceMinor: result.customer.balanceMinor,
          storeCreditMinor: result.customer.storeCreditMinor,
          ledgerId: String(result.entry._id),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

customersRouter.post(
  "/:id/loyalty",
  requirePermission("customers.manage"),
  validate({
    body: z.object({
      type: z.enum(["earn", "redeem", "adjust"]),
      points: z.number().int(),
      note: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = await Tenant.findById(req.auth!.tenantId);
      if (!tenant?.featureFlags?.loyalty) {
        throw new AppError(400, "Loyalty is disabled for this business", "LOYALTY_DISABLED");
      }

      const customer = await Customer.findOne({
        _id: req.params.id,
        tenantId: req.auth!.tenantId,
        deletedAt: null,
      });
      if (!customer) throw new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND");

      let delta = req.body.points;
      if (req.body.type === "redeem") delta = -Math.abs(req.body.points);
      if (req.body.type === "earn") delta = Math.abs(req.body.points);

      const nextPoints = customer.loyaltyPoints + delta;
      if (nextPoints < 0) throw new AppError(400, "Insufficient loyalty points", "LOYALTY_SHORT");

      customer.loyaltyPoints = nextPoints;
      await customer.save();

      const txn = await LoyaltyTransaction.create({
        tenantId: req.auth!.tenantId,
        customerId: customer._id,
        type: req.body.type,
        points: delta,
        balanceAfter: nextPoints,
        note: req.body.note ?? "",
        createdBy: req.auth!.userId,
      });

      res.status(201).json({
        data: {
          loyaltyPoints: customer.loyaltyPoints,
          txnId: String(txn._id),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

/** Record credit sale impact — called optionally from checkout later; exposed for Phase 8 settlement. */
customersRouter.post(
  "/:id/credit-charge",
  requirePermission("customers.credit.manage"),
  validate({
    body: z.object({
      amountMinor: z.number().int().positive(),
      note: z.string().optional(),
      saleId: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = await Tenant.findById(req.auth!.tenantId);
      if (!tenant?.featureFlags?.customerCredit) {
        throw new AppError(400, "Customer credit is disabled", "CREDIT_DISABLED");
      }
      const posted = await postCustomerLedger({
        tenantId: req.auth!.tenantId!,
        customerId: req.params.id,
        type: "credit",
        amountMinor: req.body.amountMinor,
        createdBy: req.auth!.userId,
        note: req.body.note ?? "Credit charge",
        refType: req.body.saleId ? "sale" : undefined,
        refId: req.body.saleId,
        enforceCreditLimit: true,
      });
      res.status(201).json({
        data: {
          balanceMinor: posted.customer.balanceMinor,
          ledgerId: String(posted.entry._id),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
