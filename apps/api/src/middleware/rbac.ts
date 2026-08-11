import type { RequestHandler } from "express";
import type { Permission } from "@mms/shared";
import { AppError } from "../lib/errors.js";

/** Ensures tenantId comes from auth context — never from client body. */
export const requireTenant: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(new AppError(401, "Authentication required", "UNAUTHENTICATED"));
  if (!req.auth.tenantId) {
    return next(new AppError(403, "Tenant context required", "TENANT_REQUIRED"));
  }
  next();
};

export function requirePermission(...needed: Permission[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new AppError(401, "Authentication required", "UNAUTHENTICATED"));
    const ok = needed.every((p) => req.auth!.permissions.includes(p));
    if (!ok) return next(new AppError(403, "Permission denied", "FORBIDDEN"));
    next();
  };
}

export function requireAnyPermission(...needed: Permission[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new AppError(401, "Authentication required", "UNAUTHENTICATED"));
    const ok = needed.some((p) => req.auth!.permissions.includes(p));
    if (!ok) return next(new AppError(403, "Permission denied", "FORBIDDEN"));
    next();
  };
}

export const requireSuperAdmin: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(new AppError(401, "Authentication required", "UNAUTHENTICATED"));
  if (!req.auth.permissions.some((p) => p.startsWith("platform."))) {
    return next(new AppError(403, "Super admin only", "FORBIDDEN"));
  }
  next();
};
