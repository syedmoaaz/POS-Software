import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type AccessTokenPayload = {
  sub: string;
  tenantId: string | null;
  roleKey: string;
  type: "access";
  sessionVersion: number;
  impersonatingTenantId?: string;
};

export type RefreshTokenPayload = {
  sub: string;
  type: "refresh";
  sessionVersion: number;
  jti: string;
};

export function signAccessToken(payload: Omit<AccessTokenPayload, "type">) {
  return jwt.sign({ ...payload, type: "access" }, env.ACCESS_TOKEN_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, "type">) {
  return jwt.sign({ ...payload, type: "refresh" }, env.REFRESH_TOKEN_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string) {
  const payload = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as AccessTokenPayload;
  if (payload.type !== "access") throw new Error("Invalid access token");
  return payload;
}

export function verifyRefreshToken(token: string) {
  const payload = jwt.verify(token, env.REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
  if (payload.type !== "refresh") throw new Error("Invalid refresh token");
  return payload;
}
