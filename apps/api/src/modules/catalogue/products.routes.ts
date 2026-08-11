import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireTenant } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { Product, ProductVariant, Barcode } from "../../models/product.model.js";
import { BranchInventory } from "../../models/inventory.model.js";
import { AppError } from "../../lib/errors.js";
import { AuditLog } from "../../models/audit.model.js";

export const productsRouter = Router();
productsRouter.use(authenticate, requireTenant);

function stripCost<T extends { costMinor?: number }>(
  row: T,
  canSeeCost: boolean,
): Omit<T, "costMinor"> & { costMinor?: number } {
  if (canSeeCost) return row;
  const { costMinor: _c, ...rest } = row;
  return rest;
}

productsRouter.get("/", requirePermission("products.view"), async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const status = req.query.status ? String(req.query.status) : undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
    const filter: Record<string, unknown> = {
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    };
    if (status) filter.status = status;
    if (q) filter.name = { $regex: q, $options: "i" };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    const productIds = products.map((p) => p._id);
    const variants = await ProductVariant.find({
      tenantId: req.auth!.tenantId,
      productId: { $in: productIds },
      deletedAt: null,
    }).lean();

    const canSeeCost = req.auth!.permissions.includes("products.cost.view");
    const byProduct = new Map<string, typeof variants>();
    for (const v of variants) {
      const key = String(v.productId);
      const list = byProduct.get(key) ?? [];
      list.push(v);
      byProduct.set(key, list);
    }

    res.json({
      data: products.map((p) => ({
        id: String(p._id),
        name: p.name,
        description: p.description,
        categoryId: p.categoryId ? String(p.categoryId) : null,
        brandId: p.brandId ? String(p.brandId) : null,
        unitId: String(p.unitId),
        isWeighted: p.isWeighted,
        status: p.status,
        variants: (byProduct.get(String(p._id)) ?? []).map((v) =>
          stripCost(
            {
              id: String(v._id),
              sku: v.sku,
              name: v.name,
              retailPriceMinor: v.retailPriceMinor,
              wholesalePriceMinor: v.wholesalePriceMinor,
              minPriceMinor: v.minPriceMinor,
              costMinor: v.costMinor,
              reorderLevel: v.reorderLevel,
              isActive: v.isActive,
            },
            canSeeCost,
          ),
        ),
      })),
      meta: { page, limit, total },
    });
  } catch (err) {
    next(err);
  }
});

productsRouter.get("/search", requirePermission("products.view"), async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json({ data: [] });

    const tenantId = req.auth!.tenantId!;
    const barcode = await Barcode.findOne({ tenantId, code: q, deletedAt: null }).lean();
    let variantIds: string[] = [];

    if (barcode) {
      variantIds = [String(barcode.variantId)];
    } else {
      const variants = await ProductVariant.find({
        tenantId,
        deletedAt: null,
        $or: [{ sku: q.toUpperCase() }, { sku: { $regex: q, $options: "i" } }],
      })
        .limit(20)
        .lean();
      variantIds = variants.map((v) => String(v._id));

      if (!variantIds.length) {
        const products = await Product.find({
          tenantId,
          deletedAt: null,
          name: { $regex: q, $options: "i" },
        })
          .limit(20)
          .lean();
        const more = await ProductVariant.find({
          tenantId,
          productId: { $in: products.map((p) => p._id) },
          deletedAt: null,
        }).lean();
        variantIds = more.map((v) => String(v._id));
      }
    }

    const variants = await ProductVariant.find({
      _id: { $in: variantIds },
      tenantId,
      deletedAt: null,
    }).lean();
    const products = await Product.find({
      _id: { $in: variants.map((v) => v.productId) },
      deletedAt: null,
    }).lean();
    const productMap = new Map(products.map((p) => [String(p._id), p]));
    const barcodes = await Barcode.find({
      tenantId,
      variantId: { $in: variants.map((v) => v._id) },
      deletedAt: null,
    }).lean();
    const primaryBarcode = new Map(
      barcodes.filter((b) => b.isPrimary).map((b) => [String(b.variantId), b.code]),
    );
    const canSeeCost = req.auth!.permissions.includes("products.cost.view");

    res.json({
      data: variants.map((v) => {
        const p = productMap.get(String(v.productId));
        return stripCost(
          {
            variantId: String(v._id),
            productId: String(v.productId),
            name: p?.name ?? v.name,
            sku: v.sku,
            barcode: primaryBarcode.get(String(v._id)) ?? null,
            retailPriceMinor: v.retailPriceMinor,
            costMinor: v.costMinor,
            isWeighted: p?.isWeighted ?? false,
            status: p?.status,
          },
          canSeeCost,
        );
      }),
    });
  } catch (err) {
    next(err);
  }
});

