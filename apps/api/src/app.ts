import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import type { Request } from "express";
import { corsOrigins, env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { requestId } from "./middleware/request-id.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { contextRouter } from "./modules/context/context.routes.js";
import { branchesRouter, registersRouter } from "./modules/org/org.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { inventoryRouter } from "./modules/inventory/inventory.routes.js";
import { salesRouter, returnsRouter } from "./modules/sales/sales.routes.js";
import { registerSessionsRouter } from "./modules/register/register-session.routes.js";
import {
  suppliersRouter,
  purchaseOrdersRouter,
  purchasesRouter,
  supplierPaymentsRouter,
} from "./modules/purchasing/purchasing.routes.js";
import { customersRouter } from "./modules/customers/customers.routes.js";
import { expensesRouter } from "./modules/expenses/expenses.routes.js";
import { reportsRouter } from "./modules/reports/reports.routes.js";
import { syncRouter } from "./modules/sync/sync.routes.js";
import {
  hardwareRouter,
  printJobsRouter,
  drawerRouter,
} from "./modules/hardware/hardware.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { brandsRouter, categoriesRouter, unitsRouter } from "./modules/catalogue/meta.routes.js";
import { productsRouter } from "./modules/catalogue/products.routes.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      customProps: (req: Request) => ({ requestId: req.requestId }),
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || corsOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === "production" ? 50 : 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Too many requests" } },
  });

  app.get("/", (_req, res) => {
    res.json({
      name: "Mega Modern Solutions POS API",
      version: "v1",
      docs: "/api/v1/health",
    });
  });

  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/auth", authLimiter, authRouter);
  app.use("/api/v1/context", contextRouter);
  app.use("/api/v1/branches", branchesRouter);
  app.use("/api/v1/registers", registersRouter);
  app.use("/api/v1/categories", categoriesRouter);
  app.use("/api/v1/brands", brandsRouter);
  app.use("/api/v1/units", unitsRouter);
  app.use("/api/v1/products", productsRouter);
  app.use("/api/v1/inventory", inventoryRouter);
  app.use("/api/v1/sales", salesRouter);
  app.use("/api/v1/returns", returnsRouter);
  app.use("/api/v1/register-sessions", registerSessionsRouter);
  app.use("/api/v1/suppliers", suppliersRouter);
  app.use("/api/v1/purchase-orders", purchaseOrdersRouter);
  app.use("/api/v1/purchases", purchasesRouter);
  app.use("/api/v1/supplier-payments", supplierPaymentsRouter);
  app.use("/api/v1/customers", customersRouter);
  app.use("/api/v1/expenses", expensesRouter);
  app.use("/api/v1/reports", reportsRouter);
  app.use("/api/v1/sync", syncRouter);
  app.use("/api/v1/hardware/devices", hardwareRouter);
  app.use("/api/v1/print-jobs", printJobsRouter);
  app.use("/api/v1", drawerRouter);
  app.use("/api/v1/admin", adminRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
