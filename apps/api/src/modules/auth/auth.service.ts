import { PERMISSIONS, type Permission } from "@mms/shared";
import { AppError } from "../../lib/errors.js";
import { hashPassword, verifyPassword, verifyPin } from "../../lib/password.js";
import { verifyRefreshToken } from "../../lib/tokens.js";
import { AuditLog, LoginHistory } from "../../models/audit.model.js";
import { RefreshSession } from "../../models/refresh-session.model.js";
import { Role } from "../../models/role.model.js";
import { User, type UserDoc } from "../../models/user.model.js";
import type { HydratedDocument } from "mongoose";
import { Tenant } from "../../models/tenant.model.js";
import { Branch } from "../../models/branch.model.js";
import { Register } from "../../models/register.model.js";
import { clearAuthCookies, issueTokensForUser, setAuthCookies } from "./auth.cookies.js";
import type { Request, Response } from "express";

async function permissionsForUser(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");
  const roles = await Role.find({ _id: { $in: user.roleIds }, deletedAt: null });
  const permissions = [...new Set(roles.flatMap((r) => r.permissions))] as Permission[];
  const roleKey = roles[0]?.key ?? "cashier";
  return { user, roles, permissions, roleKey };
}

function clientMeta(req: Request) {
  return {
    ip: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
  };
}

async function recordLogin(
  userId: string,
  tenantId: string | null,
  method: "password" | "pin" | "refresh",
  success: boolean,
  req: Request,
  message?: string,
) {
  await LoginHistory.create({
    userId,
    tenantId: tenantId || undefined,
    method,
    success,
    ...clientMeta(req),
    message,
  });
}

export async function loginWithPassword(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };
  const user = await User.findOne({ email: email.toLowerCase(), deletedAt: null });
  if (!user) {
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok || user.status !== "active") {
    await recordLogin(String(user._id), user.tenantId ? String(user.tenantId) : null, "password", false, req);
    throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  }

  const { roleKey, permissions } = await permissionsForUser(String(user._id));
  const tokens = await issueTokensForUser(user, { roleKey, ...clientMeta(req) });
  setAuthCookies(res, tokens);
  user.lastLoginAt = new Date();
  await user.save();
  await recordLogin(String(user._id), user.tenantId ? String(user.tenantId) : null, "password", true, req);
  await AuditLog.create({
    tenantId: user.tenantId,
    actorUserId: user._id,
    action: "auth.login",
    meta: { method: "password" },
    ip: req.ip,
    requestId: req.requestId,
  });

  return res.json({
    data: await serializeMe(user._id.toString(), permissions, roleKey),
  });
}

export async function loginWithPin(req: Request, res: Response) {
  const { pin, tenantSlug } = req.body as { pin: string; tenantSlug?: string };
  let tenantId: string | undefined;
  if (tenantSlug) {
    const tenant = await Tenant.findOne({ slug: tenantSlug, deletedAt: null });
    if (!tenant) throw new AppError(404, "Business not found", "TENANT_NOT_FOUND");
    tenantId = String(tenant._id);
  }

  const candidates = await User.find({
    pinHash: { $exists: true, $ne: null },
    status: "active",
    deletedAt: null,
    ...(tenantId ? { tenantId } : {}),
  });

  let matched: HydratedDocument<UserDoc> | null = null;
  for (const user of candidates) {
    if (user.pinHash && (await verifyPin(pin, user.pinHash))) {
      matched = user;
      break;
    }
  }

  if (!matched) throw new AppError(401, "Invalid PIN", "INVALID_PIN");

  const { roleKey, permissions } = await permissionsForUser(String(matched._id));
  const tokens = await issueTokensForUser(matched, { roleKey, ...clientMeta(req) });
  setAuthCookies(res, tokens);
  matched.lastLoginAt = new Date();
  await matched.save();
  await recordLogin(
    String(matched._id),
    matched.tenantId ? String(matched.tenantId) : null,
    "pin",
    true,
    req,
  );

  return res.json({
    data: await serializeMe(String(matched._id), permissions, roleKey),
  });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.refresh_token as string | undefined;
  if (!token) throw new AppError(401, "Refresh token missing", "UNAUTHENTICATED");

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError(401, "Invalid refresh token", "UNAUTHENTICATED");
  }

  const session = await RefreshSession.findOne({ jti: payload.jti });
  if (!session || session.revokedAt) {
    throw new AppError(401, "Session revoked", "SESSION_REVOKED");
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== "active" || user.sessionVersion !== payload.sessionVersion) {
    throw new AppError(401, "Invalid session", "UNAUTHENTICATED");
  }

  session.revokedAt = new Date();
  await session.save();

  const { roleKey, permissions } = await permissionsForUser(String(user._id));
  const tokens = await issueTokensForUser(user, { roleKey, ...clientMeta(req) });
  setAuthCookies(res, tokens);
  await recordLogin(String(user._id), user.tenantId ? String(user.tenantId) : null, "refresh", true, req);

  return res.json({
    data: await serializeMe(user._id.toString(), permissions, roleKey),
  });
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies?.refresh_token as string | undefined;
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await RefreshSession.updateOne({ jti: payload.jti }, { revokedAt: new Date() });
    } catch {
      // ignore
    }
  }
  if (req.auth) {
    await AuditLog.create({
      tenantId: req.auth.tenantId || undefined,
      actorUserId: req.auth.userId,
      action: "auth.logout",
      ip: req.ip,
      requestId: req.requestId,
    });
  }
  clearAuthCookies(res);
  return res.json({ data: { ok: true } });
}