productsRouter.get("/:id", requirePermission("products.view"), async (req, res, next) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    }).lean();
    if (!product) throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");

    const variants = await ProductVariant.find({
      productId: product._id,
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    }).lean();
    const barcodes = await Barcode.find({
      tenantId: req.auth!.tenantId,
      variantId: { $in: variants.map((v) => v._id) },
      deletedAt: null,
    }).lean();
    const canSeeCost = req.auth!.permissions.includes("products.cost.view");

    res.json({
      data: {
        id: String(product._id),
        name: product.name,
        description: product.description,
        categoryId: product.categoryId ? String(product.categoryId) : null,
        brandId: product.brandId ? String(product.brandId) : null,
        unitId: String(product.unitId),
        isWeighted: product.isWeighted,
        isComposite: product.isComposite,
        status: product.status,
        variants: variants.map((v) =>
          stripCost(
            {
              id: String(v._id),
              sku: v.sku,
              name: v.name,
              retailPriceMinor: v.retailPriceMinor,
              wholesalePriceMinor: v.wholesalePriceMinor,
              minPriceMinor: v.minPriceMinor,
              costMinor: v.costMinor,
              reorderLevel: v.reorderLevel,
              barcodes: barcodes
                .filter((b) => String(b.variantId) === String(v._id))
                .map((b) => ({ id: String(b._id), code: b.code, isPrimary: b.isPrimary })),
            },
            canSeeCost,
          ),
        ),
      },
    });
  } catch (err) {
    next(err);
  }
});

const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
  unitId: z.string().min(1),
  isWeighted: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  variant: z.object({
    sku: z.string().min(1),
    retailPriceMinor: z.number().int().nonnegative(),
    costMinor: z.number().int().nonnegative(),
    wholesalePriceMinor: z.number().int().nonnegative().optional(),
    minPriceMinor: z.number().int().nonnegative().optional(),
    reorderLevel: z.number().nonnegative().optional(),
    barcode: z.string().optional(),
  }),
});

