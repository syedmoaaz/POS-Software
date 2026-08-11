import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireTenant } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { Branch } from "../../models/branch.model.js";
import { Register } from "../../models/register.model.js";
import { AppError } from "../../lib/errors.js";
import { AuditLog } from "../../models/audit.model.js";

export const branchesRouter = Router();

branchesRouter.use(authenticate, requireTenant);

branchesRouter.get("/", requirePermission("branches.view"), async (req, res, next) => {
  try {
    const branches = await Branch.find({ tenantId: req.auth!.tenantId, deletedAt: null }).lean();
    res.json({
      data: branches.map((b) => ({
        id: String(b._id),
        name: b.name,
        code: b.code,
        address: b.address,
        phone: b.phone,
        isActive: b.isActive,
      })),
    });
  } catch (err) {
    next(err);
  }
});

branchesRouter.post(
  "/",
  requirePermission("branches.manage"),
  validate({
    body: z.object({
      name: z.string().min(2),
      code: z.string().min(2).max(10),
      address: z.string().optional(),
      phone: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const branch = await Branch.create({
        tenantId: req.auth!.tenantId,
        name: req.body.name,
        code: String(req.body.code).toUpperCase(),
        address: req.body.address ?? "",
        phone: req.body.phone ?? "",
      });
      await AuditLog.create({
        tenantId: req.auth!.tenantId,
        actorUserId: req.auth!.userId,
        action: "branch.create",
        entityType: "Branch",
        entityId: String(branch._id),
        requestId: req.requestId,
        ip: req.ip,
      });
      res.status(201).json({
        data: { id: String(branch._id), name: branch.name, code: branch.code },
      });
    } catch (err) {
      next(err);
    }
  },
);

export const registersRouter = Router();
registersRouter.use(authenticate, requireTenant);

registersRouter.get("/", requirePermission("registers.view"), async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = { tenantId: req.auth!.tenantId, deletedAt: null };
    if (req.query.branchId) filter.branchId = req.query.branchId;
    const registers = await Register.find(filter).lean();
    res.json({
      data: registers.map((r) => ({
        id: String(r._id),
        branchId: String(r.branchId),
        name: r.name,
        code: r.code,
        isActive: r.isActive,
      })),
    });
  } catch (err) {
    next(err);
  }
});

registersRouter.post(
  "/",
  requirePermission("registers.manage"),
  validate({
    body: z.object({
      branchId: z.string().min(1),
      name: z.string().min(2),
      code: z.string().min(2).max(20),
    }),
  }),
  async (req, res, next) => {
    try {
      const branch = await Branch.findOne({
        _id: req.body.branchId,
        tenantId: req.auth!.tenantId,
        deletedAt: null,
      });
      if (!branch) throw new AppError(404, "Branch not found", "BRANCH_NOT_FOUND");

      const register = await Register.create({
        tenantId: req.auth!.tenantId,
        branchId: branch._id,
        name: req.body.name,
        code: String(req.body.code).toUpperCase(),
      });
      res.status(201).json({
        data: {
          id: String(register._id),
          branchId: String(register.branchId),
          name: register.name,
          code: register.code,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
