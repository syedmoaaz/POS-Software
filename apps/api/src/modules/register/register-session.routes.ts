import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireTenant } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { AppError } from "../../lib/errors.js";
import { Register } from "../../models/register.model.js";
import { RegisterSession } from "../../models/register-session.model.js";
import { Sale } from "../../models/sale.model.js";
import { AuditLog } from "../../models/audit.model.js";

export const registerSessionsRouter = Router();
registerSessionsRouter.use(authenticate, requireTenant);

registerSessionsRouter.post(
  "/open",
  requirePermission("register.open"),
  validate({
    body: z.object({
      registerId: z.string().min(1),
      openingCashMinor: z.number().int().nonnegative(),
      notes: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const register = await Register.findOne({
        _id: req.body.registerId,
        tenantId,
        deletedAt: null,
        isActive: true,
      });
      if (!register) throw new AppError(404, "Register not found", "REGISTER_NOT_FOUND");

      const open = await RegisterSession.findOne({
        tenantId,
        registerId: register._id,
        status: "open",
      });
      if (open) throw new AppError(409, "Register already has an open session", "SESSION_OPEN");

      const session = await RegisterSession.create({
        tenantId,
        branchId: register.branchId,
        registerId: register._id,
        openedBy: req.auth!.userId,
        openingCashMinor: req.body.openingCashMinor,
        notes: req.body.notes ?? "",
        status: "open",
      });

      await AuditLog.create({
        tenantId,
        actorUserId: req.auth!.userId,
        action: "register.open",
        entityType: "RegisterSession",
        entityId: String(session._id),
        requestId: req.requestId,
        ip: req.ip,
      });

      res.status(201).json({
        data: {
          id: String(session._id),
          registerId: String(session.registerId),
          branchId: String(session.branchId),
          status: session.status,
          openingCashMinor: session.openingCashMinor,
          openedAt: session.openedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

registerSessionsRouter.get("/current", requirePermission("register.open"), async (req, res, next) => {
  try {
    const registerId = String(req.query.registerId ?? "");
    if (!registerId) throw new AppError(400, "registerId required", "VALIDATION_ERROR");
    const session = await RegisterSession.findOne({
      tenantId: req.auth!.tenantId,
      registerId,
      status: "open",
    }).lean();
    res.json({
      data: session
        ? {
            id: String(session._id),
            registerId: String(session.registerId),
            branchId: String(session.branchId),
            status: session.status,
            openingCashMinor: session.openingCashMinor,
            cashSalesMinor: session.cashSalesMinor,
            cashRefundsMinor: session.cashRefundsMinor,
            cashInMinor: session.cashInMinor,
            cashOutMinor: session.cashOutMinor,
            openedAt: session.openedAt,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

registerSessionsRouter.post(
  "/:id/cash-in",
  requirePermission("register.cash_in_out"),
  validate({ body: z.object({ amountMinor: z.number().int().positive(), note: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const session = await RegisterSession.findOne({
        _id: req.params.id,
        tenantId: req.auth!.tenantId,
        status: "open",
      });
      if (!session) throw new AppError(404, "Open session not found", "SESSION_NOT_FOUND");
      session.cashInMinor += req.body.amountMinor;
      await session.save();
      res.json({ data: { cashInMinor: session.cashInMinor } });
    } catch (err) {
      next(err);
    }
  },
);

registerSessionsRouter.post(
  "/:id/cash-out",
  requirePermission("register.cash_in_out"),
  validate({ body: z.object({ amountMinor: z.number().int().positive(), note: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const session = await RegisterSession.findOne({
        _id: req.params.id,
        tenantId: req.auth!.tenantId,
        status: "open",
      });
      if (!session) throw new AppError(404, "Open session not found", "SESSION_NOT_FOUND");
      session.cashOutMinor += req.body.amountMinor;
      await session.save();
      res.json({ data: { cashOutMinor: session.cashOutMinor } });
    } catch (err) {
      next(err);
    }
  },
);

registerSessionsRouter.post(
  "/:id/close",
  requirePermission("register.close"),
  validate({
    body: z.object({
      closingCashMinor: z.number().int().nonnegative(),
      blindClose: z.boolean().optional(),
      notes: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const session = await RegisterSession.findOne({
        _id: req.params.id,
        tenantId: req.auth!.tenantId,
        status: "open",
      });
      if (!session) throw new AppError(404, "Open session not found", "SESSION_NOT_FOUND");

      const expected =
        session.openingCashMinor +
        session.cashSalesMinor +
        session.cashInMinor -
        session.cashOutMinor -
        session.cashRefundsMinor;

      session.expectedCashMinor = expected;
      session.closingCashMinor = req.body.closingCashMinor;
      session.varianceMinor = req.body.closingCashMinor - expected;
      session.blindClose = req.body.blindClose ?? false;
      session.status = "closed";
      session.closedBy = req.auth!.userId as never;
      session.closedAt = new Date();
      if (req.body.notes) session.notes = req.body.notes;
      await session.save();

      await AuditLog.create({
        tenantId: req.auth!.tenantId,
        actorUserId: req.auth!.userId,
        action: "register.close",
        entityType: "RegisterSession",
        entityId: String(session._id),
        meta: {
          expectedCashMinor: session.expectedCashMinor,
          closingCashMinor: session.closingCashMinor,
          varianceMinor: session.varianceMinor,
        },
        requestId: req.requestId,
        ip: req.ip,
      });

      res.json({
        data: {
          id: String(session._id),
          status: session.status,
          expectedCashMinor: session.expectedCashMinor,
          closingCashMinor: session.closingCashMinor,
          varianceMinor: session.varianceMinor,
          closedAt: session.closedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

registerSessionsRouter.get("/:id", requirePermission("register.open"), async (req, res, next) => {
  try {
    const session = await RegisterSession.findOne({
      _id: req.params.id,
      tenantId: req.auth!.tenantId,
    }).lean();
    if (!session) throw new AppError(404, "Session not found", "SESSION_NOT_FOUND");
    res.json({
      data: {
        id: String(session._id),
        registerId: String(session.registerId),
        branchId: String(session.branchId),
        status: session.status,
        openingCashMinor: session.openingCashMinor,
        cashSalesMinor: session.cashSalesMinor,
        cashRefundsMinor: session.cashRefundsMinor,
        cashInMinor: session.cashInMinor,
        cashOutMinor: session.cashOutMinor,
        expectedCashMinor: session.expectedCashMinor,
        closingCashMinor: session.closingCashMinor,
        varianceMinor: session.varianceMinor,
        openedAt: session.openedAt,
        closedAt: session.closedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

registerSessionsRouter.get("/:id/x-report", requirePermission("register.open"), async (req, res, next) => {
  try {
    const session = await RegisterSession.findOne({
      _id: req.params.id,
      tenantId: req.auth!.tenantId,
    });
    if (!session) throw new AppError(404, "Session not found", "SESSION_NOT_FOUND");

    const sales = await Sale.find({
      tenantId: req.auth!.tenantId,
      registerSessionId: session._id,
      deletedAt: null,
      status: { $ne: "void" },
    }).lean();

    const gross = sales.reduce((s, x) => s + x.totalMinor, 0);
    const byMethod: Record<string, number> = {};
    for (const sale of sales) {
      for (const p of sale.payments) {
        byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amountMinor;
      }
    }

    res.json({
      data: {
        type: "X",
        sessionId: String(session._id),
        saleCount: sales.length,
        grossSalesMinor: gross,
        cashSalesMinor: session.cashSalesMinor,
        cashRefundsMinor: session.cashRefundsMinor,
        paymentsByMethod: byMethod,
        expectedCashMinor:
          session.openingCashMinor +
          session.cashSalesMinor +
          session.cashInMinor -
          session.cashOutMinor -
          session.cashRefundsMinor,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

registerSessionsRouter.get("/:id/z-report", requirePermission("register.close"), async (req, res, next) => {
  try {
    const session = await RegisterSession.findOne({
      _id: req.params.id,
      tenantId: req.auth!.tenantId,
    });
    if (!session) throw new AppError(404, "Session not found", "SESSION_NOT_FOUND");
    if (session.status !== "closed") {
      throw new AppError(400, "Close the register to generate Z report", "SESSION_OPEN");
    }

    const sales = await Sale.find({
      tenantId: req.auth!.tenantId,
      registerSessionId: session._id,
      deletedAt: null,
    }).lean();

    res.json({
      data: {
        type: "Z",
        sessionId: String(session._id),
        saleCount: sales.length,
        grossSalesMinor: sales.reduce((s, x) => s + x.totalMinor, 0),
        openingCashMinor: session.openingCashMinor,
        cashSalesMinor: session.cashSalesMinor,
        cashRefundsMinor: session.cashRefundsMinor,
        cashInMinor: session.cashInMinor,
        cashOutMinor: session.cashOutMinor,
        expectedCashMinor: session.expectedCashMinor,
        closingCashMinor: session.closingCashMinor,
        varianceMinor: session.varianceMinor,
        closedAt: session.closedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});