productsRouter.post(
  "/",
  requirePermission("products.create"),
  validate({ body: createProductSchema }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const body = req.body as z.infer<typeof createProductSchema>;

      const existingSku = await ProductVariant.findOne({
        tenantId,
        sku: body.variant.sku.toUpperCase(),
        deletedAt: null,
      });
      if (existingSku) throw new AppError(409, "SKU already exists", "SKU_EXISTS");

      if (body.variant.barcode) {
        const existingBc = await Barcode.findOne({
          tenantId,
          code: body.variant.barcode,
          deletedAt: null,
        });
        if (existingBc) throw new AppError(409, "Barcode already exists", "BARCODE_EXISTS");
      }

      const product = await Product.create({
        tenantId,
        name: body.name,
        description: body.description ?? "",
        categoryId: body.categoryId || undefined,
        brandId: body.brandId || undefined,
        unitId: body.unitId,
        isWeighted: body.isWeighted ?? false,
        status: body.status ?? "active",
      });

      const variant = await ProductVariant.create({
        tenantId,
        productId: product._id,
        sku: body.variant.sku.toUpperCase(),
        name: body.name,
        retailPriceMinor: body.variant.retailPriceMinor,
        costMinor: body.variant.costMinor,
        wholesalePriceMinor: body.variant.wholesalePriceMinor ?? 0,
        minPriceMinor: body.variant.minPriceMinor ?? 0,
        reorderLevel: body.variant.reorderLevel ?? 0,
      });

      if (body.variant.barcode) {
        await Barcode.create({
          tenantId,
          variantId: variant._id,
          code: body.variant.barcode,
          isPrimary: true,
        });
      }

      await AuditLog.create({
        tenantId,
        actorUserId: req.auth!.userId,
        action: "product.create",
        entityType: "Product",
        entityId: String(product._id),
        requestId: req.requestId,
        ip: req.ip,
      });

      res.status(201).json({
        data: {
          id: String(product._id),
          variantId: String(variant._id),
          sku: variant.sku,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

productsRouter.patch(
  "/:id",
  requirePermission("products.update"),
  validate({
    body: z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      categoryId: z.string().nullable().optional(),
      brandId: z.string().nullable().optional(),
      status: z.enum(["active", "inactive"]).optional(),
      isWeighted: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const product = await Product.findOne({
        _id: req.params.id,
        tenantId: req.auth!.tenantId,
        deletedAt: null,
      });
      if (!product) throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");

      Object.assign(product, {
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.description !== undefined ? { description: req.body.description } : {}),
        ...(req.body.categoryId !== undefined ? { categoryId: req.body.categoryId || null } : {}),
        ...(req.body.brandId !== undefined ? { brandId: req.body.brandId || null } : {}),
        ...(req.body.status !== undefined ? { status: req.body.status } : {}),
        ...(req.body.isWeighted !== undefined ? { isWeighted: req.body.isWeighted } : {}),
      });
      await product.save();
      res.json({ data: { id: String(product._id), name: product.name, status: product.status } });
    } catch (err) {
      next(err);
    }
  },
);

productsRouter.delete("/:id", requirePermission("products.delete"), async (req, res, next) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      tenantId: req.auth!.tenantId,
      deletedAt: null,
    });
    if (!product) throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");
    product.deletedAt = new Date();
    product.status = "inactive";
    await product.save();
    await ProductVariant.updateMany(
      { productId: product._id, tenantId: req.auth!.tenantId },
      { deletedAt: new Date(), isActive: false },
    );
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

productsRouter.patch(
  "/variants/:variantId",
  requirePermission("products.update"),
  validate({
    body: z.object({
      retailPriceMinor: z.number().int().nonnegative().optional(),
      costMinor: z.number().int().nonnegative().optional(),
      wholesalePriceMinor: z.number().int().nonnegative().optional(),
      minPriceMinor: z.number().int().nonnegative().optional(),
      reorderLevel: z.number().nonnegative().optional(),
      isActive: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      if (req.body.costMinor !== undefined && !req.auth!.permissions.includes("products.cost.view")) {
        throw new AppError(403, "Cannot update cost without permission", "FORBIDDEN");
      }
      const variant = await ProductVariant.findOne({
        _id: req.params.variantId,
        tenantId: req.auth!.tenantId,
        deletedAt: null,
      });
      if (!variant) throw new AppError(404, "Variant not found", "VARIANT_NOT_FOUND");
      Object.assign(variant, req.body);
      await variant.save();
      res.json({ data: { id: String(variant._id), sku: variant.sku } });
    } catch (err) {
      next(err);
    }
  },
);

productsRouter.post(
  "/variants/:variantId/barcodes",
  requirePermission("products.update"),
  validate({
    body: z.object({
      code: z.string().min(3),
      isPrimary: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const variant = await ProductVariant.findOne({
        _id: req.params.variantId,
        tenantId,
        deletedAt: null,
      });
      if (!variant) throw new AppError(404, "Variant not found", "VARIANT_NOT_FOUND");

      const exists = await Barcode.findOne({ tenantId, code: req.body.code, deletedAt: null });
      if (exists) throw new AppError(409, "Barcode already exists", "BARCODE_EXISTS");

      if (req.body.isPrimary) {
        await Barcode.updateMany({ tenantId, variantId: variant._id }, { isPrimary: false });
      }

      const barcode = await Barcode.create({
        tenantId,
        variantId: variant._id,
        code: req.body.code,
        isPrimary: req.body.isPrimary ?? false,
      });
      res.status(201).json({
        data: { id: String(barcode._id), code: barcode.code, isPrimary: barcode.isPrimary },
      });
    } catch (err) {
      next(err);
    }
  },
);

/** POS helper: stock snapshot for a branch */
productsRouter.get(
  "/variants/:variantId/stock",
  requirePermission("inventory.view"),
  async (req, res, next) => {
    try {
      const branchId = String(req.query.branchId ?? "");
      if (!branchId) throw new AppError(400, "branchId is required", "VALIDATION_ERROR");
      const inv = await BranchInventory.findOne({
        tenantId: req.auth!.tenantId,
        branchId,
        variantId: req.params.variantId,
      }).lean();
      res.json({
        data: {
          variantId: req.params.variantId,
          branchId,
          qtyOnHand: inv?.qtyOnHand ?? 0,
          qtyReserved: inv?.qtyReserved ?? 0,
          avgCostMinor: req.auth!.permissions.includes("products.cost.view")
            ? (inv?.avgCostMinor ?? 0)
            : undefined,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
