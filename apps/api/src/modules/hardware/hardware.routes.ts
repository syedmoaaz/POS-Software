import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireTenant } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { AppError } from "../../lib/errors.js";
import { HardwareDevice, PrintJob } from "../../models/hardware.model.js";
import { Register } from "../../models/register.model.js";
import { AuditLog } from "../../models/audit.model.js";
import { Branch } from "../../models/branch.model.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function serializeDevice(d: {
  _id: { toString(): string };
  branchId: { toString(): string };
  registerId?: { toString(): string } | null;
  name: string;
  type: string;
  connection: {
    kind?: string;
    bridgeUrl?: string;
    host?: string;
    port?: number | null;
    paperWidthMm?: number;
  };
  bridgeId?: string;
  isDefault?: boolean;
  isActive?: boolean;
  lastSeenAt?: Date | null;
  notes?: string;
  createdAt?: Date;
}) {
  return {
    id: String(d._id),
    branchId: String(d.branchId),
    registerId: d.registerId ? String(d.registerId) : null,
    name: d.name,
    type: d.type,
    connection: {
      kind: d.connection?.kind ?? "bridge",
      bridgeUrl: d.connection?.bridgeUrl ?? "http://127.0.0.1:9100",
      host: d.connection?.host ?? "",
      port: d.connection?.port ?? null,
      paperWidthMm: d.connection?.paperWidthMm ?? 80,
    },
    bridgeId: d.bridgeId ?? "",
    isDefault: Boolean(d.isDefault),
    isActive: d.isActive !== false,
    lastSeenAt: d.lastSeenAt ?? null,
    notes: d.notes ?? "",
    createdAt: d.createdAt,
  };
}

function serializeJob(j: {
  _id: { toString(): string };
  branchId: { toString(): string };
  deviceId: { toString(): string };
  type: string;
  payload: unknown;
  status: string;
  error?: string;
  attempts?: number;
  maxAttempts?: number;
  bridgeJobId?: string;
  createdBy: { toString(): string };
  completedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: String(j._id),
    branchId: String(j.branchId),
    deviceId: String(j.deviceId),
    type: j.type,
    payload: j.payload,
    status: j.status,
    error: j.error ?? "",
    attempts: j.attempts ?? 0,
    maxAttempts: j.maxAttempts ?? 3,
    bridgeJobId: j.bridgeJobId ?? "",
    createdBy: String(j.createdBy),
    completedAt: j.completedAt ?? null,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
  };
}

export const hardwareRouter = Router();
hardwareRouter.use(authenticate, requireTenant);

hardwareRouter.get("/", requirePermission("settings.view"), async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = { tenantId: req.auth!.tenantId, deletedAt: null };
    if (req.query.branchId) filter.branchId = String(req.query.branchId);
    if (req.query.type) filter.type = String(req.query.type);
    const rows = await HardwareDevice.find(filter).sort({ name: 1 }).lean();
    res.json({ data: rows.map((d) => serializeDevice(d as never)) });
  } catch (err) {
    next(err);
  }
});

