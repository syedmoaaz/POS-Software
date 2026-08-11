import { Router } from "express";
import mongoose from "mongoose";
import { env } from "../../config/env.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const db =
    dbState === 1 ? "up" : dbState === 2 ? "connecting" : dbState === 3 ? "disconnecting" : "down";

  res.status(db === "up" ? 200 : 503).json({
    data: {
      service: "mega-modern-pos-api",
      status: db === "up" ? "ok" : "degraded",
      env: env.NODE_ENV,
      db,
      time: new Date().toISOString(),
    },
  });
});
