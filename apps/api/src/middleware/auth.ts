import type { RequestHandler } from "express";
import type { Permission } from "@mms/shared";
import { AppError } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/tokens.js";
import { User } from "../models/user.model.js";
import { Role } from "../models/role.model.js";
import { Tenant } from "../models/tenant.model.js";

export type AuthContext = {
  userId: string;
  tenantId: string | null;
  roleKey: string;
  permissions: Permission[];
  branchIds: string[];
  sessionVersion: number;
  impersonatingTenantId?: string;
  email: string;
  name: string;
};

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: AuthContext;
    }
  }
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.access_token as string | undefined;
    if (!token) throw new AppError(401, "Authentication required", "UNAUTHENTICATED");

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (!user || user.status !== "active" || user.deletedAt) {
      throw new AppError(401, "Invalid session", "UNAUTHENTICATED");
    }
    if (user.sessionVersion !== payload.sessionVersion) {
      throw new AppError(401, "Session revoked", "SESSION_REVOKED");
    }

    const roles = await Role.find({ _id: { $in: user.roleIds }, deletedAt: null });
    const permissions = [...new Set(roles.flatMap((r) => r.permissions))] as Permission[];
    const roleKey = roles[0]?.key ?? payload.roleKey;

    let tenantId = user.tenantId ? String(user.tenantId) : null;
    if (payload.impersonatingTenantId && permissions.includes("platform.impersonate")) {
      tenantId = payload.impersonatingTenantId;
    }

    if (tenantId) {
      const tenant = await Tenant.findById(tenantId);
      if (!tenant || tenant.deletedAt) {
        throw new AppError(403, "Tenant not found", "TENANT_NOT_FOUND");
      }
      if (tenant.status === "suspended" || tenant.status === "cancelled") {
        if (!permissions.some((p) => p.startsWith("platform."))) {
          throw new AppError(403, "Tenant is not active", "TENANT_INACTIVE");
        }
      }
    }

    req.auth = {
      userId: String(user._id),
      tenantId,
      roleKey,
      permissions,
      branchIds: user.branchIds.map(String),
      sessionVersion: user.sessionVersion,
      impersonatingTenantId: payload.impersonatingTenantId,
      email: user.email,
      name: user.name,
    };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError(401, "Invalid or expired token", "UNAUTHENTICATED"));
  }
};

export const optionalAuthenticate: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.access_token as string | undefined;
  if (!token) return next();
  return authenticate(req, res, next);
};
