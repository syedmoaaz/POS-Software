import type { MoneyMinor, PaymentMethod, Permission, RoleKey } from "@mms/shared";
import { ROLE_PERMISSIONS } from "@mms/shared";

export type Branch = {
  id: string;
  name: string;
  code: string;
  address: string;
};

export type Register = {
  id: string;
  branchId: string;
  name: string;
  code: string;
};

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: RoleKey;
  permissions: Permission[];
  branchIds: string[];
  pin?: string;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  unit: string;
  priceMinor: MoneyMinor;
  costMinor: MoneyMinor;
  stock: number;
  reorderLevel: number;
  isWeighted?: boolean;
  imageColor: string;
  active: boolean;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  group: "retail" | "wholesale";
  creditLimitMinor: MoneyMinor;
  balanceMinor: MoneyMinor;
  loyaltyPoints: number;
  storeCreditMinor: MoneyMinor;
};

export type Supplier = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  balanceMinor: MoneyMinor;
};

export type SaleRecord = {
  id: string;
  receiptNo: string;
  branchId: string;
  cashierName: string;
  customerName: string;
  totalMinor: MoneyMinor;
  paymentMethod: PaymentMethod;
  paymentStatus: "paid" | "partial" | "unpaid" | "refunded";
  soldAt: string;
  itemCount: number;
};

export const TENANT = {
  id: "ten_demo",
  name: "Karachi Mart Demo",
  currency: "PKR",
  timezone: "Asia/Karachi",
  logoUrl: "/logo.jpeg",
};

export const BRANCHES: Branch[] = [
  {
    id: "br_gul",
    name: "Gulshan Branch",
    code: "GUL",
    address: "Plot 12, Block 5, Gulshan-e-Iqbal, Karachi",
  },
  {
    id: "br_clifton",
    name: "Clifton Branch",
    code: "CLT",
    address: "Shop 4, Boat Basin, Clifton, Karachi",
  },
];

export const REGISTERS: Register[] = [
  { id: "reg_gul_1", branchId: "br_gul", name: "Counter 1", code: "GUL-01" },
  { id: "reg_gul_2", branchId: "br_gul", name: "Counter 2", code: "GUL-02" },
  { id: "reg_clt_1", branchId: "br_clifton", name: "Counter 1", code: "CLT-01" },
];

export const USERS: DemoUser[] = [
  {
    id: "usr_owner",
    name: "Ayesha Khan",
    email: "owner@karachimart.demo",
    role: "owner",
    permissions: ROLE_PERMISSIONS.owner,
    branchIds: BRANCHES.map((b) => b.id),
  },
  {
    id: "usr_mgr",
    name: "Bilal Ahmed",
    email: "manager@karachimart.demo",
    role: "manager",
    permissions: ROLE_PERMISSIONS.manager,
    branchIds: ["br_gul"],
  },
  {
    id: "usr_cashier",
    name: "Sana Malik",
    email: "cashier@karachimart.demo",
    role: "cashier",
    permissions: ROLE_PERMISSIONS.cashier,
    branchIds: ["br_gul"],
    pin: "1234",
  },
  {
    id: "usr_inv",
    name: "Usman Ali",
    email: "inventory@karachimart.demo",
    role: "inventory",
    permissions: ROLE_PERMISSIONS.inventory,
    branchIds: BRANCHES.map((b) => b.id),
  },
  {
    id: "usr_sa",
    name: "Platform Admin",
    email: "admin@megamodern.solutions",
    role: "super_admin",
    permissions: ROLE_PERMISSIONS.super_admin,
    branchIds: [],
  },
];

export const CATEGORIES = [
  "Beverages",
  "Snacks",
  "Dairy",
  "Grocery",
  "Personal Care",
  "Household",
  "Bakery",
];

