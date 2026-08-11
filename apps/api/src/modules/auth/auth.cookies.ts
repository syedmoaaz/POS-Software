import type { CookieOptions, Response } from "express";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { signAccessToken, signRefreshToken } from "../../lib/tokens.js";
import { RefreshSession } from "../../models/refresh-session.model.js";
import type { UserDoc } from "../../models/user.model.js";
import type { Types } from "mongoose";

type AuthUser = UserDoc & {
  _id: Types.ObjectId;
  sessionVersion: number;
  tenantId?: Types.ObjectId | null;
};

const isProd = env.NODE_ENV === "production";

function baseCookie(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    domain: env.COOKIE_DOMAIN,
    path: "/",
  };
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
) {
  res.cookie("access_token", tokens.accessToken, {
    ...baseCookie(),
    maxAge: 15 * 60 * 1000,
  });
  res.cookie("refresh_token", tokens.refreshToken, {
    ...baseCookie(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie("access_token", baseCookie());
  res.clearCookie("refresh_token", baseCookie());
}

export async function issueTokensForUser(
  user: AuthUser,
  meta: { roleKey: string; ip?: string; userAgent?: string; impersonatingTenantId?: string },
) {
  const jti = randomUUID();
  const accessToken = signAccessToken({
    sub: String(user._id),
    tenantId: user.tenantId ? String(user.tenantId) : null,
    roleKey: meta.roleKey,
    sessionVersion: user.sessionVersion,
    impersonatingTenantId: meta.impersonatingTenantId,
  });
  const refreshToken = signRefreshToken({
    sub: String(user._id),
    sessionVersion: user.sessionVersion,
    jti,
  });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await RefreshSession.create({
    userId: user._id,
    jti,
    expiresAt,
    userAgent: meta.userAgent,
    ip: meta.ip,
  });

  return { accessToken, refreshToken, jti };
}
