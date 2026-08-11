import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireTenant } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { Category, Brand, Unit } from "../../models/catalogue-meta.model.js";

export const categoriesRouter = Router();
categoriesRouter.use(authenticate, requireTenant);

categoriesRouter.get("/", requirePermission("products.view"), async (req, res, next) => {
  try {
    const items = await Category.find({ tenantId: req.auth!.tenantId, deletedAt: null }).sort({
      sortOrder: 1,
      name: 1,
    });
    res.json({
      data: items.map((c) => ({
        id: String(c._id),
        name: c.name,
        parentId: c.parentId ? String(c.parentId) : null,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
      })),
    });
  } catch (err) {
    next(err);
  }
});

categoriesRouter.post(
  "/",
  requirePermission("products.create"),
  validate({
    body: z.object({
      name: z.string().min(1),
      parentId: z.string().optional().nullable(),
      sortOrder: z.number().int().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const cat = await Category.create({
        tenantId: req.auth!.tenantId,
        name: req.body.name,
        parentId: req.body.parentId || null,
        sortOrder: req.body.sortOrder ?? 0,
      });
      res.status(201).json({ data: { id: String(cat._id), name: cat.name } });
    } catch (err) {
      next(err);
    }
  },
);

export const brandsRouter = Router();
brandsRouter.use(authenticate, requireTenant);

brandsRouter.get("/", requirePermission("products.view"), async (req, res, next) => {
  try {
    const items = await Brand.find({ tenantId: req.auth!.tenantId, deletedAt: null }).sort({ name: 1 });
    res.json({
      data: items.map((b) => ({ id: String(b._id), name: b.name, isActive: b.isActive })),
    });
  } catch (err) {
    next(err);
  }
});

brandsRouter.post(
  "/",
  requirePermission("products.create"),
  validate({ body: z.object({ name: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const brand = await Brand.create({ tenantId: req.auth!.tenantId, name: req.body.name });
      res.status(201).json({ data: { id: String(brand._id), name: brand.name } });
    } catch (err) {
      next(err);
    }
  },
);

export const unitsRouter = Router();
unitsRouter.use(authenticate, requireTenant);

unitsRouter.get("/", requirePermission("products.view"), async (req, res, next) => {
  try {
    const items = await Unit.find({ tenantId: req.auth!.tenantId, deletedAt: null }).sort({ name: 1 });
    res.json({
      data: items.map((u) => ({
        id: String(u._id),
        name: u.name,
        code: u.code,
        allowsDecimal: u.allowsDecimal,
      })),
    });
  } catch (err) {
    next(err);
  }
});

unitsRouter.post(
  "/",
  requirePermission("products.create"),
  validate({
    body: z.object({
      name: z.string().min(1),
      code: z.string().min(1),
      allowsDecimal: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const unit = await Unit.create({
        tenantId: req.auth!.tenantId,
        name: req.body.name,
        code: String(req.body.code).toLowerCase(),
        allowsDecimal: req.body.allowsDecimal ?? false,
      });
      res.status(201).json({
        data: { id: String(unit._id), name: unit.name, code: unit.code },
      });
    } catch (err) {
      next(err);
    }
  },
);

export async function ensureDefaultUnits(tenantId: string) {
  const defaults = [
    { name: "Piece", code: "piece", allowsDecimal: false },
    { name: "Kilogram", code: "kg", allowsDecimal: true },
    { name: "Gram", code: "g", allowsDecimal: true },
    { name: "Litre", code: "l", allowsDecimal: true },
    { name: "Box", code: "box", allowsDecimal: false },
    { name: "Pack", code: "pack", allowsDecimal: false },
  ];
  for (const d of defaults) {
    const existing = await Unit.findOne({ tenantId, code: d.code, deletedAt: null });
    if (!existing) await Unit.create({ tenantId, ...d });
  }
}
