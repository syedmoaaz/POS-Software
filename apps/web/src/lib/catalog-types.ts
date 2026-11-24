import type { MoneyMinor } from "@mms/shared";

/** POS / catalogue row keyed by variant (stock & barcode live at variant level). */
export type PosCatalogItem = {
  id: string;
  productId: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  categoryId?: string | null;
  brand: string;
  brandId?: string | null;
  unit: string;
  priceMinor: MoneyMinor;
  costMinor: MoneyMinor;
  stock: number;
  reorderLevel: number;
  isWeighted?: boolean;
  active: boolean;
  attributes?: Record<string, string>;
  imageColor?: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  permissions: string[];
  branchIds: string[];
  tenantId: string | null;
};

export type AuthBranch = {
  id: string;
  name: string;
  code: string;
  address?: string;
};

export type AuthRegister = {
  id: string;
  branchId: string;
  name: string;
  code: string;
};

export type AuthTenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  currency: string;
  timezone: string;
  featureFlags?: Record<string, boolean>;
  receiptSettings?: Record<string, unknown>;
};