export async function me(req: Request, res: Response) {
  if (!req.auth) throw new AppError(401, "Authentication required", "UNAUTHENTICATED");
  return res.json({
    data: await serializeMe(req.auth.userId, req.auth.permissions, req.auth.roleKey),
  });
}

export async function listSessions(req: Request, res: Response) {
  if (!req.auth) throw new AppError(401, "Authentication required", "UNAUTHENTICATED");
  const sessions = await RefreshSession.find({
    userId: req.auth.userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();
  return res.json({
    data: sessions.map((s) => ({
      id: String(s._id),
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      ip: s.ip,
      userAgent: s.userAgent,
    })),
  });
}

export async function revokeSession(req: Request, res: Response) {
  if (!req.auth) throw new AppError(401, "Authentication required", "UNAUTHENTICATED");
  const session = await RefreshSession.findOne({ _id: req.params.id, userId: req.auth.userId });
  if (!session) throw new AppError(404, "Session not found", "NOT_FOUND");
  session.revokedAt = new Date();
  await session.save();
  return res.json({ data: { ok: true } });
}

export async function changePassword(req: Request, res: Response) {
  if (!req.auth) throw new AppError(401, "Authentication required", "UNAUTHENTICATED");
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };
  const user = await User.findById(req.auth.userId);
  if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) throw new AppError(400, "Current password is incorrect", "INVALID_PASSWORD");
  user.passwordHash = await hashPassword(newPassword);
  user.sessionVersion += 1;
  await user.save();
  await RefreshSession.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
  clearAuthCookies(res);
  await AuditLog.create({
    tenantId: user.tenantId,
    actorUserId: user._id,
    action: "auth.password_change",
    ip: req.ip,
    requestId: req.requestId,
  });
  return res.json({ data: { ok: true, message: "Password updated. Please sign in again." } });
}

async function serializeMe(userId: string, permissions: Permission[], roleKey: string) {
  const user = await User.findById(userId).lean();
  if (!user) throw new AppError(404, "User not found", "USER_NOT_FOUND");

  const tenant = user.tenantId ? await Tenant.findById(user.tenantId).lean() : null;
  const branches = user.tenantId
    ? await Branch.find({
        tenantId: user.tenantId,
        deletedAt: null,
        ...(user.branchIds.length ? { _id: { $in: user.branchIds } } : {}),
      }).lean()
    : [];
  const registers = user.tenantId
    ? await Register.find({
        tenantId: user.tenantId,
        deletedAt: null,
        branchId: { $in: branches.map((b) => b._id) },
      }).lean()
    : [];

  return {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      roleKey,
      permissions,
      branchIds: user.branchIds.map(String),
      tenantId: user.tenantId ? String(user.tenantId) : null,
      mfaEnabled: user.mfaEnabled,
    },
    tenant: tenant
      ? {
          id: String(tenant._id),
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          currency: tenant.currency,
          timezone: tenant.timezone,
          locale: tenant.locale,
          logoUrl: tenant.logoUrl,
          featureFlags: tenant.featureFlags,
          taxSettings: tenant.taxSettings,
          receiptSettings: tenant.receiptSettings,
        }
      : null,
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
    permissionCatalog: PERMISSIONS,
  };
}
