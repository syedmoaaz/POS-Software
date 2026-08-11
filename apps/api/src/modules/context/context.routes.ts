import { Router } from "express";
import { PERMISSIONS } from "@mms/shared";
import { authenticate } from "../../middleware/auth.js";
import { requireTenant } from "../../middleware/rbac.js";
import { Branch } from "../../models/branch.model.js";
import { Register } from "../../models/register.model.js";
import { Tenant } from "../../models/tenant.model.js";
import { Subscription, SubscriptionPlan } from "../../models/subscription.model.js";
import { AppError } from "../../lib/errors.js";

export const contextRouter = Router();

contextRouter.get("/", authenticate, requireTenant, async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId!;
    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) throw new AppError(404, "Tenant not found", "TENANT_NOT_FOUND");

    const branches = await Branch.find({ tenantId, deletedAt: null, isActive: true }).lean();
    const registers = await Register.find({ tenantId, deletedAt: null, isActive: true }).lean();
    const subscription = await Subscription.findOne({ tenantId }).sort({ createdAt: -1 }).lean();
    const plan = subscription
      ? await SubscriptionPlan.findById(subscription.planId).lean()
      : null;

    res.json({
      data: {
        tenant: {
          id: String(tenant._id),
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          currency: tenant.currency,
          timezone: tenant.timezone,
          featureFlags: tenant.featureFlags,
          limits: tenant.limits,
          taxSettings: tenant.taxSettings,
          receiptSettings: tenant.receiptSettings,
        },
        branches: branches.map((b) => ({
          id: String(b._id),
          name: b.name,
          code: b.code,
          address: b.address,
        })),
        registers: registers.map((r) => ({
          id: String(r._id),
          branchId: String(r.branchId),
          name: r.name,
          code: r.code,
        })),
        subscription: subscription
          ? {
              id: String(subscription._id),
              status: subscription.status,
              trialEndsAt: subscription.trialEndsAt,
              plan: plan
                ? { id: String(plan._id), code: plan.code, name: plan.name, limits: plan.limits }
                : null,
            }
          : null,
        permissions: req.auth!.permissions,
        permissionCatalog: PERMISSIONS,
      },
    });
  } catch (err) {
    next(err);
  }
});
