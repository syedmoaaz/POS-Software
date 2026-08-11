export type MoneyMinor = number;

export function formatMoney(
  amountMinor: MoneyMinor,
  currency = "PKR",
  locale = "en-PK",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function toMinor(major: number): MoneyMinor {
  return Math.round(major * 100);
}

export function fromMinor(minor: MoneyMinor): number {
  return minor / 100;
}

export const PERMISSIONS = [
  "pos.access",
  "sales.create",
  "sales.view",
  "sales.discount",
  "sales.void_item",
  "sales.hold",
  "sales.price_override",
  "sales.open_drawer",
  "products.view",
  "products.create",
  "products.update",
  "products.delete",
  "products.cost.view",
  "inventory.view",
  "inventory.receive",
  "inventory.adjust",
  "inventory.count",
  "inventory.transfer",
  "customers.view",
  "customers.manage",
  "customers.credit.manage",
  "suppliers.view",
  "suppliers.manage",
  "purchases.view",
  "purchases.create",
  "purchases.receive",
  "returns.create",
  "returns.approve",
  "returns.refund",
  "register.open",
  "register.close",
  "register.cash_in_out",
  "expenses.view",
  "expenses.create",
  "reports.sales",
  "reports.inventory",
  "reports.purchases",
  "reports.profit",
  "reports.export",
  "settings.view",
  "settings.manage",
  "hardware.manage",
  "hardware.print_test",
  "branches.view",
  "branches.manage",
  "registers.view",
  "registers.manage",
  "users.manage",
  "roles.manage",
  "platform.tenants.manage",
  "platform.plans.manage",
  "platform.metrics.view",
  "platform.impersonate",
  "platform.logs.view",
  "platform.health.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type RoleKey =
  | "super_admin"
  | "owner"
  | "manager"
  | "cashier"
  | "inventory";

export const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  super_admin: [
    "platform.tenants.manage",
    "platform.plans.manage",
    "platform.metrics.view",
    "platform.impersonate",
    "platform.logs.view",
    "platform.health.view",
  ],
  owner: PERMISSIONS.filter((p) => !p.startsWith("platform.")),
  manager: [
    "pos.access",
    "sales.create",
    "sales.view",
    "sales.discount",
    "sales.void_item",
    "sales.hold",
    "sales.price_override",
    "sales.open_drawer",
    "products.view",
    "products.create",
    "products.update",
    "products.cost.view",
    "inventory.view",
    "inventory.receive",
    "inventory.adjust",
    "inventory.count",
    "inventory.transfer",
    "customers.view",
    "customers.manage",
    "customers.credit.manage",
    "suppliers.view",
    "suppliers.manage",
    "purchases.view",
    "purchases.create",
    "purchases.receive",
    "returns.create",
    "returns.approve",
    "returns.refund",
    "register.open",
    "register.close",
    "register.cash_in_out",
    "expenses.view",
    "expenses.create",
    "reports.sales",
    "reports.inventory",
    "reports.purchases",
    "reports.profit",
    "reports.export",
    "settings.view",
    "settings.manage",
    "hardware.manage",
    "hardware.print_test",
    "branches.view",
    "registers.view",
  ],
  cashier: [
    "pos.access",
    "sales.create",
    "sales.view",
    "sales.discount",
    "sales.hold",
    "sales.open_drawer",
    "hardware.print_test",
    "products.view",
    "inventory.view",
    "customers.view",
    "returns.create",
    "register.open",
    "register.close",
    "expenses.create",
    "reports.sales",
  ],
  inventory: [
    "products.view",
    "products.cost.view",
    "inventory.view",
    "inventory.receive",
    "inventory.adjust",
    "inventory.count",
    "inventory.transfer",
    "suppliers.view",
    "purchases.view",
    "purchases.receive",
    "reports.inventory",
  ],
};

export type PaymentMethod =
  | "cash"
  | "card"
  | "transfer"
  | "wallet"
  | "store_credit"
  | "customer_credit";
