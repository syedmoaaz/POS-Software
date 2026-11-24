import { apiJson } from "@/lib/api";
import type { AuthBranch, AuthRegister, AuthTenant, AuthUser, PosCatalogItem } from "@/lib/catalog-types";

type MeResponse = {
  data: {
    user: {
      id: string;
      name: string;
      email: string;
      phone?: string;
      roleKey: string;
      permissions: string[];
      branchIds: string[];
      tenantId: string | null;
    };
    tenant: AuthTenant | null;
    branches: AuthBranch[];
    registers: AuthRegister[];
  };
};

export async function loginPassword(email: string, password: string) {
  return apiJson<MeResponse>("/auth/login", { method: "POST", json: { email, password } });
}

export async function loginPin(pin: string, tenantSlug?: string) {
  return apiJson<MeResponse>("/auth/login/pin", {
    method: "POST",
    json: { pin, ...(tenantSlug ? { tenantSlug } : {}) },
  });
}

export async function logoutApi() {
  return apiJson<{ data: { ok: boolean } }>("/auth/logout", { method: "POST" });
}

export async function fetchMe() {
  return apiJson<MeResponse>("/auth/me");
}

export function mapMe(data: MeResponse["data"]): {
  user: AuthUser;
  tenant: AuthTenant | null;
  branches: AuthBranch[];
  registers: AuthRegister[];
} {
  return {
    user: {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      phone: data.user.phone,
      role: data.user.roleKey,
      permissions: data.user.permissions,
      branchIds: data.user.branchIds,
      tenantId: data.user.tenantId,
    },
    tenant: data.tenant,
    branches: data.branches,
    registers: data.registers,
  };
}

export async function fetchCategories() {
  const res = await apiJson<{ data: Array<{ id: string; name: string }> }>("/categories");
  return res.data;
}

export async function fetchBrands() {
  const res = await apiJson<{ data: Array<{ id: string; name: string }> }>("/brands");
  return res.data;
}

export async function fetchUnits() {
  const res = await apiJson<{ data: Array<{ id: string; name: string; code: string }> }>("/units");
  return res.data;
}

export async function searchProducts(q: string, branchId?: string) {
  const params = new URLSearchParams({ q });
  if (branchId) params.set("branchId", branchId);
  const res = await apiJson<{
    data: Array<{
      variantId: string;
      productId: string;
      name: string;
      sku: string;
      barcode: string | null;
      retailPriceMinor: number;
      costMinor?: number;
      isWeighted?: boolean;
      status?: string;
      attributes?: Record<string, string>;
      qtyOnHand?: number;
      categoryName?: string;
      brandName?: string;
      unitName?: string;
      reorderLevel?: number;
    }>;
  }>(`/products/search?${params}`);
  return res.data;
}

export async function listProductsForPos(branchId: string): Promise<PosCatalogItem[]> {
  const [productsRes, invRes, cats, brands, units] = await Promise.all([
    apiJson<{
      data: Array<{
        id: string;
        name: string;
        categoryId: string | null;
        brandId: string | null;
        unitId: string;
        isWeighted: boolean;
        status: string;
        variants: Array<{
          id: string;
          sku: string;
          name?: string;
          retailPriceMinor: number;
          costMinor?: number;
          reorderLevel: number;
          isActive: boolean;
          attributes?: Record<string, string>;
          barcode?: string | null;
          barcodes?: Array<{ code: string; isPrimary: boolean }>;
        }>;
      }>;
    }>("/products?limit=100&status=active"),
    apiJson<{
      data: Array<{ variantId: string; qtyOnHand: number; reorderLevel: number }>;
    }>(`/inventory?branchId=${branchId}`).catch(() => ({ data: [] as Array<{ variantId: string; qtyOnHand: number; reorderLevel: number }> })),
    fetchCategories().catch(() => []),
    fetchBrands().catch(() => []),
    fetchUnits().catch(() => []),
  ]);

  const catMap = new Map(cats.map((c) => [c.id, c.name]));
  const brandMap = new Map(brands.map((b) => [b.id, b.name]));
  const unitMap = new Map(units.map((u) => [u.id, u.name]));
  const stockMap = new Map(invRes.data.map((r) => [r.variantId, r]));

  const items: PosCatalogItem[] = [];
  for (const p of productsRes.data) {
    for (const v of p.variants) {
      if (!v.isActive) continue;
      const stock = stockMap.get(v.id);
      const barcode =
        v.barcode ||
        v.barcodes?.find((b) => b.isPrimary)?.code ||
        v.barcodes?.[0]?.code ||
        "";
      const attrs = v.attributes ?? {};
      const attrLabel = Object.entries(attrs)
        .map(([k, val]) => `${k}: ${val}`)
        .join(", ");
      items.push({
        id: v.id,
        productId: p.id,
        name: attrLabel ? `${p.name} (${attrLabel})` : p.name,
        sku: v.sku,
        barcode,
        category: p.categoryId ? catMap.get(p.categoryId) ?? "" : "",
        categoryId: p.categoryId,
        brand: p.brandId ? brandMap.get(p.brandId) ?? "" : "",
        brandId: p.brandId,
        unit: unitMap.get(p.unitId) ?? "pcs",
        priceMinor: v.retailPriceMinor,
        costMinor: v.costMinor ?? 0,
        stock: stock?.qtyOnHand ?? 0,
        reorderLevel: v.reorderLevel ?? stock?.reorderLevel ?? 0,
        isWeighted: p.isWeighted,
        active: p.status === "active",
        attributes: attrs,
        imageColor: "#E00818",
      });
    }
  }
  return items;
}

