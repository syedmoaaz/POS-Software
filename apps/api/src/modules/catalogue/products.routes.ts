import { Router } from "express";
import { z } from "zod";
import { randomInt } from "node:crypto";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireTenant } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { Product, ProductVariant, Barcode } from "../../models/product.model.js";
import { BranchInventory } from "../../models/inventory.model.js";
import { Category, Brand, Unit } from "../../models/catalogue-meta.model.js";
import { AppError } from "../../lib/errors.js";
import { AuditLog } from "../../models/audit.model.js";
import { applyStockMovement, withTransaction } from "../../lib/stock.js";

export const productsRouter = Router();
productsRouter.use(authenticate, requireTenant);

function attrsToObject(attrs: unknown): Record<string, string> {
  if (!attrs) return {};
  if (attrs instanceof Map) return Object.fromEntries(attrs.entries()) as Record<string, string>;
  if (typeof attrs === "object") return { ...(attrs as Record<string, string>) };
  return {};
}

async function generateUniqueBarcode(tenantId: string) {
  for (let i = 0; i < 20; i++) {
    const code = `2${String(randomInt(0, 1_000_000_000)).padStart(11, "0")}`.slice(0, 12);
    const exists = await Barcode.findOne({ tenantId, code, deletedAt: null }).lean();
    if (!exists) return code;
  }
  throw new AppError(500, "Could not generate barcode", "BARCODE_GEN_FAILED");
}

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
    const barcodes = await Barcode.find({
      tenantId: req.auth!.tenantId,
      variantId: { $in: variants.map((v) => v._id) },
      deletedAt: null,
    }).lean();
    const primaryBarcode = new Map(
      barcodes.filter((b) => b.isPrimary).map((b) => [String(b.variantId), b.code]),
    );
    for (const b of barcodes) {
      if (!primaryBarcode.has(String(b.variantId))) primaryBarcode.set(String(b.variantId), b.code);
    }

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
              attributes: attrsToObject(v.attributes),
              barcode: primaryBarcode.get(String(v._id)) ?? null,
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

