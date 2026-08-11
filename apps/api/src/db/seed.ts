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
import { BranchInventory, StockMovement, StockCount, StockTransfer } from "../models/inventory.model.js";
import { applyStockMovement } from "../lib/stock.js";
import { Sale, HeldSale, ReturnModel } from "../models/sale.model.js";
import { RegisterSession } from "../models/register-session.model.js";
import { Counter } from "../models/counter.model.js";
import {
  Supplier,
  SupplierLedger,
  PurchaseOrder,
  Purchase,
  SupplierPayment,
} from "../models/supplier.model.js";
import { Customer, CustomerLedger, LoyaltyTransaction } from "../models/customer.model.js";
import { Expense, ExpenseCategory } from "../models/expense.model.js";
import { HardwareDevice, PrintJob } from "../models/hardware.model.js";
import { createHash } from "node:crypto";

async function seed() {
  await connectDb();

  logger.info("Seeding database…");
  // Ensure schema indexes match models (e.g. partial unique on offlineId)
  await Sale.syncIndexes().catch((err) => logger.warn(err, "Sale.syncIndexes failed"));

  await Promise.all([
    PrintJob.deleteMany({}),
    HardwareDevice.deleteMany({}),
    LoyaltyTransaction.deleteMany({}),
    CustomerLedger.deleteMany({}),
    Customer.deleteMany({}),
    SupplierPayment.deleteMany({}),
    Purchase.deleteMany({}),
    PurchaseOrder.deleteMany({}),
    SupplierLedger.deleteMany({}),
    Supplier.deleteMany({}),
    Expense.deleteMany({}),
    ExpenseCategory.deleteMany({}),
    ReturnModel.deleteMany({}),
    HeldSale.deleteMany({}),
    Sale.deleteMany({}),
    RegisterSession.deleteMany({}),
    Counter.deleteMany({}),
    StockTransfer.deleteMany({}),
    StockCount.deleteMany({}),
    StockMovement.deleteMany({}),
    BranchInventory.deleteMany({}),
    Barcode.deleteMany({}),
    ProductVariant.deleteMany({}),
    Product.deleteMany({}),
    Category.deleteMany({}),
    Brand.deleteMany({}),
    Unit.deleteMany({}),
    User.deleteMany({}),
    Role.deleteMany({}),
    Register.deleteMany({}),
    Branch.deleteMany({}),
    Subscription.deleteMany({}),
    SubscriptionPlan.deleteMany({}),
    Tenant.deleteMany({}),
  ]);

  const plans = await SubscriptionPlan.insertMany([
    {
      code: "STARTER",
      name: "Starter",
      priceMinor: 500000,
      limits: { maxBranches: 1, maxUsers: 3, maxProducts: 1000, maxRegisters: 2 },
      features: ["pos", "inventory"],
    },
    {
      code: "GROWTH",
      name: "Growth",
      priceMinor: 1500000,
      limits: { maxBranches: 3, maxUsers: 15, maxProducts: 10000, maxRegisters: 10 },
      features: ["pos", "inventory", "credit", "loyalty", "reports.profit"],
    },
    {
      code: "ENTERPRISE",
      name: "Enterprise",
      priceMinor: 4500000,
      limits: { maxBranches: 50, maxUsers: 200, maxProducts: 100000, maxRegisters: 100 },
      features: ["all"],
    },
  ]);

  const growth = plans.find((p) => p.code === "GROWTH")!;

  const tenant = await Tenant.create({
    name: "Karachi Mart Demo",
    slug: "karachi-mart",
    status: "active",
    logoUrl: "/logo.jpeg",
    timezone: "Asia/Karachi",
    currency: "PKR",
    locale: "en-PK",
    limits: growth.limits,
  });

  await Subscription.create({
    tenantId: tenant._id,
    planId: growth._id,
    status: "active",
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
  });

  const gulshan = await Branch.create({
    tenantId: tenant._id,
    name: "Gulshan Branch",
    code: "GUL",
    address: "Plot 12, Block 5, Gulshan-e-Iqbal, Karachi",
    phone: "021-111000111",
  });

  const clifton = await Branch.create({
    tenantId: tenant._id,
    name: "Clifton Branch",
    code: "CLT",
    address: "Shop 4, Boat Basin, Clifton, Karachi",
  });

  const [gul01] = await Register.insertMany([
    { tenantId: tenant._id, branchId: gulshan._id, name: "Counter 1", code: "GUL-01" },
    { tenantId: tenant._id, branchId: gulshan._id, name: "Counter 2", code: "GUL-02" },
    { tenantId: tenant._id, branchId: clifton._id, name: "Counter 1", code: "CLT-01" },
  ]);

  const bridgeToken = "mms-dev-bridge-token";
  const printer = await HardwareDevice.create({
    tenantId: tenant._id,
    branchId: gulshan._id,
    registerId: gul01._id,
    name: "Counter 1 Thermal (80mm)",
    type: "printer",
    connection: {
      kind: "bridge",
      bridgeUrl: "http://127.0.0.1:9100",
      paperWidthMm: 80,
    },
    bridgeId: "bridge_demo",
    pairingTokenHash: createHash("sha256").update(bridgeToken).digest("hex"),
    isDefault: true,
    notes: "Demo device — use local print-bridge",
  });
  await HardwareDevice.create({
    tenantId: tenant._id,
    branchId: gulshan._id,
    registerId: gul01._id,
    name: "Counter 1 Cash Drawer",
    type: "drawer",
    connection: {
      kind: "bridge",
      bridgeUrl: "http://127.0.0.1:9100",
    },
    bridgeId: "bridge_demo",
    pairingTokenHash: createHash("sha256").update(bridgeToken).digest("hex"),
    isDefault: true,
  });
  await Register.updateOne({ _id: gul01._id }, { $set: { printerDeviceId: printer._id } });

  const superRole = await Role.create({
    tenantId: null,
    key: "super_admin",
    name: "SaaS Super Admin",
    isSystem: true,
    permissions: ROLE_PERMISSIONS.super_admin,
  });

  const ownerRole = await Role.create({
    tenantId: tenant._id,
    key: "owner",
    name: "Business Owner",
    isSystem: true,
    permissions: ROLE_PERMISSIONS.owner,
  });

  const managerRole = await Role.create({
    tenantId: tenant._id,
    key: "manager",
    name: "Manager",
    isSystem: true,
    permissions: ROLE_PERMISSIONS.manager,
  });

  const cashierRole = await Role.create({
    tenantId: tenant._id,
    key: "cashier",
    name: "Cashier",
    isSystem: true,
    permissions: ROLE_PERMISSIONS.cashier,
  });

  const inventoryRole = await Role.create({
    tenantId: tenant._id,
    key: "inventory",
    name: "Inventory Staff",
    isSystem: true,
    permissions: ROLE_PERMISSIONS.inventory,
  });

  const passwordHash = await hashPassword("demo1234");
  const pinHash = await hashPin("1234");

  await User.insertMany([
    {
      tenantId: null,
      email: "admin@megamodern.solutions",
      passwordHash,
      name: "Platform Admin",
      roleIds: [superRole._id],
      branchIds: [],
      status: "active",
    },
    {
      tenantId: tenant._id,
      email: "owner@karachimart.demo",
      passwordHash,
      name: "Ayesha Khan",
      roleIds: [ownerRole._id],
      branchIds: [gulshan._id, clifton._id],
      status: "active",
    },
    {
      tenantId: tenant._id,
      email: "manager@karachimart.demo",
      passwordHash,
      name: "Bilal Ahmed",
      roleIds: [managerRole._id],
      branchIds: [gulshan._id],
      status: "active",
    },
    {
      tenantId: tenant._id,
      email: "cashier@karachimart.demo",
      passwordHash,
      pinHash,
      name: "Sana Malik",
      roleIds: [cashierRole._id],
      branchIds: [gulshan._id],
      status: "active",
    },
    {
      tenantId: tenant._id,
      email: "inventory@karachimart.demo",
      passwordHash,
      name: "Usman Ali",
      roleIds: [inventoryRole._id],
      branchIds: [gulshan._id, clifton._id],
      status: "active",
    },
  ]);

  const ownerUser = await User.findOne({ email: "owner@karachimart.demo" });
  if (!ownerUser) throw new Error("Owner user missing after seed");

  const units = await Unit.insertMany([
    { tenantId: tenant._id, name: "Piece", code: "piece", allowsDecimal: false },
    { tenantId: tenant._id, name: "Kilogram", code: "kg", allowsDecimal: true },
  ]);
  const piece = units.find((u) => u.code === "piece")!;
  const kg = units.find((u) => u.code === "kg")!;

  const categories = await Category.insertMany(
    ["Beverages", "Snacks", "Dairy", "Grocery", "Personal Care", "Household", "Bakery"].map(
      (name, i) => ({ tenantId: tenant._id, name, sortOrder: i }),
    ),
  );
  const cat = (name: string) => categories.find((c) => c.name === name)!;

  const brands = await Brand.insertMany(
    ["Nestlé", "Olper's", "Coca-Cola", "Lays", "Tapal", "Dawn", "Kernel"].map((name) => ({
      tenantId: tenant._id,
      name,
    })),
  );
  const brand = (name: string) => brands.find((b) => b.name === name)!;

  const demoProducts = [
    {
      name: "Nestlé Milk Pack 1L",
      category: "Dairy",
      brand: "Nestlé",
      unit: piece,
      sku: "DAI-MILK-1L",
      barcode: "8901058846120",
      retail: 42000,
      cost: 36000,
      stock: 86,
      reorder: 24,
    },
    {
      name: "Olper's Milk 1L",
      category: "Dairy",
      brand: "Olper's",
      unit: piece,
      sku: "DAI-OLP-1L",
      barcode: "8964001234501",
      retail: 39000,
      cost: 33500,
      stock: 12,
      reorder: 20,
    },
    {
      name: "Coca-Cola 1.5L",
      category: "Beverages",
      brand: "Coca-Cola",
      unit: piece,
      sku: "BEV-COKE-15",
      barcode: "5449000000996",
      retail: 22000,
      cost: 17500,
      stock: 0,
      reorder: 36,
    },
    {
      name: "Lays Classic 50g",
      category: "Snacks",
      brand: "Lays",
      unit: piece,
      sku: "SNK-LAYS-50",
      barcode: "8964001112233",
      retail: 8000,
      cost: 6200,
      stock: 210,
      reorder: 60,
    },
    {
      name: "Tapal Danedar 950g",
      category: "Grocery",
      brand: "Tapal",
      unit: piece,
      sku: "GRO-TAP-950",
      barcode: "8964001987654",
      retail: 185000,
      cost: 162000,
      stock: 34,
      reorder: 10,
    },
    {
      name: "Bread Large",
      category: "Bakery",
      brand: "Dawn",
      unit: piece,
      sku: "BAK-BRD-LRG",
      barcode: "8964001556677",
      retail: 20000,
      cost: 14500,
      stock: 28,
      reorder: 20,
    },
    {
      name: "Basmati Rice (loose)",
      category: "Grocery",
      brand: "Kernel",
      unit: kg,
      sku: "GRO-RICE-KG",
      barcode: "8964001999001",
      retail: 32000,
      cost: 27500,
      stock: 180.5,
      reorder: 50,
      weighted: true,
    },
  ];

  for (const item of demoProducts) {
    const product = await Product.create({
      tenantId: tenant._id,
      name: item.name,
      categoryId: cat(item.category)._id,
      brandId: brand(item.brand)._id,
      unitId: item.unit._id,
      isWeighted: item.weighted ?? false,
      status: "active",
    });
    const variant = await ProductVariant.create({
      tenantId: tenant._id,
      productId: product._id,
      sku: item.sku,
      name: item.name,
      retailPriceMinor: item.retail,
      costMinor: item.cost,
      reorderLevel: item.reorder,
    });
    await Barcode.create({
      tenantId: tenant._id,
      variantId: variant._id,
      code: item.barcode,
      isPrimary: true,
    });
    if (item.stock > 0) {
      await applyStockMovement({
        tenantId: String(tenant._id),
        branchId: String(gulshan._id),
        variantId: String(variant._id),
        type: "opening",
        qtyDelta: item.stock,
        unitCostMinor: item.cost,
        createdBy: String(ownerUser._id),
        refType: "seed",
        note: "Opening stock",
      });
    } else {
      await BranchInventory.create({
        tenantId: tenant._id,
        branchId: gulshan._id,
        variantId: variant._id,
        qtyOnHand: 0,
        avgCostMinor: item.cost,
      });
    }
  }

  await Supplier.insertMany([
    {
      tenantId: tenant._id,
      name: "National Distributors",
      phone: "021-34567890",
      email: "orders@national.demo",
      balanceMinor: 4850000,
    },
    {
      tenantId: tenant._id,
      name: "Fresh Dairy Supply Co.",
      phone: "021-35678901",
      balanceMinor: 920000,
    },
    {
      tenantId: tenant._id,
      name: "Metro Cash & Carry",
      phone: "021-11163876",
      balanceMinor: 0,
    },
  ]);

  await Customer.insertMany([
    {
      tenantId: tenant._id,
      name: "Walk-in Customer",
      phone: "-",
      group: "retail",
    },
    {
      tenantId: tenant._id,
      name: "Hassan Raza",
      phone: "0300-1234567",
      email: "hassan@example.com",
      group: "retail",
      creditLimitMinor: 2000000,
      balanceMinor: 450000,
      loyaltyPoints: 320,
      storeCreditMinor: 15000,
    },
    {
      tenantId: tenant._id,
      name: "Fatima Traders",
      phone: "0321-9876543",
      group: "wholesale",
      creditLimitMinor: 10000000,
      balanceMinor: 2750000,
    },
    {
      tenantId: tenant._id,
      name: "Nadia Sheikh",
      phone: "0333-5551212",
      group: "retail",
      creditLimitMinor: 500000,
      loyaltyPoints: 88,
      storeCreditMinor: 50000,
    },
  ]);

  await ExpenseCategory.insertMany(
    ["Utilities", "Transport", "Rent", "Salaries", "Miscellaneous"].map((name) => ({
      tenantId: tenant._id,
      name,
    })),
  );

  logger.info("Seed complete");
  logger.info("Demo logins (password: demo1234):");
  logger.info("  owner@karachimart.demo");
  logger.info("  cashier@karachimart.demo (PIN 1234)");
  logger.info("  admin@megamodern.solutions");
  logger.info(`Catalogue: ${demoProducts.length} products with Gulshan opening stock`);
  logger.info("Also seeded: suppliers, customers, expense categories, hardware devices");
  logger.info("Print bridge token: mms-dev-bridge-token @ http://127.0.0.1:9100");

  await disconnectDb();
}

seed().catch(async (err) => {
  logger.error(err, "Seed failed");
  await disconnectDb().catch(() => undefined);
  process.exit(1);
});
