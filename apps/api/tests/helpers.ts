import request from "supertest";
import mongoose from "mongoose";
import { ROLE_PERMISSIONS } from "@mms/shared";
import { createApp } from "../src/app.js";
import { connectDb, disconnectDb } from "../src/db/connection.js";
import { hashPassword, hashPin } from "../src/lib/password.js";
import { Tenant } from "../src/models/tenant.model.js";
import { Branch } from "../src/models/branch.model.js";
import { Register } from "../src/models/register.model.js";
import { Role } from "../src/models/role.model.js";
import { User } from "../src/models/user.model.js";
import { Category, Brand, Unit } from "../src/models/catalogue-meta.model.js";
import { Product, ProductVariant, Barcode } from "../src/models/product.model.js";
import { BranchInventory } from "../src/models/inventory.model.js";
import { applyStockMovement } from "../src/lib/stock.js";
import { Sale, HeldSale, ReturnModel } from "../src/models/sale.model.js";
import { RegisterSession } from "../src/models/register-session.model.js";
import { Counter } from "../src/models/counter.model.js";
import { RefreshSession } from "../src/models/refresh-session.model.js";
import { AuditLog } from "../src/models/audit.model.js";
import { Supplier, Purchase, PurchaseOrder, SupplierPayment, SupplierLedger } from "../src/models/supplier.model.js";
import { Customer, CustomerLedger, LoyaltyTransaction } from "../src/models/customer.model.js";
import { HardwareDevice, PrintJob } from "../src/models/hardware.model.js";

export type TestFixture = {
  app: ReturnType<typeof createApp>;
  tenantA: { id: string; slug: string };
  tenantB: { id: string; slug: string };
  branchA: { id: string };
  registerA: { id: string };
  ownerA: { email: string; password: string };
  ownerB: { email: string; password: string };
  variantA: { id: string; retailPriceMinor: number };
};

async function wipe() {
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
    ReturnModel.deleteMany({}),
    HeldSale.deleteMany({}),
    Sale.deleteMany({}),
    RegisterSession.deleteMany({}),
    Counter.deleteMany({}),
    BranchInventory.deleteMany({}),
    Barcode.deleteMany({}),
    ProductVariant.deleteMany({}),
    Product.deleteMany({}),
    Category.deleteMany({}),
    Brand.deleteMany({}),
    Unit.deleteMany({}),
    RefreshSession.deleteMany({}),
    AuditLog.deleteMany({}),
    User.deleteMany({}),
    Role.deleteMany({}),
    Register.deleteMany({}),
    Branch.deleteMany({}),
    Tenant.deleteMany({}),
  ]);
}

export async function bootTestApp(): Promise<TestFixture> {
  await connectDb();
  await wipe();

  const password = "demo1234";
  const passwordHash = await hashPassword(password);
  const pinHash = await hashPin("1234");

  const tenantA = await Tenant.create({
    name: "Tenant A",
    slug: "tenant-a",
    status: "active",
    timezone: "Asia/Karachi",
    currency: "PKR",
  });
  const tenantB = await Tenant.create({
    name: "Tenant B",
    slug: "tenant-b",
    status: "active",
    timezone: "Asia/Karachi",
    currency: "PKR",
  });

  const branchA = await Branch.create({
    tenantId: tenantA._id,
    name: "Branch A",
    code: "A1",
    address: "Karachi",
  });
  const registerA = await Register.create({
    tenantId: tenantA._id,
    branchId: branchA._id,
    name: "Reg 1",
    code: "A1-01",
  });

  const ownerRoleA = await Role.create({
    tenantId: tenantA._id,
    key: "owner",
    name: "Owner",
    isSystem: true,
    permissions: ROLE_PERMISSIONS.owner,
  });
  const ownerRoleB = await Role.create({
    tenantId: tenantB._id,
    key: "owner",
    name: "Owner",
    isSystem: true,
    permissions: ROLE_PERMISSIONS.owner,
  });

  await User.create({
    tenantId: tenantA._id,
    email: "owner-a@test.demo",
    passwordHash,
    pinHash,
    name: "Owner A",
    roleIds: [ownerRoleA._id],
    branchIds: [branchA._id],
    status: "active",
  });
  await User.create({
    tenantId: tenantB._id,
    email: "owner-b@test.demo",
    passwordHash,
    name: "Owner B",
    roleIds: [ownerRoleB._id],
    status: "active",
  });

  const unit = await Unit.create({ tenantId: tenantA._id, name: "Piece", code: "pc" });
  const category = await Category.create({ tenantId: tenantA._id, name: "Grocery" });
  const brand = await Brand.create({ tenantId: tenantA._id, name: "Demo" });
  const product = await Product.create({
    tenantId: tenantA._id,
    name: "Test Bread",
    categoryId: category._id,
    brandId: brand._id,
    unitId: unit._id,
    status: "active",
  });
  const variant = await ProductVariant.create({
    tenantId: tenantA._id,
    productId: product._id,
    sku: "TEST-BREAD",
    name: "Default",
    costMinor: 5000,
    retailPriceMinor: 10000,
    reorderLevel: 5,
    isActive: true,
  });
  await applyStockMovement({
    tenantId: String(tenantA._id),
    branchId: String(branchA._id),
    variantId: String(variant._id),
    type: "opening",
    qtyDelta: 50,
    unitCostMinor: 5000,
    createdBy: new mongoose.Types.ObjectId().toString(),
  });

  return {
    app: createApp(),
    tenantA: { id: String(tenantA._id), slug: tenantA.slug },
    tenantB: { id: String(tenantB._id), slug: tenantB.slug },
    branchA: { id: String(branchA._id) },
    registerA: { id: String(registerA._id) },
    ownerA: { email: "owner-a@test.demo", password },
    ownerB: { email: "owner-b@test.demo", password },
    variantA: { id: String(variant._id), retailPriceMinor: variant.retailPriceMinor },
  };
}

export async function shutdownTestApp() {
  await wipe();
  await disconnectDb();
}

export async function login(app: ReturnType<typeof createApp>, email: string, password: string) {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password });
  const cookies = res.headers["set-cookie"] as string[] | string | undefined;
  const cookie = Array.isArray(cookies) ? cookies.map((c) => c.split(";")[0]).join("; ") : "";
  return { res, cookie };
}