export const PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "Nestlé Milk Pack 1L",
    sku: "DAI-MILK-1L",
    barcode: "8901058846120",
    category: "Dairy",
    brand: "Nestlé",
    unit: "piece",
    priceMinor: 42000,
    costMinor: 36000,
    stock: 86,
    reorderLevel: 24,
    imageColor: "#FEE2E2",
    active: true,
  },
  {
    id: "p2",
    name: "Olper's Milk 1L",
    sku: "DAI-OLP-1L",
    barcode: "8964001234501",
    category: "Dairy",
    brand: "Olper's",
    unit: "piece",
    priceMinor: 39000,
    costMinor: 33500,
    stock: 12,
    reorderLevel: 20,
    imageColor: "#DBEAFE",
    active: true,
  },
  {
    id: "p3",
    name: "Lux Soap 110g",
    sku: "PC-LUX-110",
    barcode: "8901030865123",
    category: "Personal Care",
    brand: "Lux",
    unit: "piece",
    priceMinor: 18000,
    costMinor: 14000,
    stock: 140,
    reorderLevel: 40,
    imageColor: "#FCE7F3",
    active: true,
  },
  {
    id: "p4",
    name: "Tapal Danedar 950g",
    sku: "GRO-TAP-950",
    barcode: "8964001987654",
    category: "Grocery",
    brand: "Tapal",
    unit: "piece",
    priceMinor: 185000,
    costMinor: 162000,
    stock: 34,
    reorderLevel: 10,
    imageColor: "#FEF3C7",
    active: true,
  },
  {
    id: "p5",
    name: "Coca-Cola 1.5L",
    sku: "BEV-COKE-15",
    barcode: "5449000000996",
    category: "Beverages",
    brand: "Coca-Cola",
    unit: "piece",
    priceMinor: 22000,
    costMinor: 17500,
    stock: 0,
    reorderLevel: 36,
    imageColor: "#FEE2E2",
    active: true,
  },
  {
    id: "p6",
    name: "Lays Classic 50g",
    sku: "SNK-LAYS-50",
    barcode: "8964001112233",
    category: "Snacks",
    brand: "Lays",
    unit: "piece",
    priceMinor: 8000,
    costMinor: 6200,
    stock: 210,
    reorderLevel: 60,
    imageColor: "#FFEDD5",
    active: true,
  },
  {
    id: "p7",
    name: "Surf Excel 1kg",
    sku: "HH-SURF-1K",
    barcode: "8901030654321",
    category: "Household",
    brand: "Surf Excel",
    unit: "piece",
    priceMinor: 65000,
    costMinor: 54000,
    stock: 48,
    reorderLevel: 15,
    imageColor: "#E0E7FF",
    active: true,
  },
  {
    id: "p8",
    name: "Bread Large",
    sku: "BAK-BRD-LRG",
    barcode: "8964001556677",
    category: "Bakery",
    brand: "Dawn",
    unit: "piece",
    priceMinor: 20000,
    costMinor: 14500,
    stock: 28,
    reorderLevel: 20,
    imageColor: "#FEF9C3",
    active: true,
  },
  {
    id: "p9",
    name: "Basmati Rice (loose)",
    sku: "GRO-RICE-KG",
    barcode: "8964001999001",
    category: "Grocery",
    brand: "Kernel",
    unit: "kg",
    priceMinor: 32000,
    costMinor: 27500,
    stock: 180.5,
    reorderLevel: 50,
    isWeighted: true,
    imageColor: "#F3E8FF",
    active: true,
  },
  {
    id: "p10",
    name: "Shan Biryani Masala",
    sku: "GRO-SHAN-BIR",
    barcode: "8964001333444",
    category: "Grocery",
    brand: "Shan",
    unit: "piece",
    priceMinor: 9500,
    costMinor: 7200,
    stock: 95,
    reorderLevel: 30,
    imageColor: "#FFEDD5",
    active: true,
  },
  {
    id: "p11",
    name: "Pepsi 1.5L",
    sku: "BEV-PEP-15",
    barcode: "8964001222333",
    category: "Beverages",
    brand: "Pepsi",
    unit: "piece",
    priceMinor: 21000,
    costMinor: 16800,
    stock: 64,
    reorderLevel: 36,
    imageColor: "#DBEAFE",
    active: true,
  },
  {
    id: "p12",
    name: "Colgate Total 100g",
    sku: "PC-COL-100",
    barcode: "8850006330012",
    category: "Personal Care",
    brand: "Colgate",
    unit: "piece",
    priceMinor: 32000,
    costMinor: 25500,
    stock: 72,
    reorderLevel: 24,
    imageColor: "#E0F2FE",
    active: true,
  },
];

export const CUSTOMERS: Customer[] = [
  {
    id: "c_walkin",
    name: "Walk-in Customer",
    phone: "-",
    group: "retail",
    creditLimitMinor: 0,
    balanceMinor: 0,
    loyaltyPoints: 0,
    storeCreditMinor: 0,
  },
  {
    id: "c1",
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
    id: "c2",
    name: "Fatima Traders",
    phone: "0321-9876543",
    group: "wholesale",
    creditLimitMinor: 10000000,
    balanceMinor: 2750000,
    loyaltyPoints: 0,
    storeCreditMinor: 0,
  },
  {
    id: "c3",
    name: "Nadia Sheikh",
    phone: "0333-5551212",
    group: "retail",
    creditLimitMinor: 500000,
    balanceMinor: 0,
    loyaltyPoints: 88,
    storeCreditMinor: 50000,
  },
];

export const SUPPLIERS: Supplier[] = [
  {
    id: "s1",
    name: "National Distributors",
    phone: "021-34567890",
    email: "orders@national.demo",
    balanceMinor: 4850000,
  },
  {
    id: "s2",
    name: "Fresh Dairy Supply Co.",
    phone: "021-35678901",
    balanceMinor: 920000,
  },
  {
    id: "s3",
    name: "Metro Cash & Carry",
    phone: "021-11163876",
    balanceMinor: 0,
  },
];

