import { create } from "zustand";
import { countPendingQueue, getCatalogueMeta, listQueuedSales } from "@/lib/offline/db";
import {
  flushSaleQueue,
  onQueueChanged,
  pullCatalogue as pullCatalogueApi,
} from "@/lib/offline/sync-engine";
import type { CatalogueCacheMeta, QueuedSale } from "@/lib/offline/types";

type OfflineState = {
  queue: QueuedSale[];
  pendingCount: number;
  catalogueMeta: CatalogueCacheMeta | null;
  lastSyncAt: string | null;
  syncing: boolean;
  refresh: () => Promise<void>;
  syncNow: () => Promise<{ synced: number; failed: number }>;
  pullCatalogueForBranch: (branchId: string, full?: boolean) => Promise<void>;
};

export const useOfflineStore = create<OfflineState>((set, get) => ({
  queue: [],
  pendingCount: 0,
  catalogueMeta: null,
  lastSyncAt: null,
  syncing: false,
  refresh: async () => {
    const [queue, pendingCount, catalogueMeta] = await Promise.all([
      listQueuedSales(),
      countPendingQueue(),
      getCatalogueMeta(),
    ]);
    set({ queue, pendingCount, catalogueMeta });
  },
  syncNow: async () => {
    set({ syncing: true });
    try {
      const result = await flushSaleQueue();
      await get().refresh();
      set({ lastSyncAt: new Date().toISOString() });
      return result;
    } finally {
      set({ syncing: false });
    }
  },
  pullCatalogueForBranch: async (branchId, full) => {
    set({ syncing: true });
    try {
      await pullCatalogueApi(branchId, { full });
      await get().refresh();
      set({ lastSyncAt: new Date().toISOString() });
    } finally {
      set({ syncing: false });
    }
  },
}));

let wired = false;
export function wireOfflineStore() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  void useOfflineStore.getState().refresh();
  onQueueChanged(() => {
    void useOfflineStore.getState().refresh();
  });
  window.addEventListener("online", () => {
    void useOfflineStore.getState().syncNow();
  });
}