hardwareRouter.post(
  "/",
  requirePermission("hardware.manage"),
  validate({
    body: z.object({
      branchId: z.string().min(1),
      registerId: z.string().optional(),
      name: z.string().min(1),
      type: z.enum(["printer", "drawer", "scanner"]),
      connection: z
        .object({
          kind: z.enum(["bridge", "network", "browser"]).optional(),
          bridgeUrl: z.string().url().optional(),
          host: z.string().optional(),
          port: z.number().int().positive().optional(),
          paperWidthMm: z.union([z.literal(58), z.literal(80)]).optional(),
        })
        .optional(),
      isDefault: z.boolean().optional(),
      notes: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const branch = await Branch.findOne({
        _id: req.body.branchId,
        tenantId,
        deletedAt: null,
      });
      if (!branch) throw new AppError(404, "Branch not found", "BRANCH_NOT_FOUND");

      if (req.body.isDefault) {
        await HardwareDevice.updateMany(
          { tenantId, branchId: req.body.branchId, type: req.body.type, deletedAt: null },
          { $set: { isDefault: false } },
        );
      }

      const pairingToken = randomBytes(24).toString("hex");
      const device = await HardwareDevice.create({
        tenantId,
        branchId: req.body.branchId,
        registerId: req.body.registerId,
        name: req.body.name,
        type: req.body.type,
        connection: {
          kind: req.body.connection?.kind ?? "bridge",
          bridgeUrl: req.body.connection?.bridgeUrl ?? "http://127.0.0.1:9100",
          host: req.body.connection?.host ?? "",
          port: req.body.connection?.port,
          paperWidthMm: req.body.connection?.paperWidthMm ?? 80,
        },
        bridgeId: `bridge_${randomBytes(4).toString("hex")}`,
        pairingTokenHash: hashToken(pairingToken),
        isDefault: req.body.isDefault ?? false,
        notes: req.body.notes ?? "",
      });

      if (req.body.registerId && req.body.type === "printer") {
        await Register.updateOne(
          { _id: req.body.registerId, tenantId },
          { $set: { printerDeviceId: device._id } },
        );
      }

      res.status(201).json({
        data: {
          ...serializeDevice(device.toObject() as never),
          pairingToken, // shown once
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

hardwareRouter.patch(
  "/:id",
  requirePermission("hardware.manage"),
  validate({
    body: z.object({
      name: z.string().min(1).optional(),
      registerId: z.string().nullable().optional(),
      connection: z
        .object({
          kind: z.enum(["bridge", "network", "browser"]).optional(),
          bridgeUrl: z.string().url().optional(),
          host: z.string().optional(),
          port: z.number().int().positive().optional(),
          paperWidthMm: z.union([z.literal(58), z.literal(80)]).optional(),
        })
        .optional(),
      isDefault: z.boolean().optional(),
      isActive: z.boolean().optional(),
      notes: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const device = await HardwareDevice.findOne({
        _id: req.params.id,
        tenantId: req.auth!.tenantId,
        deletedAt: null,
      });
      if (!device) throw new AppError(404, "Device not found", "DEVICE_NOT_FOUND");

      if (req.body.isDefault) {
        await HardwareDevice.updateMany(
          {
            tenantId: req.auth!.tenantId,
            branchId: device.branchId,
            type: device.type,
            deletedAt: null,
            _id: { $ne: device._id },
          },
          { $set: { isDefault: false } },
        );
      }

      if (req.body.name !== undefined) device.name = req.body.name;
      if (req.body.registerId !== undefined) device.registerId = req.body.registerId as never;
      if (req.body.isDefault !== undefined) device.isDefault = req.body.isDefault;
      if (req.body.isActive !== undefined) device.isActive = req.body.isActive;
      if (req.body.notes !== undefined) device.notes = req.body.notes;
      if (req.body.connection) {
        device.connection = {
          ...device.connection,
          ...req.body.connection,
        } as never;
      }
      await device.save();

      res.json({ data: serializeDevice(device.toObject() as never) });
    } catch (err) {
      next(err);
    }
  },
);

hardwareRouter.post(
  "/:id/rotate-token",
  requirePermission("hardware.manage"),
  async (req, res, next) => {
    try {
      const device = await HardwareDevice.findOne({
        _id: req.params.id,
        tenantId: req.auth!.tenantId,
        deletedAt: null,
      });
      if (!device) throw new AppError(404, "Device not found", "DEVICE_NOT_FOUND");
      const pairingToken = randomBytes(24).toString("hex");
      device.pairingTokenHash = hashToken(pairingToken);
      await device.save();
      res.json({ data: { id: String(device._id), pairingToken } });
    } catch (err) {
      next(err);
    }
  },
);

hardwareRouter.delete("/:id", requirePermission("hardware.manage"), async (req, res, next) => {
  try {
    const device = await HardwareDevice.findOne({
      _id: req.params.id,
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    });
    if (!device) throw new AppError(404, "Device not found", "DEVICE_NOT_FOUND");
    device.deletedAt = new Date();
    device.isActive = false;
    await device.save();
    res.json({ data: { id: String(device._id), deleted: true } });
  } catch (err) {
    next(err);
  }
});

export const printJobsRouter = Router();
printJobsRouter.use(authenticate, requireTenant);

printJobsRouter.get("/", requirePermission("settings.view"), async (req, res, next) => {
  try {
    const filter: Record<string, unknown> = { tenantId: req.auth!.tenantId, deletedAt: null };
    if (req.query.branchId) filter.branchId = String(req.query.branchId);
    if (req.query.status) filter.status = String(req.query.status);
    const rows = await PrintJob.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ data: rows.map((j) => serializeJob(j as never)) });
  } catch (err) {
    next(err);
  }
});

printJobsRouter.post(
  "/",
  requirePermission("sales.create"),
  validate({
    body: z.object({
      deviceId: z.string().optional(),
      branchId: z.string().min(1),
      type: z.enum(["receipt", "label", "test", "drawer_kick"]),
      payload: z.record(z.unknown()).default({}),
    }),
  }),
  async (req, res, next) => {
    try {
      if (req.body.type === "test" && !req.auth!.permissions.includes("hardware.print_test")) {
        throw new AppError(403, "Test print not permitted", "FORBIDDEN");
      }
      if (
        req.body.type === "drawer_kick" &&
        !req.auth!.permissions.includes("sales.open_drawer")
      ) {
        throw new AppError(403, "Drawer open not permitted", "FORBIDDEN");
      }

      const tenantId = req.auth!.tenantId!;
      let device = req.body.deviceId
        ? await HardwareDevice.findOne({
            _id: req.body.deviceId,
            tenantId,
            deletedAt: null,
            isActive: true,
          })
        : await HardwareDevice.findOne({
            tenantId,
            branchId: req.body.branchId,
            type: req.body.type === "drawer_kick" ? "drawer" : "printer",
            isDefault: true,
            deletedAt: null,
            isActive: true,
          });

      if (!device && req.body.type === "drawer_kick") {
        device = await HardwareDevice.findOne({
          tenantId,
          branchId: req.body.branchId,
          type: "printer",
          deletedAt: null,
          isActive: true,
        });
      }
      if (!device) throw new AppError(404, "No hardware device configured", "DEVICE_NOT_FOUND");

      const job = await PrintJob.create({
        tenantId,
        branchId: req.body.branchId,
        deviceId: device._id,
        type: req.body.type,
        payload: req.body.payload,
        status: "queued",
        createdBy: req.auth!.userId,
      });

      res.status(201).json({
        data: {
          job: serializeJob(job.toObject() as never),
          device: serializeDevice(device.toObject() as never),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

printJobsRouter.get("/:id", requirePermission("settings.view"), async (req, res, next) => {
  try {
    const job = await PrintJob.findOne({
      _id: req.params.id,
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    }).lean();
    if (!job) throw new AppError(404, "Print job not found", "PRINT_JOB_NOT_FOUND");
    res.json({ data: serializeJob(job as never) });
  } catch (err) {
    next(err);
  }
});

printJobsRouter.post(
  "/:id/status",
  requirePermission("sales.create"),
  validate({
    body: z.object({
      status: z.enum(["sent", "printing", "done", "failed"]),
      bridgeJobId: z.string().optional(),
      error: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const job = await PrintJob.findOne({
        _id: req.params.id,
        tenantId: req.auth!.tenantId,
        deletedAt: null,
      });
      if (!job) throw new AppError(404, "Print job not found", "PRINT_JOB_NOT_FOUND");

      job.status = req.body.status;
      job.attempts += 1;
      if (req.body.bridgeJobId) job.bridgeJobId = req.body.bridgeJobId;
      if (req.body.error) job.error = req.body.error;
      if (req.body.status === "done" || req.body.status === "failed") {
        job.completedAt = new Date();
      }
      await job.save();

      await HardwareDevice.updateOne(
        { _id: job.deviceId },
        { $set: { lastSeenAt: new Date() } },
      );

      res.json({ data: serializeJob(job.toObject() as never) });
    } catch (err) {
      next(err);
    }
  },
);

printJobsRouter.post("/:id/retry", requirePermission("hardware.print_test"), async (req, res, next) => {
  try {
    const job = await PrintJob.findOne({
      _id: req.params.id,
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    });
    if (!job) throw new AppError(404, "Print job not found", "PRINT_JOB_NOT_FOUND");
    if (job.attempts >= job.maxAttempts) {
      throw new AppError(400, "Max retry attempts reached", "MAX_RETRIES");
    }
    job.status = "queued";
    job.error = "";
    job.completedAt = undefined;
    await job.save();

    const device = await HardwareDevice.findById(job.deviceId).lean();
    res.json({
      data: {
        job: serializeJob(job.toObject() as never),
        device: device ? serializeDevice(device as never) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Convenience: open cash drawer for a register (audited). */
export const drawerRouter = Router();
drawerRouter.use(authenticate, requireTenant);

drawerRouter.post(
  "/registers/:registerId/open-drawer",
  requirePermission("sales.open_drawer"),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const register = await Register.findOne({
        _id: req.params.registerId,
        tenantId,
        deletedAt: null,
      });
      if (!register) throw new AppError(404, "Register not found", "REGISTER_NOT_FOUND");

      let device = register.printerDeviceId
        ? await HardwareDevice.findOne({
            _id: register.printerDeviceId,
            tenantId,
            deletedAt: null,
            isActive: true,
          })
        : null;
      if (!device) {
        device = await HardwareDevice.findOne({
          tenantId,
          branchId: register.branchId,
          type: { $in: ["drawer", "printer"] },
          deletedAt: null,
          isActive: true,
        }).sort({ isDefault: -1 });
      }
      if (!device) throw new AppError(404, "No drawer/printer device configured", "DEVICE_NOT_FOUND");

      const job = await PrintJob.create({
        tenantId,
        branchId: register.branchId,
        deviceId: device._id,
        type: "drawer_kick",
        payload: { registerId: String(register._id) },
        status: "queued",
        createdBy: req.auth!.userId,
      });

      await AuditLog.create({
        tenantId,
        actorUserId: req.auth!.userId,
        action: "drawer.open",
        entityType: "Register",
        entityId: String(register._id),
        requestId: req.requestId,
        ip: req.ip,
        meta: { printJobId: String(job._id), deviceId: String(device._id) },
      });

      res.status(201).json({
        data: {
          job: serializeJob(job.toObject() as never),
          device: serializeDevice(device.toObject() as never),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
