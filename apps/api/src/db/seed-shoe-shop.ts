/**
 * Adds (or refreshes) a shoe-shop demo tenant without wiping other tenants.
 * Run: pnpm --filter @mms/api exec tsx src/db/seed-shoe-shop.ts
 */
import { ROLE_PERMISSIONS } from "@mms/shared";
import { connectDb, disconnectDb } from "./connection.js";
import { logger } from "../lib/logger.js";
import { hashPassword, hashPin } from "../lib/password.js";
import { Tenant } from "../models/tenant.model.js";
import { SubscriptionPlan, Subscription } from "../models/subscription.model.js";
import { Branch } from "../models/branch.model.js";
import { Register } from "../models/register.model.js";
import { Role } from "../models/role.model.js";
import { User } from "../models/user.model.js";
import { Category, Brand, Unit } from "../models/catalogue-meta.model.js";
import { Product, ProductVariant, Barcode } from "../models/product.model.js";
import { BranchInventory, StockMovement } from "../models/inventory.model.js";
import { applyStockMovement } from "../lib/stock.js";
import { Counter } from "../models/counter.model.js";

const SLUG = "sole-style";
const OWNER_EMAIL = "owner@solestyle.demo";
const CASHIER_EMAIL = "cashier@solestyle.demo";
const PASSWORD = "demo1234";
const PIN = "2222";

async function wipeTenant(tenantId: unknown) {
  const tid = tenantId as never;
  await Promise.all([
    StockMovement.deleteMany({ tenantId: tid }),
    BranchInventory.deleteMany({ tenantId: tid }),
    Barcode.deleteMany({ tenantId: tid }),
    ProductVariant.deleteMany({ tenantId: tid }),
    Product.deleteMany({ tenantId: tid }),
    Category.deleteMany({ tenantId: tid }),
    Brand.deleteMany({ tenantId: tid }),
    Unit.deleteMany({ tenantId: tid }),
    Counter.deleteMany({ tenantId: tid }),
    User.deleteMany({ tenantId: tid }),
    Role.deleteMany({ tenantId: tid }),
    Register.deleteMany({ tenantId: tid }),
    Branch.deleteMany({ tenantId: tid }),
    Subscription.deleteMany({ tenantId: tid }),
  ]);
  await Tenant.deleteOne({ _id: tid });
}