export async function checkoutSale(body: {
  branchId: string;
  registerId: string;
  customerId?: string;
  customerName?: string;
  notes?: string;
  cartDiscountMinor?: number;
  cartDiscountPercent?: number;
  allowNegativeStock?: boolean;
  items: Array<{
    variantId: string;
    qty: number;
    unitPriceMinor?: number;
    discountMinor?: number;
    discountPercent?: number;
    note?: string;
  }>;
  payments: Array<{ method: string; amountMinor: number; reference?: string }>;
}, idempotencyKey: string) {
  return apiJson<{
    data: {
      id: string;
      receiptNo: string;
      totalMinor: number;
      paidMinor: number;
      changeMinor: number;
      paymentStatus: string;
      soldAt: string;
      customerName?: string;
      items: Array<{ name: string; qty: number; unitPriceMinor: number; lineTotalMinor: number; discountMinor?: number }>;
      payments: Array<{ method: string; amountMinor: number }>;
      discountMinor?: number;
      subtotalMinor?: number;
      taxMinor?: number;
    };
  }>("/sales/checkout", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    json: body,
  });
}

export async function openRegisterSession(registerId: string, openingCashMinor: number) {
  return apiJson<{ data: { id: string; openedAt: string; openingCashMinor: number } }>(
    "/register-sessions/open",
    { method: "POST", json: { registerId, openingCashMinor } },
  );
}

export async function closeRegisterSession(sessionId: string, closingCashMinor: number) {
  return apiJson<{ data: { id: string } }>(`/register-sessions/${sessionId}/close`, {
    method: "POST",
    json: { closingCashMinor },
  });
}

export async function currentRegisterSession(registerId: string) {
  return apiJson<{
    data: null | {
      id: string;
      openingCashMinor: number;
      cashInMinor: number;
      cashOutMinor: number;
      cashSalesMinor: number;
      openedAt: string;
    };
  }>(`/register-sessions/current?registerId=${registerId}`);
}

export async function fetchInventory(branchId: string, lowStock = false) {
  const qs = new URLSearchParams({ branchId });
  if (lowStock) qs.set("lowStock", "true");
  return apiJson<{
    data: Array<{
      variantId: string;
      productName: string;
      sku: string;
      qtyOnHand: number;
      reorderLevel: number;
      avgCostMinor?: number;
      valuationMinor?: number;
      isLow: boolean;
    }>;
  }>(`/inventory?${qs}`);
}

export async function fetchCustomers(q = "") {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiJson<{
    data: Array<{
      id: string;
      name: string;
      phone: string;
      email?: string;
      group: "retail" | "wholesale";
      balanceMinor: number;
      creditLimitMinor: number;
      storeCreditMinor: number;
      loyaltyPoints: number;
      isActive: boolean;
    }>;
  }>(`/customers${qs}`);
}

export async function fetchCustomer(id: string) {
  return apiJson<{
    data: {
      id: string;
      name: string;
      phone: string;
      email?: string;
      address?: string;
      group: string;
      balanceMinor: number;
      creditLimitMinor: number;
      storeCreditMinor: number;
      loyaltyPoints: number;
    };
  }>(`/customers/${id}`);
}

