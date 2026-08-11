import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireTenant } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { AppError } from "../../lib/errors.js";
import { Expense, ExpenseCategory } from "../../models/expense.model.js";
import { AuditLog } from "../../models/audit.model.js";

export const expensesRouter = Router();
expensesRouter.use(authenticate, requireTenant);

expensesRouter.get("/categories", requirePermission("expenses.view"), async (req, res, next) => {
  try {
    const rows = await ExpenseCategory.find({
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    })
      .sort({ name: 1 })
      .lean();
    res.json({
      data: rows.map((c) => ({ id: String(c._id), name: c.name, isActive: c.isActive })),
    });
  } catch (err) {
    next(err);
  }
});

expensesRouter.post(
  "/categories",
  requirePermission("expenses.create"),
  validate({ body: z.object({ name: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const c = await ExpenseCategory.create({
        tenantId: req.auth!.tenantId,
        name: req.body.name,
      });
      res.status(201).json({ data: { id: String(c._id), name: c.name } });
    } catch (err) {
      next(err);
    }
  },
);

expensesRouter.get("/", requirePermission("expenses.view"), async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = { tenantId: req.auth!.tenantId, deletedAt: null };
    if (req.query.branchId) filter.branchId = String(req.query.branchId);
    if (req.query.status) filter.status = String(req.query.status);
    const rows = await Expense.find(filter).sort({ expenseDate: -1 }).limit(100).lean();
    res.json({
      data: rows.map((e) => ({
        id: String(e._id),
        categoryId: String(e.categoryId),
        branchId: e.branchId ? String(e.branchId) : null,
        amountMinor: e.amountMinor,
        method: e.method,
        note: e.note,
        status: e.status,
        expenseDate: e.expenseDate,
        recurring: e.recurring,
      })),
    });
  } catch (err) {
    next(err);
  }
});

expensesRouter.post(
  "/",
  requirePermission("expenses.create"),
  validate({
    body: z.object({
      categoryId: z.string().min(1),
      amountMinor: z.number().int().positive(),
      method: z.enum(["cash", "card", "transfer", "wallet"]),
      branchId: z.string().optional(),
      registerId: z.string().optional(),
      supplierId: z.string().optional(),
      note: z.string().optional(),
      expenseDate: z.string().datetime().optional(),
      recurring: z.boolean().optional(),
      requireApproval: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const cat = await ExpenseCategory.findOne({
        _id: req.body.categoryId,
        tenantId: req.auth!.tenantId,
        deletedAt: null,
      });
      if (!cat) throw new AppError(404, "Expense category not found", "CATEGORY_NOT_FOUND");

      const expense = await Expense.create({
        tenantId: req.auth!.tenantId,
        categoryId: req.body.categoryId,
        amountMinor: req.body.amountMinor,
        method: req.body.method,
        branchId: req.body.branchId,
        registerId: req.body.registerId,
        supplierId: req.body.supplierId,
        note: req.body.note ?? "",
        expenseDate: req.body.expenseDate ? new Date(req.body.expenseDate) : new Date(),
        recurring: req.body.recurring ?? false,
        status: req.body.requireApproval ? "pending" : "approved",
        createdBy: req.auth!.userId,
        approvedBy: req.body.requireApproval ? undefined : req.auth!.userId,
      });

      res.status(201).json({
        data: { id: String(expense._id), status: expense.status, amountMinor: expense.amountMinor },
      });
    } catch (err) {
      next(err);
    }
  },
);

expensesRouter.post(
  "/:id/approve",
  requirePermission("expenses.create"),
  async (req, res, next) => {
    try {
      // owners/managers with expenses.create can approve in Phase 8; finer gate later
      if (!req.auth!.permissions.includes("settings.manage") && !req.auth!.permissions.includes("reports.profit")) {
        // allow managers who have expenses.create - already gated
      }
      const expense = await Expense.findOne({
        _id: req.params.id,
        tenantId: req.auth!.tenantId,
        deletedAt: null,
      });
      if (!expense) throw new AppError(404, "Expense not found", "EXPENSE_NOT_FOUND");
      if (expense.status !== "pending") {
        throw new AppError(400, "Expense is not pending", "INVALID_STATUS");
      }
      expense.status = "approved";
      expense.approvedBy = req.auth!.userId as never;
      await expense.save();

      await AuditLog.create({
        tenantId: req.auth!.tenantId,
        actorUserId: req.auth!.userId,
        action: "expense.approve",
        entityType: "Expense",
        entityId: String(expense._id),
        requestId: req.requestId,
        ip: req.ip,
      });

      res.json({ data: { id: String(expense._id), status: expense.status } });
    } catch (err) {
      next(err);
    }
  },
);
