import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as auth from "./auth.service.js";

export const authRouter = Router();

authRouter.post(
  "/login",
  validate({
    body: z.object({
      email: z.string().email(),
      password: z.string().min(4),
    }),
  }),
  (req, res, next) => void auth.loginWithPassword(req, res).catch(next),
);

authRouter.post(
  "/login/pin",
  validate({
    body: z.object({
      pin: z.string().min(4).max(6),
      tenantSlug: z.string().optional(),
    }),
  }),
  (req, res, next) => void auth.loginWithPin(req, res).catch(next),
);

authRouter.post("/refresh", (req, res, next) => void auth.refresh(req, res).catch(next));
authRouter.post("/logout", authenticate, (req, res, next) => void auth.logout(req, res).catch(next));
authRouter.get("/me", authenticate, (req, res, next) => void auth.me(req, res).catch(next));
authRouter.get("/sessions", authenticate, (req, res, next) => void auth.listSessions(req, res).catch(next));
authRouter.delete(
  "/sessions/:id",
  authenticate,
  validate({ params: z.object({ id: z.string().min(1) }) }),
  (req, res, next) => void auth.revokeSession(req, res).catch(next),
);
authRouter.post(
  "/change-password",
  authenticate,
  validate({
    body: z.object({
      currentPassword: z.string().min(4),
      newPassword: z.string().min(8),
    }),
  }),
  (req, res, next) => void auth.changePassword(req, res).catch(next),
);
