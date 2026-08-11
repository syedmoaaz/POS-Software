import type { PaymentMethod } from "@mms/shared";

export type QueueStatus = "pending" | "syncing" | "synced" | "failed" | "conflict";

export type OfflineSalePayload = {
  offlineId: string;
  idempotencyKey: string;
  branchId: string;
  registerId: string;
  customerId?: string;
  customerName?: string;
  notes?: string;
  cartDiscountMinor?: number;
  allowNegativeStock?: boolean;
  soldAt: string;
  items: Array<{
    variantId: string;
    qty: number;
    unitPriceMinor?: number;
    discountMinor?: number;
    note?: string;
  }>;
  payments: Array<{
    method: PaymentMethod;
    amountMinor: number;
    reference?: string;
    notes?: string;
  }>;
};

export type QueuedSale = {
  id: string;
  offlineId: string;
  localReceiptNo: string;
  status: QueueStatus;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError?: string;
  lastErrorCode?: string;
  serverSaleId?: string;
  serverReceiptNo?: string;
  payload: OfflineSalePayload;
};

export type CatalogueCacheMeta = {
  id: "catalogue";
  branchId: string;
  cursor: string;
  pulledAt: string;
  productCount: number;
  variantCount: number;
};

export type CachedVariant = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  retailPriceMinor: number;
  wholesalePriceMinor: number;
  minPriceMinor: number;
  reorderLevel: number;
  isActive: boolean;
  costMinor?: number;
};

export type CachedProduct = {
  id: string;
  name: string;
  categoryId: string | null;
  brandId: string | null;
  unitId: string;
  isWeighted: boolean;
  status: string;
};

export type CachedInventory = {
  variantId: string;
  qtyOnHand: number;
  qtyReserved: number;
};