async function main() {
  await connectDb();
  logger.info("Seeding Sole Style shoe shop…");

  const existing = await Tenant.findOne({ slug: SLUG });
  if (existing) {
    logger.info("Existing Sole Style tenant found — refreshing…");
    await wipeTenant(existing._id);
  }

  let growth = await SubscriptionPlan.findOne({ code: "GROWTH" });
  if (!growth) {
    growth = await SubscriptionPlan.create({
      code: "GROWTH",
      name: "Growth",
      priceMinor: 1500000,
      limits: { maxBranches: 3, maxUsers: 15, maxProducts: 10000, maxRegisters: 10 },
      features: ["pos", "inventory", "credit", "loyalty", "reports.profit"],
    });
  }

  const tenant = await Tenant.create({
    name: "Sole Style Shoes",
    slug: SLUG,
    status: "active",
    logoUrl: "/logo.png",
    timezone: "Asia/Karachi",
    currency: "PKR",
    locale: "en-PK",
    limits: growth.limits,
    featureFlags: {
      loyalty: true,
      customerCredit: true,
      storeCredit: true,
      weightedItems: false,
    },
  });

  await Subscription.create({
    tenantId: tenant._id,
    planId: growth._id,
    status: "active",
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
  });

  const branch = await Branch.create({
    tenantId: tenant._id,
    name: "Saddar Store",
    code: "SAD",
    address: "Saddar, Karachi",
    phone: "021-1234567",
    isActive: true,
  });

  const register = await Register.create({
    tenantId: tenant._id,
    branchId: branch._id,
    name: "Front Counter",
    code: "R1",
    isActive: true,
  });

  const ownerRole = await Role.create({
    tenantId: tenant._id,
    key: "owner",
    name: "Business Owner",
    isSystem: true,
    permissions: ROLE_PERMISSIONS.owner,
  });
  const cashierRole = await Role.create({
    tenantId: tenant._id,
    key: "cashier",
    name: "Cashier",
    isSystem: true,
    permissions: ROLE_PERMISSIONS.cashier,
  });

  const passwordHash = await hashPassword(PASSWORD);
  const pinHash = await hashPin(PIN);

  await User.insertMany([
    {
      tenantId: tenant._id,
      email: OWNER_EMAIL,
      passwordHash,
      name: "Farhan Shoe Owner",
      roleIds: [ownerRole._id],
      branchIds: [branch._id],
      status: "active",
    },
    {
      tenantId: tenant._id,
      email: CASHIER_EMAIL,
      passwordHash,
      pinHash,
      name: "Ali Cashier",
      roleIds: [cashierRole._id],
      branchIds: [branch._id],
      status: "active",
    },
  ]);

  const owner = await User.findOne({ email: OWNER_EMAIL });
  if (!owner) throw new Error("Owner missing");

  const [pairUnit] = await Unit.insertMany([
    { tenantId: tenant._id, name: "Pair", code: "pair", allowsDecimal: false },
  ]);

  const cats = await Category.insertMany(
    ["Men", "Women", "Kids", "Sports", "Formal"].map((name, i) => ({
      tenantId: tenant._id,
      name,
      sortOrder: i,
    })),
  );
  const cat = (name: string) => cats.find((c) => c.name === name)!;

  const brands = await Brand.insertMany(
    ["Bata", "Service", "Nike", "Adidas", "Local"].map((name) => ({
      tenantId: tenant._id,
      name,
    })),
  );
  const brand = (name: string) => brands.find((b) => b.name === name)!;

  const styles: Array<{
    name: string;
    category: string;
    brand: string;
    baseSku: string;
    retail: number;
    cost: number;
    sizes: string[];
    colors: string[];
    qtyEach: number;
  }> = [
    {
      name: "Nike Court Vision",
      category: "Sports",
      brand: "Nike",
      baseSku: "NK-CV",
      retail: 1250000,
      cost: 900000,
      sizes: ["40", "41", "42", "43", "44"],
      colors: ["Black"],
      qtyEach: 8,
    },
    {
      name: "Bata School Shoe",
      category: "Kids",
      brand: "Bata",
      baseSku: "BT-SCH",
      retail: 280000,
      cost: 180000,
      sizes: ["32", "33", "34", "35", "36"],
      colors: ["Black"],
      qtyEach: 12,
    },
    {
      name: "Service Formal Oxford",
      category: "Formal",
      brand: "Service",
      baseSku: "SV-OX",
      retail: 450000,
      cost: 300000,
      sizes: ["40", "41", "42", "43"],
      colors: ["Brown", "Black"],
      qtyEach: 6,
    },
  ];

  let variantCount = 0;
  for (const style of styles) {
    const product = await Product.create({
      tenantId: tenant._id,
      name: style.name,
      categoryId: cat(style.category)._id,
      brandId: brand(style.brand)._id,
      unitId: pairUnit._id,
      status: "active",
    });

    for (const color of style.colors) {
      for (const size of style.sizes) {
        const sku = `${style.baseSku}-${color.slice(0, 3).toUpperCase()}-${size}`;
        const variant = await ProductVariant.create({
          tenantId: tenant._id,
          productId: product._id,
          sku,
          name: `${style.name} ${color} ${size}`,
          attributes: { size, color },
          retailPriceMinor: style.retail,
          costMinor: style.cost,
          reorderLevel: 2,
          isActive: true,
        });
        const code = `890${String(1000000000 + variantCount).padStart(10, "0")}`;
        await Barcode.create({
          tenantId: tenant._id,
          variantId: variant._id,
          code,
          isPrimary: true,
        });
        await applyStockMovement({
          tenantId: String(tenant._id),
          branchId: String(branch._id),
          variantId: String(variant._id),
          type: "opening",
          qtyDelta: style.qtyEach,
          unitCostMinor: style.cost,
          createdBy: String(owner._id),
          allowNegative: false,
          refType: "seed",
          refId: String(product._id),
        });
        variantCount += 1;
      }
    }
  }

  logger.info("Sole Style shoe shop ready");
  logger.info(`  Tenant: ${tenant.name} (${SLUG})`);
  logger.info(`  Branch: ${branch.name} / Register: ${register.code}`);
  logger.info(`  Owner:  ${OWNER_EMAIL} / ${PASSWORD}`);
  logger.info(`  Cashier:${CASHIER_EMAIL} / ${PASSWORD}  PIN ${PIN}`);
  logger.info(`  Styles seeded with ${variantCount} size/color variants + barcodes + opening stock`);

  await disconnectDb();
}

main().catch(async (err) => {
  logger.error(err);
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
