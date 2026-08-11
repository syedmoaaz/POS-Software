import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireSuperAdmin } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { Tenant } from "../../models/tenant.model.js";
import { Subscription, SubscriptionPlan } from "../../models/subscription.model.js";
import { User } from "../../models/user.model.js";
import { AuditLog } from "../../models/audit.model.js";
import { AppError } from "../../lib/errors.js";
import { issueTokensForUser, setAuthCookies } from "../auth/auth.cookies.js";
import { Role } from "../../models/role.model.js";

export const adminRouter = Router();
adminRouter.use(authenticate, requireSuperAdmin);

adminRouter.get("/metrics", requirePermission("platform.metrics.view"), async (_req, res, next) => {
  try {
    const [total, active, trial, suspended, plans] = await Promise.all([
      Tenant.countDocuments({ deletedAt: null }),
      Tenant.countDocuments({ status: "active", deletedAt: null }),
      Tenant.countDocuments({ status: "trial", deletedAt: null }),
      Tenant.countDocuments({ status: "suspended", deletedAt: null }),
      SubscriptionPlan.find({ active: true }).lean(),
    ]);
    const subscriptions = await Subscription.find({ status: { $in: ["active", "trialing"] } }).lean();
    const planMap = new Map(plans.map((p) => [String(p._id), p]));
    const mrrMinor = subscriptions.reduce((sum, s) => {
      const plan = planMap.get(String(s.planId));
      return sum + (s.status === "active" && plan ? plan.priceMinor : 0);
    }, 0);

    res.json({
      data: {
        totalTenants: total,
        active,
        trials: trial,
        suspended,
        mrrMinor,
        planDistribution: plans.map((p) => ({
          code: p.code,
          name: p.name,
          count: subscriptions.filter((s) => String(s.planId) === String(p._id)).length,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/tenants", requirePermission("platform.tenants.manage"), async (_req, res, next) => {
  try {
    const tenants = await Tenant.find({ deletedAt: null }).sort({ createdAt: -1 }).lean();
    res.json({
      data: tenants.map((t) => ({
        id: String(t._id),
        name: t.name,
        slug: t.slug,
        status: t.status,
        currency: t.currency,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post(
  "/tenants/:id/suspend",
  requirePermission("platform.tenants.manage"),
  validate({ params: z.object({ id: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const tenant = await Tenant.findById(req.params.id);
      if (!tenant) throw new AppError(404, "Tenant not found", "TENANT_NOT_FOUND");
      tenant.status = "suspended";
      await tenant.save();
      await AuditLog.create({
        actorUserId: req.auth!.userId,
        action: "tenant.suspend",
        entityType: "Tenant",
        entityId: String(tenant._id),
        requestId: req.requestId,
        ip: req.ip,
      });
      res.json({ data: { id: String(tenant._id), status: tenant.status } });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.post(
  "/tenants/:id/activate",
  requirePermission("platform.tenants.manage"),
  validate({ params: z.object({ id: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const tenant = await Tenant.findById(req.params.id);
      if (!tenant) throw new AppError(404, "Tenant not found", "TENANT_NOT_FOUND");
      tenant.status = "active";
      await tenant.save();
      await AuditLog.create({
        actorUserId: req.auth!.userId,
        action: "tenant.activate",
        entityType: "Tenant",
        entityId: String(tenant._id),
        requestId: req.requestId,
        ip: req.ip,
      });
      res.json({ data: { id: String(tenant._id), status: tenant.status } });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.post(
  "/impersonate",
  requirePermission("platform.impersonate"),
  validate({ body: z.object({ tenantId: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const tenant = await Tenant.findById(req.body.tenantId);
      if (!tenant || tenant.deletedAt) throw new AppError(404, "Tenant not found", "TENANT_NOT_FOUND");

      const ownerRole = await Role.findOne({ tenantId: tenant._id, key: "owner" });
      const owner = await User.findOne({
        tenantId: tenant._id,
        roleIds: ownerRole?._id,
        status: "active",
        deletedAt: null,
      });
      if (!owner) throw new AppError(404, "Tenant owner not found", "OWNER_NOT_FOUND");

      const adminUser = await User.findById(req.auth!.userId);
      if (!adminUser) throw new AppError(401, "Invalid session", "UNAUTHENTICATED");

      const tokens = await issueTokensForUser(adminUser, {
        roleKey: "super_admin",
        impersonatingTenantId: String(tenant._id),
        ip: req.ip,
        userAgent: req.get("user-agent") ?? undefined,
      });
      setAuthCookies(res, tokens);

      await AuditLog.create({
        tenantId: tenant._id,
        actorUserId: adminUser._id,
        action: "platform.impersonate",
        entityType: "Tenant",
        entityId: String(tenant._id),
        meta: { asUserId: String(owner._id) },
        requestId: req.requestId,
        ip: req.ip,
      });

      res.json({
        data: {
          ok: true,
          tenantId: String(tenant._id),
          tenantName: tenant.name,
          message: "Impersonation session issued (audited)",
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.get("/audit-logs", requirePermission("platform.logs.view"), async (_req, res, next) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({
      data: logs.map((l) => ({
        id: String(l._id),
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        actorUserId: String(l.actorUserId),
        tenantId: l.tenantId ? String(l.tenantId) : null,
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/health", requirePermission("platform.health.view"), async (_req, res) => {
  res.json({
    data: {
      api: "healthy",
      database: "healthy",
      time: new Date().toISOString(),
    },
  });
});