export const SALES: SaleRecord[] = [
  {
    id: "sale1",
    receiptNo: "GUL-01-000184",
    branchId: "br_gul",
    cashierName: "Sana Malik",
    customerName: "Walk-in Customer",
    totalMinor: 186000,
    paymentMethod: "cash",
    paymentStatus: "paid",
    soldAt: new Date().toISOString(),
    itemCount: 4,
  },
  {
    id: "sale2",
    receiptNo: "GUL-01-000183",
    branchId: "br_gul",
    cashierName: "Sana Malik",
    customerName: "Hassan Raza",
    totalMinor: 524000,
    paymentMethod: "card",
    paymentStatus: "paid",
    soldAt: new Date(Date.now() - 3600_000).toISOString(),
    itemCount: 7,
  },
  {
    id: "sale3",
    receiptNo: "CLT-01-000091",
    branchId: "br_clifton",
    cashierName: "Bilal Ahmed",
    customerName: "Fatima Traders",
    totalMinor: 1285000,
    paymentMethod: "transfer",
    paymentStatus: "partial",
    soldAt: new Date(Date.now() - 7200_000).toISOString(),
    itemCount: 18,
  },
  {
    id: "sale4",
    receiptNo: "GUL-02-000044",
    branchId: "br_gul",
    cashierName: "Ayesha Khan",
    customerName: "Nadia Sheikh",
    totalMinor: 98000,
    paymentMethod: "wallet",
    paymentStatus: "paid",
    soldAt: new Date(Date.now() - 86400_000).toISOString(),
    itemCount: 2,
  },
];

export const DASHBOARD_TREND = [
  { day: "Mon", sales: 184000 },
  { day: "Tue", sales: 221000 },
  { day: "Wed", sales: 198000 },
  { day: "Thu", sales: 256000 },
  { day: "Fri", sales: 312000 },
  { day: "Sat", sales: 289000 },
  { day: "Sun", sales: 167000 },
];

export const ADMIN_TENANTS = [
  {
    id: "ten_demo",
    name: "Karachi Mart Demo",
    plan: "Growth",
    status: "active" as const,
    mrrMinor: 1500000,
    branches: 2,
    users: 8,
    trialEndsAt: null as string | null,
  },
  {
    id: "ten_2",
    name: "Lahore Fresh Foods",
    plan: "Starter",
    status: "trial" as const,
    mrrMinor: 0,
    branches: 1,
    users: 3,
    trialEndsAt: new Date(Date.now() + 86400_000 * 9).toISOString(),
  },
  {
    id: "ten_3",
    name: "Islamabad Grocers",
    plan: "Growth",
    status: "suspended" as const,
    mrrMinor: 0,
    branches: 3,
    users: 12,
    trialEndsAt: null,
  },
  {
    id: "ten_4",
    name: "Multan Wholesale Hub",
    plan: "Enterprise",
    status: "active" as const,
    mrrMinor: 4500000,
    branches: 5,
    users: 28,
    trialEndsAt: null,
  },
];

export const PURCHASE_ORDERS = [
  {
    id: "po1",
    number: "PO-2026-014",
    supplierName: "National Distributors",
    status: "ordered" as const,
    totalMinor: 3250000,
    orderedAt: new Date(Date.now() - 86400_000 * 2).toISOString(),
  },
  {
    id: "po2",
    number: "PO-2026-015",
    supplierName: "Fresh Dairy Supply Co.",
    status: "partial" as const,
    totalMinor: 980000,
    orderedAt: new Date(Date.now() - 86400_000).toISOString(),
  },
  {
    id: "po3",
    number: "PO-2026-016",
    supplierName: "Metro Cash & Carry",
    status: "draft" as const,
    totalMinor: 540000,
    orderedAt: new Date().toISOString(),
  },
];

export const EXPENSES = [
  {
    id: "ex1",
    category: "Utilities",
    note: "Electricity bill — Gulshan",
    amountMinor: 4850000,
    method: "transfer" as PaymentMethod,
    date: new Date(Date.now() - 86400_000 * 3).toISOString(),
  },
  {
    id: "ex2",
    category: "Transport",
    note: "Delivery van fuel",
    amountMinor: 850000,
    method: "cash" as PaymentMethod,
    date: new Date().toISOString(),
  },
];

export const STOCK_TRANSFERS = [
  {
    id: "tr1",
    from: "Gulshan Branch",
    to: "Clifton Branch",
    status: "dispatched" as const,
    items: 6,
    createdAt: new Date(Date.now() - 3600_000 * 5).toISOString(),
  },
  {
    id: "tr2",
    from: "Clifton Branch",
    to: "Gulshan Branch",
    status: "received" as const,
    items: 3,
    createdAt: new Date(Date.now() - 86400_000 * 2).toISOString(),
  },
];
