import type { ComponentType } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  Users,
  Truck,
  ClipboardList,
  RotateCcw,
  Wallet,
  Receipt,
  BarChart3,
  Settings,
  Building2,
  Tags,
  ArrowLeftRight,
  AlertTriangle,
  CreditCard,
  Boxes,
  FileSpreadsheet,
  Shield,
} from "lucide-react";
import type { Permission } from "@mms/shared";

export type NavItem = {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  permission?: Permission;
  children?: { label: string; to: string; permission?: Permission }[];
};

export const TENANT_NAV: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  {
    label: "POS",
    to: "/pos",
    icon: ShoppingCart,
    permission: "pos.access",
    children: [
      { label: "Checkout", to: "/pos" },
      { label: "Offline queue", to: "/pos/offline-queue" },
    ],
  },
  { label: "Sales", to: "/sales", icon: Receipt, permission: "sales.view" },
  { label: "Returns", to: "/returns", icon: RotateCcw, permission: "returns.create" },
  {
    label: "Catalogue",
    to: "/products",
    icon: Package,
    permission: "products.view",
    children: [
      { label: "Products", to: "/products" },
      { label: "Categories", to: "/categories" },
      { label: "Brands", to: "/brands" },
      { label: "Labels", to: "/labels" },
    ],
  },
  {
    label: "Inventory",
    to: "/inventory",
    icon: Warehouse,
    permission: "inventory.view",
    children: [
      { label: "Stock", to: "/inventory" },
      { label: "Movements", to: "/inventory/movements" },
      { label: "Counts", to: "/inventory/counts" },
      { label: "Transfers", to: "/inventory/transfers" },
      { label: "Alerts", to: "/inventory/alerts" },
    ],
  },
  {
    label: "Purchasing",
    to: "/suppliers",
    icon: Truck,
    permission: "suppliers.view",
    children: [
      { label: "Suppliers", to: "/suppliers" },
      { label: "Purchase Orders", to: "/purchase-orders" },
      { label: "Purchases", to: "/purchases" },
      { label: "Supplier Payments", to: "/supplier-payments" },
    ],
  },
  { label: "Customers", to: "/customers", icon: Users, permission: "customers.view" },
  { label: "Register", to: "/register", icon: Wallet, permission: "register.open" },
  { label: "Expenses", to: "/expenses", icon: CreditCard, permission: "expenses.view" },
  {
    label: "Reports",
    to: "/reports",
    icon: BarChart3,
    permission: "reports.sales",
    children: [
      { label: "Overview", to: "/reports" },
      { label: "Sales", to: "/reports/sales" },
      { label: "Profit", to: "/reports/profit", permission: "reports.profit" },
      { label: "Inventory", to: "/reports/inventory" },
      { label: "Payables", to: "/reports/payables" },
      { label: "Receivables", to: "/reports/receivables" },
    ],
  },
  { label: "Settings", to: "/settings", icon: Settings, permission: "settings.view" },
];

export const ADMIN_NAV: NavItem[] = [
  { label: "Overview", to: "/admin", icon: LayoutDashboard },
  { label: "Tenants", to: "/admin/tenants", icon: Building2 },
  { label: "Plans", to: "/admin/plans", icon: Tags },
  { label: "Subscriptions", to: "/admin/subscriptions", icon: ClipboardList },
  { label: "Audit Logs", to: "/admin/audit-logs", icon: FileSpreadsheet },
  { label: "Health", to: "/admin/health", icon: Shield },
];

export const QUICK_LINKS = [
  { label: "Open POS", to: "/pos", icon: ShoppingCart },
  { label: "New Product", to: "/products/new", icon: Boxes },
  { label: "Stock Transfer", to: "/inventory/transfers", icon: ArrowLeftRight },
  { label: "Low Stock", to: "/inventory/alerts", icon: AlertTriangle },
];