productsRouter.post(
  "/barcodes/generate",
  requirePermission("products.update"),
  validate({
    body: z.object({
      variantId: z.string().optional(),
      assign: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const code = await generateUniqueBarcode(tenantId);
      if (req.body.variantId && req.body.assign !== false) {
        const variant = await ProductVariant.findOne({
          _id: req.body.variantId,
          tenantId,
          deletedAt: null,
        });
        if (!variant) throw new AppError(404, "Variant not found", "VARIANT_NOT_FOUND");
        const hasPrimary = await Barcode.findOne({
          tenantId,
          variantId: variant._id,
          isPrimary: true,
          deletedAt: null,
        });
        await Barcode.create({
          tenantId,
          variantId: variant._id,
          code,
          isPrimary: !hasPrimary,
        });
      }
      res.status(201).json({ data: { code } });
    } catch (err) {
      next(err);
    }
  },
);

productsRouter.post(
  "/import",
  requirePermission("products.create"),
  validate({
    body: z.object({
      branchId: z.string().optional(),
      rows: z
        .array(
          z.object({
            name: z.string().min(1),
            sku: z.string().min(1),
            barcode: z.string().optional(),
            category: z.string().optional(),
            brand: z.string().optional(),
            unit: z.string().optional(),
            retailPrice: z.number().nonnegative().optional(),
            retailPriceMinor: z.number().int().nonnegative().optional(),
            cost: z.number().nonnegative().optional(),
            costMinor: z.number().int().nonnegative().optional(),
            reorderLevel: z.number().nonnegative().optional(),
            qtyOnHand: z.number().nonnegative().optional(),
            size: z.string().optional(),
            color: z.string().optional(),
            attributes: z.record(z.string()).optional(),
          }),
        )
        .min(1)
        .max(2000),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const branchId = req.body.branchId as string | undefined;
      const errors: Array<{ row: number; message: string }> = [];
      let created = 0;

      const units = await Unit.find({ tenantId, deletedAt: null });
      const defaultUnit =
        units.find((u) => u.code === "pcs" || u.name.toLowerCase() === "piece") ?? units[0];
      if (!defaultUnit) throw new AppError(400, "No units configured", "NO_UNITS");

      for (let i = 0; i < req.body.rows.length; i++) {
        const row = req.body.rows[i] as {
          name: string;
          sku: string;
          barcode?: string;
          category?: string;
          brand?: string;
          unit?: string;
          retailPrice?: number;
          retailPriceMinor?: number;
          cost?: number;
          costMinor?: number;
          reorderLevel?: number;
          qtyOnHand?: number;
          size?: string;
          color?: string;
          attributes?: Record<string, string>;
        };
        try {
          const sku = row.sku.toUpperCase();
          const exists = await ProductVariant.findOne({ tenantId, sku, deletedAt: null });
          if (exists) {
            errors.push({ row: i + 1, message: `SKU ${sku} already exists` });
            continue;
          }

          let categoryId: string | undefined;
          if (row.category) {
            let cat = await Category.findOne({
              tenantId,
              name: row.category,
              deletedAt: null,
            });
            if (!cat) {
              cat = await Category.create({ tenantId, name: row.category });
            }
            categoryId = String(cat._id);
          }

          let brandId: string | undefined;
          if (row.brand) {
            let brand = await Brand.findOne({ tenantId, name: row.brand, deletedAt: null });
            if (!brand) brand = await Brand.create({ tenantId, name: row.brand });
            brandId = String(brand._id);
          }

          let unitId = String(defaultUnit._id);
          if (row.unit) {
            const u =
              units.find(
                (x) =>
                  x.code.toLowerCase() === row.unit!.toLowerCase() ||
                  x.name.toLowerCase() === row.unit!.toLowerCase(),
              ) ??
              (await Unit.findOne({
                tenantId,
                $or: [{ code: row.unit }, { name: row.unit }],
                deletedAt: null,
              }));
            if (u) unitId = String(u._id);
          }

          const retailPriceMinor =
            row.retailPriceMinor ?? Math.round((row.retailPrice ?? 0) * 100);
          const costMinor = row.costMinor ?? Math.round((row.cost ?? 0) * 100);
          const attributes: Record<string, string> = { ...(row.attributes ?? {}) };
          if (row.size) attributes.size = row.size;
          if (row.color) attributes.color = row.color;

          const product = await Product.create({
            tenantId,
            name: row.name,
            categoryId,
            brandId,
            unitId,
            status: "active",
          });
          const variant = await ProductVariant.create({
            tenantId,
            productId: product._id,
            sku,
            name: row.name,
            attributes,
            retailPriceMinor,
            costMinor,
            reorderLevel: row.reorderLevel ?? 0,
          });
          const barcode = row.barcode || (await generateUniqueBarcode(tenantId));
          await Barcode.create({
            tenantId,
            variantId: variant._id,
            code: barcode,
            isPrimary: true,
          });

          if (branchId && (row.qtyOnHand ?? 0) > 0) {
            await applyStockMovement({
              tenantId,
              branchId,
              variantId: String(variant._id),
              type: "opening",
              qtyDelta: row.qtyOnHand!,
              unitCostMinor: costMinor,
              createdBy: req.auth!.userId,
              allowNegative: false,
              refType: "import",
              refId: String(product._id),
            });
          }
          created += 1;
        } catch (err) {
          errors.push({
            row: i + 1,
            message: err instanceof Error ? err.message : "Import failed",
          });
        }
      }

      res.status(201).json({ data: { created, errors } });
    } catch (err) {
      next(err);
    }
  },
);

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
            attributes: attrsToObject(v.attributes),
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
              attributes: attrsToObject(v.attributes),
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

const variantInputSchema = z.object({
  sku: z.string().min(1),
  name: z.string().optional(),
  attributes: z.record(z.string()).optional(),
  retailPriceMinor: z.number().int().nonnegative(),
  costMinor: z.number().int().nonnegative(),
  wholesalePriceMinor: z.number().int().nonnegative().optional(),
  minPriceMinor: z.number().int().nonnegative().optional(),
  reorderLevel: z.number().nonnegative().optional(),
  barcode: z.string().optional(),
  openingQty: z.number().nonnegative().optional(),
});

const createProductSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    categoryId: z.string().optional().nullable(),
    brandId: z.string().optional().nullable(),
    unitId: z.string().min(1),
    isWeighted: z.boolean().optional(),
    status: z.enum(["active", "inactive"]).optional(),
    branchId: z.string().optional(),
    variant: variantInputSchema.optional(),
    variants: z.array(variantInputSchema).optional(),
  })
  .refine((b) => Boolean(b.variant) || (b.variants && b.variants.length > 0), {
    message: "At least one variant is required",
  });

productsRouter.post(
  "/",
  requirePermission("products.create"),
  validate({ body: createProductSchema }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const body = req.body as z.infer<typeof createProductSchema>;
      const variantInputs = body.variants?.length
        ? body.variants
        : body.variant
          ? [body.variant]
          : [];

      for (const v of variantInputs) {
        const existingSku = await ProductVariant.findOne({
          tenantId,
          sku: v.sku.toUpperCase(),
          deletedAt: null,
        });
        if (existingSku) throw new AppError(409, `SKU already exists: ${v.sku}`, "SKU_EXISTS");
        if (v.barcode) {
          const existingBc = await Barcode.findOne({
            tenantId,
            code: v.barcode,
            deletedAt: null,
          });
          if (existingBc) throw new AppError(409, `Barcode already exists: ${v.barcode}`, "BARCODE_EXISTS");
        }
      }

      const created = await withTransaction(async (session) => {
        const [product] = await Product.create(
          [
            {
              tenantId,
              name: body.name,
              description: body.description ?? "",
              categoryId: body.categoryId || undefined,
              brandId: body.brandId || undefined,
              unitId: body.unitId,
              isWeighted: body.isWeighted ?? false,
              status: body.status ?? "active",
            },
          ],
          session ? { session } : undefined,
        );

        const createdVariants = [];
        for (const v of variantInputs) {
          const [variant] = await ProductVariant.create(
            [
              {
                tenantId,
                productId: product._id,
                sku: v.sku.toUpperCase(),
                name: v.name || body.name,
                attributes: v.attributes ?? {},
                retailPriceMinor: v.retailPriceMinor,
                costMinor: v.costMinor,
                wholesalePriceMinor: v.wholesalePriceMinor ?? 0,
                minPriceMinor: v.minPriceMinor ?? 0,
                reorderLevel: v.reorderLevel ?? 0,
              },
            ],
            session ? { session } : undefined,
          );

          const code = v.barcode || (await generateUniqueBarcode(tenantId));
          await Barcode.create(
            [
              {
                tenantId,
                variantId: variant._id,
                code,
                isPrimary: true,
              },
            ],
            session ? { session } : undefined,
          );

          if (body.branchId && (v.openingQty ?? 0) > 0) {
            await applyStockMovement({
              tenantId,
              branchId: body.branchId,
              variantId: String(variant._id),
              type: "opening",
              qtyDelta: v.openingQty!,
              unitCostMinor: v.costMinor,
              createdBy: req.auth!.userId,
              allowNegative: false,
              refType: "product",
              refId: String(product._id),
              session,
            });
          }

          createdVariants.push({
            id: String(variant._id),
            sku: variant.sku,
            barcode: code,
            attributes: v.attributes ?? {},
          });
        }

        return { product, createdVariants };
      });

      await AuditLog.create({
        tenantId,
        actorUserId: req.auth!.userId,
        action: "product.create",
        entityType: "Product",
        entityId: String(created.product._id),
        requestId: req.requestId,
        ip: req.ip,
      });

      res.status(201).json({
        data: {
          id: String(created.product._id),
          variantId: created.createdVariants[0]?.id,
          sku: created.createdVariants[0]?.sku,
          variants: created.createdVariants,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

productsRouter.post(
  "/:id/variants",
  requirePermission("products.create"),
  validate({ body: variantInputSchema.extend({ branchId: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const product = await Product.findOne({
        _id: req.params.id,
        tenantId,
        deletedAt: null,
      });
      if (!product) throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");

      const body = req.body as z.infer<typeof variantInputSchema> & { branchId?: string };
      const sku = body.sku.toUpperCase();
      const existingSku = await ProductVariant.findOne({ tenantId, sku, deletedAt: null });
      if (existingSku) throw new AppError(409, "SKU already exists", "SKU_EXISTS");

      const variant = await ProductVariant.create({
        tenantId,
        productId: product._id,
        sku,
        name: body.name || product.name,
        attributes: body.attributes ?? {},
        retailPriceMinor: body.retailPriceMinor,
        costMinor: body.costMinor,
        wholesalePriceMinor: body.wholesalePriceMinor ?? 0,
        minPriceMinor: body.minPriceMinor ?? 0,
        reorderLevel: body.reorderLevel ?? 0,
      });

      const code = body.barcode || (await generateUniqueBarcode(tenantId));
      await Barcode.create({
        tenantId,
        variantId: variant._id,
        code,
        isPrimary: true,
      });

      if (body.branchId && (body.openingQty ?? 0) > 0) {
        await applyStockMovement({
          tenantId,
          branchId: body.branchId,
          variantId: String(variant._id),
          type: "opening",
          qtyDelta: body.openingQty!,
          unitCostMinor: body.costMinor,
          createdBy: req.auth!.userId,
          allowNegative: false,
          refType: "product",
          refId: String(product._id),
        });
      }

      res.status(201).json({
        data: {
          id: String(variant._id),
          sku: variant.sku,
          barcode: code,
          attributes: attrsToObject(variant.attributes),
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
      name: z.string().optional(),
      attributes: z.record(z.string()).optional(),
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
      if (req.body.name !== undefined) variant.name = req.body.name;
      if (req.body.attributes !== undefined) variant.attributes = req.body.attributes as never;
      if (req.body.retailPriceMinor !== undefined) variant.retailPriceMinor = req.body.retailPriceMinor;
      if (req.body.costMinor !== undefined) variant.costMinor = req.body.costMinor;
      if (req.body.wholesalePriceMinor !== undefined) {
        variant.wholesalePriceMinor = req.body.wholesalePriceMinor;
      }
      if (req.body.minPriceMinor !== undefined) variant.minPriceMinor = req.body.minPriceMinor;
      if (req.body.reorderLevel !== undefined) variant.reorderLevel = req.body.reorderLevel;
      if (req.body.isActive !== undefined) variant.isActive = req.body.isActive;
      await variant.save();
      res.json({
        data: {
          id: String(variant._id),
          sku: variant.sku,
          attributes: attrsToObject(variant.attributes),
        },
      });
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