export async function recordCustomerPayment(
  id: string,
  body: { amountMinor: number; method: string; note?: string },
) {
  return apiJson<{ data: { balanceMinor: number } }>(`/customers/${id}/payments`, {
    method: "POST",
    json: body,
  });
}

export async function createCustomer(body: {
  name: string;
  phone?: string;
  email?: string;
  creditLimitMinor?: number;
  group?: "retail" | "wholesale";
}) {
  return apiJson<{ data: { id: string; name: string } }>("/customers", {
    method: "POST",
    json: body,
  });
}

export async function fetchDashboard() {
  return apiJson<{
    data: {
      todaySalesMinor?: number;
      todayOrders?: number;
      lowStockCount?: number;
      receivableMinor?: number;
      payableMinor?: number;
      openSessions?: number;
      trend?: Array<{ day: string; sales: number }>;
      salesTodayMinor?: number;
      ordersToday?: number;
    };
  }>("/reports/dashboard");
}

export async function fetchReceivables() {
  return apiJson<{
    data: {
      totalMinor: number;
      rows: Array<{
        id: string;
        name: string;
        phone: string;
        balanceMinor: number;
        creditLimitMinor: number;
        aging?: { current: number; d30: number; d60: number; d90: number };
      }>;
    };
  }>("/reports/receivables");
}

export async function fetchSuppliers() {
  return apiJson<{
    data: Array<{ id: string; name: string; phone: string; balanceMinor: number }>;
  }>("/suppliers");
}

export async function receivePurchase(body: {
  branchId: string;
  supplierId: string;
  lines: Array<{ variantId: string; qty: number; unitCostMinor: number }>;
  notes?: string;
  payNowMinor?: number;
  payMethod?: string;
}) {
  return apiJson<{ data: { id: string; number: string } }>("/purchases/receive", {
    method: "POST",
    json: body,
  });
}

export async function createProduct(body: Record<string, unknown>) {
  return apiJson<{ data: { id: string; variantId?: string; variants?: Array<{ id: string; sku: string }> } }>(
    "/products",
    { method: "POST", json: body },
  );
}

export async function addProductVariant(productId: string, body: Record<string, unknown>) {
  return apiJson<{ data: { id: string; sku: string } }>(`/products/${productId}/variants`, {
    method: "POST",
    json: body,
  });
}

export async function importProductsCsv(
  rows: Array<Record<string, unknown>>,
  branchId?: string,
) {
  return apiJson<{ data: { created: number; errors: Array<{ row: number; message: string }> } }>(
    "/products/import",
    { method: "POST", json: { rows, ...(branchId ? { branchId } : {}) } },
  );
}

export async function generateBarcode(variantId?: string) {
  return apiJson<{ data: { code: string } }>("/products/barcodes/generate", {
    method: "POST",
    json: variantId ? { variantId } : {},
  });
}

export async function listProductDetails(id: string) {
  return apiJson<{
    data: {
      id: string;
      name: string;
      variants: Array<{
        id: string;
        sku: string;
        retailPriceMinor: number;
        attributes?: Record<string, string>;
        barcodes: Array<{ code: string; isPrimary: boolean }>;
      }>;
    };
  }>(`/products/${id}`);
}

export type SaleListItem = {
  id: string;
  receiptNo: string;
  customerName?: string;
  totalMinor: number;
  paymentStatus: string;
  soldAt: string;
  items: Array<{
    id: string;
    name: string;
    sku: string;
    barcode?: string;
    qty: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
    discountMinor?: number;
  }>;
  payments: Array<{ method: string; amountMinor: number }>;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  paidMinor: number;
  changeMinor: number;
  notes?: string;
};

export async function fetchSales(branchId?: string) {
  const qs = branchId ? `?branchId=${branchId}&limit=50` : "?limit=50";
  return apiJson<{ data: SaleListItem[]; meta: { total: number } }>(`/sales${qs}`);
}

export async function fetchSale(id: string) {
  return apiJson<{ data: SaleListItem }>(`/sales/${id}`);
}

export async function listAllProducts() {
  return apiJson<{
    data: Array<{
      id: string;
      name: string;
      status: string;
      categoryId: string | null;
      brandId: string | null;
      variants: Array<{
        id: string;
        sku: string;
        retailPriceMinor: number;
        costMinor?: number;
        reorderLevel: number;
        isActive: boolean;
        attributes?: Record<string, string>;
      }>;
    }>;
  }>("/products?limit=100");
}
