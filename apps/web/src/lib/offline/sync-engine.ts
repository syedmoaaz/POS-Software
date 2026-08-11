import { apiFetch } from "@/lib/api";
import {
  enqueueSale,
  getCatalogueMeta,
  listQueuedSales,
  putCatalogue,
  updateQueuedSale,
} from "./db";
import type { OfflineSalePayload, QueuedSale } from "./types";

type CatalogueResponse = {
  data: {
    branchId: string;
    serverTime: string;
    cursor: string;
    full: boolean;
    products: Array<{
      id: string;
      name: string;
      categoryId: string | null;
      brandId: string | null;
      unitId: string;
      isWeighted: boolean;
      status: string;
    }>;
    variants: Array<{
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
    }>;
    inventory: Array<{
      variantId: string;
      qtyOnHand: number;
      qtyReserved: number;
    }>;
  };
};

type SyncSalesResponse = {
  data: {
    synced: number;
    failed: number;
    results: Array<{
      offlineId: string;
      status: "synced" | "failed";
      replayed?: boolean;
      sale?: { id: string; receiptNo: string };
      error?: { code: string; message: string };
    }>;
  };
};

let syncing = false;
const listeners = new Set<() => void>();

export function onQueueChanged(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify() {
  for (const cb of listeners) cb();
}

export async function pullCatalogue(branchId: string, opts?: { full?: boolean }) {
  const meta = opts?.full ? null : await getCatalogueMeta();
  const since =
    meta && meta.branchId === branchId && !opts?.full ? meta.cursor : undefined;
  const qs = new URLSearchParams({ branchId });
  if (since) qs.set("since", since);

  const res = await apiFetch<CatalogueResponse>(`/sync/catalogue?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(
      (res.data as { error?: { message?: string } })?.error?.message ?? "Catalogue pull failed",
    );
  }

  const payload = res.data.data;
  await putCatalogue({
    replace: payload.full || !meta || meta.branchId !== branchId,
    meta: {
      id: "catalogue",
      branchId,
      cursor: payload.cursor,
      pulledAt: payload.serverTime,
      productCount: payload.products.length + (meta && !payload.full ? meta.productCount : 0),
      variantCount: payload.variants.length + (meta && !payload.full ? meta.variantCount : 0),
    },
    products: payload.products,
    variants: payload.variants,
    inventory: payload.inventory,
  });
  notify();
  return payload;
}

export async function enqueueOfflineSale(input: {
  localReceiptNo: string;
  payload: OfflineSalePayload;
}) {
  const now = new Date().toISOString();
  const row: QueuedSale = {
    id: input.payload.offlineId,
    offlineId: input.payload.offlineId,
    localReceiptNo: input.localReceiptNo,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    payload: input.payload,
  };
  await enqueueSale(row);
  notify();
  return row;
}

export async function flushSaleQueue(): Promise<{ synced: number; failed: number }> {
  if (syncing) return { synced: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  syncing = true;
  try {
    const queue = await listQueuedSales();
    const pending = queue.filter((q) => q.status === "pending" || q.status === "failed");
    if (!pending.length) return { synced: 0, failed: 0 };

    for (const item of pending) {
      await updateQueuedSale({
        ...item,
        status: "syncing",
        updatedAt: new Date().toISOString(),
        attempts: item.attempts + 1,
      });
    }
    notify();

    const res = await apiFetch<SyncSalesResponse>("/sync/sales", {
      method: "POST",
      json: { sales: pending.map((p) => p.payload) },
    });

    const results = res.data.data?.results ?? [];
    let synced = 0;
    let failed = 0;

    for (const item of pending) {
      const result = results.find((r) => r.offlineId === item.offlineId);
      if (result?.status === "synced") {
        synced += 1;
        await updateQueuedSale({
          ...item,
          status: "synced",
          serverSaleId: result.sale?.id,
          serverReceiptNo: result.sale?.receiptNo,
          lastError: undefined,
          lastErrorCode: undefined,
          updatedAt: new Date().toISOString(),
          attempts: item.attempts + 1,
        });
      } else {
        failed += 1;
        const code = result?.error?.code ?? "SYNC_FAILED";
        await updateQueuedSale({
          ...item,
          status: code === "STOCK_SHORT" || code === "REGISTER_CLOSED" ? "conflict" : "failed",
          lastError: result?.error?.message ?? "Sync failed",
          lastErrorCode: code,
          updatedAt: new Date().toISOString(),
          attempts: item.attempts + 1,
        });
      }
    }

    notify();
    return { synced, failed };
  } finally {
    syncing = false;
  }
}

export async function getSyncStatus() {
  const res = await apiFetch<{ data: { serverTime: string; offlineSalesLast24h: number } }>(
    "/sync/status",
  );
  return res.data.data;
}
