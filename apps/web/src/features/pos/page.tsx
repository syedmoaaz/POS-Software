import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Grid2X2,
  List,
  Pause,
  Play,
  Printer,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { formatMoney, type PaymentMethod } from "@mms/shared";
import type { PosCatalogItem } from "@/lib/catalog-types";
import { checkoutSale, fetchCustomers, listProductsForPos, searchProducts } from "@/lib/domain-api";
import { ApiError } from "@/lib/api";
import { useCartStore } from "@/stores/cart-store";
import { useAuthStore } from "@/stores/auth-store";
import { useActiveRegister, useBranchStore } from "@/stores/branch-store";
import { useRegisterStore } from "@/stores/register-store";
import { useUiStore } from "@/stores/ui-store";
import { useOfflineStore } from "@/stores/offline-store";
import { enqueueOfflineSale } from "@/lib/offline/sync-engine";
import { bridgePrintReceipt } from "@/lib/print-bridge";
import { getPrintMethod, printReceiptInBrowser, RECEIPT_STORE } from "@/lib/receipt-print";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type CustomerOption = { id: string; name: string; balanceMinor?: number };

export function PosPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [catalog, setCatalog] = useState<PosCatalogItem[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([
    { id: "c_walkin", name: "Walk-in Customer" },
  ]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [variantPicker, setVariantPicker] = useState<PosCatalogItem[] | null>(null);
  const scanBuffer = useRef("");
  const scanTimer = useRef<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const register = useActiveRegister();
  const branchId = useBranchStore((s) => s.branchId);
  const registerOpen = useRegisterStore((s) => s.open);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const online = useUiStore((s) => s.online);
  const pendingCount = useOfflineStore((s) => s.pendingCount);
  const catalogueMeta = useOfflineStore((s) => s.catalogueMeta);
  const lines = useCartStore((s) => s.lines);
  const held = useCartStore((s) => s.held);
  const customerId = useCartStore((s) => s.customerId);
  const cartDiscountMinor = useCartStore((s) => s.cartDiscountMinor);
  const cartDiscountPercent = useCartStore((s) => s.cartDiscountPercent);
  const note = useCartStore((s) => s.note);
  const addProduct = useCartStore((s) => s.addProduct);
  const setQty = useCartStore((s) => s.setQty);
  const removeLine = useCartStore((s) => s.removeLine);
  const setCustomerId = useCartStore((s) => s.setCustomerId);
  const setCartDiscount = useCartStore((s) => s.setCartDiscount);
  const setCartDiscountPercent = useCartStore((s) => s.setCartDiscountPercent);
  const setLineDiscountPercent = useCartStore((s) => s.setLineDiscountPercent);
  const setNote = useCartStore((s) => s.setNote);
  const holdCart = useCartStore((s) => s.holdCart);
  const resumeHeld = useCartStore((s) => s.resumeHeld);
  const deleteHeld = useCartStore((s) => s.deleteHeld);
  const clearCart = useCartStore((s) => s.clearCart);
  const setLinePrice = useCartStore((s) => s.setLinePrice);
  const taxRateBps = useCartStore((s) => s.taxRateBps);
  const computeTotals = useCartStore((s) => s.totals);
  const completed = useCartStore((s) => s.completed);
  const lastSale = completed.find((c) => c.id === lastReceiptId) ?? completed[0];

  const totals = useMemo(
    () => computeTotals(),
    [computeTotals, lines, cartDiscountMinor, cartDiscountPercent, taxRateBps],
  );

  const categories = useMemo(() => {
    const set = new Set(catalog.map((p) => p.category).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [catalog]);

  const filtered = useMemo(() => {
    return catalog.filter((p) => {
      if (!p.active) return false;
      if (category !== "All" && p.category !== category) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.brand.toLowerCase().includes(q)
      );
    });
  }, [catalog, category, query]);

  const refreshCatalog = async () => {
    if (!branchId) return;
    setLoadingCatalog(true);
    try {
      const items = await listProductsForPos(branchId);
      setCatalog(items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    void refreshCatalog();
    void fetchCustomers()
      .then((res) => {
        setCustomers([
          { id: "c_walkin", name: "Walk-in Customer" },
          ...res.data.map((c) => ({
            id: c.id,
            name: c.name,
            balanceMinor: c.balanceMinor,
          })),
        ]);
      })
      .catch(() => undefined);
  }, [branchId]);

  const tryAdd = (product: PosCatalogItem, qty = 1) => {
    const siblings = catalog.filter((p) => p.productId === product.productId);
    const hasDistinctVariants =
      siblings.length > 1 &&
      siblings.some((s) => Object.keys(s.attributes ?? {}).length > 0);
    if (hasDistinctVariants && !product.barcode) {
      setVariantPicker(siblings);
      return;
    }
    const result = addProduct(product, qty);
    if (!result.ok) toast.error(result.message);
    else toast.success(`${product.name} added`);
  };

  const addByCode = async (code: string) => {
    const local = catalog.find((p) => p.barcode === code || p.sku === code);
    if (local) {
      tryAdd(local);
      return;
    }
    try {
      const rows = await searchProducts(code, branchId);
      if (!rows.length) {
        toast.error(`No product for barcode ${code}`);
        return;
      }
      const row = rows[0]!;
      const item: PosCatalogItem = {
        id: row.variantId,
        productId: row.productId,
        name: row.name,
        sku: row.sku,
        barcode: row.barcode ?? code,
        category: row.categoryName ?? "",
        brand: row.brandName ?? "",
        unit: row.unitName ?? "pcs",
        priceMinor: row.retailPriceMinor,
        costMinor: row.costMinor ?? 0,
        stock: row.qtyOnHand ?? 0,
        reorderLevel: row.reorderLevel ?? 0,
        isWeighted: row.isWeighted,
        active: row.status !== "inactive",
        attributes: row.attributes,
      };
      tryAdd(item);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        if (useCartStore.getState().lines.length) setCheckoutOpen(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") {
        e.preventDefault();
        if (useCartStore.getState().lines.length) {
          holdCart();
          toast.message("Sale held");
        }
        return;
      }
      if (e.key === "F11") {
        e.preventDefault();
        setFullscreen((v) => !v);
        return;
      }

      if (typing) return;

      if (e.key === "Enter") {
        const code = scanBuffer.current;
        scanBuffer.current = "";
        if (code.length >= 4) void addByCode(code);
        return;
      }
      if (e.key.length === 1) {
        scanBuffer.current += e.key;
        if (scanTimer.current) window.clearTimeout(scanTimer.current);
        scanTimer.current = window.setTimeout(() => {
          scanBuffer.current = "";
        }, 80);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [holdCart, catalog, branchId]);

  if (!registerOpen) {
    return (
      <div className="rounded-lg border border-border bg-white p-8 text-center">
        <h2 className="text-xl font-bold">Register is closed</h2>
        <p className="mt-1 text-sm text-ink-muted">Open a cash session before selling.</p>
        <Button className="mt-4" onClick={() => (window.location.href = "/register")}>
          Go to Register
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex h-[calc(100vh-5.5rem)] flex-col gap-3", fullscreen && "fixed inset-0 z-50 bg-white p-3")}>
      {!online ? (
        <div className="rounded-md border border-brand/30 bg-brand-muted px-3 py-2 text-sm text-brand">
          Offline mode — sales will queue locally. Stock and prices may be stale
          {catalogueMeta ? ` (catalogue cached ${new Date(catalogueMeta.pulledAt).toLocaleString()})` : ""}.
          {pendingCount ? ` ${pendingCount} sale(s) waiting to sync.` : ""}
        </div>
      ) : pendingCount > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {pendingCount} offline sale(s) waiting to sync.{" "}
          <a className="font-semibold underline" href="/pos/offline-queue">
            Review queue
          </a>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            ref={searchRef}
            className="pl-9"
            placeholder="Scan OR type barcode / SKU / name… then Enter"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const q = query.trim();
              if (!q) return;
              e.preventDefault();
              // Manual fallback when sticker won't scan: type full barcode/SKU + Enter
              const exact = catalog.find(
                (p) =>
                  p.barcode === q ||
                  p.sku.toLowerCase() === q.toLowerCase() ||
                  p.barcode.toLowerCase() === q.toLowerCase(),
              );
              if (exact) {
                tryAdd(exact);
                setQuery("");
                return;
              }
              if (/^[0-9A-Za-z\-]+$/.test(q) && q.length >= 4) {
                void addByCode(q).then(() => setQuery(""));
                return;
              }
              if (filtered[0]) {
                tryAdd(filtered[0]);
                setQuery("");
              } else {
                toast.error("No product found — check barcode number");
              }
            }}
          />
        </div>
        <Button variant={view === "grid" ? "default" : "outline"} size="icon" onClick={() => setView("grid")}>
          <Grid2X2 className="h-4 w-4" />
        </Button>
        <Button variant={view === "list" ? "default" : "outline"} size="icon" onClick={() => setView("list")}>
          <List className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => void refreshCatalog()} disabled={loadingCatalog}>
          {loadingCatalog ? "Loading…" : "Refresh"}
        </Button>
        <Button variant="outline" onClick={() => setHeldOpen(true)}>
          Held ({held.length})
        </Button>
        <Button variant="outline" onClick={() => setFullscreen((v) => !v)}>
          {fullscreen ? "Exit full screen" : "Full screen"}
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              "shrink-0 rounded-md border px-3 py-1.5 text-sm font-semibold",
              category === c ? "border-brand bg-brand text-white" : "border-border bg-white text-ink-muted",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_380px]">
        <div className="scrollbar-thin min-h-0 overflow-auto rounded-lg border border-border bg-white p-2">
          {filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-ink-muted">
              {loadingCatalog ? "Loading catalogue…" : "No products found"}
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => tryAdd(p)}
                  className="rounded-lg border border-border p-3 text-left transition hover:border-brand hover:shadow-sm"
                >
                  <div className="mb-2 flex h-16 items-center justify-center rounded-md bg-surface-subtle text-xs font-bold text-ink-muted">
                    {p.brand || p.category || "Item"}
                  </div>
                  <div className="line-clamp-2 text-sm font-bold">{p.name}</div>
                  <div className="mt-1 font-mono text-[11px] text-ink-muted">{p.sku}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-extrabold text-brand">{formatMoney(p.priceMinor)}</span>
                    <StockBadge stock={p.stock} reorder={p.reorderLevel} unit={p.unit} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => tryAdd(p)}
                  className="flex w-full items-center gap-3 px-2 py-3 text-left hover:bg-brand-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{p.name}</div>
                    <div className="text-xs text-ink-muted">
                      {p.sku} · {p.barcode}
                    </div>
                  </div>
                  <StockBadge stock={p.stock} reorder={p.reorderLevel} unit={p.unit} />
                  <div className="font-bold">{formatMoney(p.priceMinor)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col rounded-lg border border-border bg-white">
          <div className="flex items-center gap-2 border-b border-border p-3">
            <UserRound className="h-4 w-4 text-brand" />
            <select
              className="h-9 flex-1 rounded-md border border-border bg-white px-2 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.balanceMinor ? ` (due ${formatMoney(c.balanceMinor)})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="scrollbar-thin min-h-0 flex-1 overflow-auto p-2">
            {lines.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-sm text-ink-muted">
                <p>Cart is empty</p>
                <p className="mt-1 text-xs">Scan a barcode or tap a product</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lines.map((line) => (
                  <div key={line.id} className="rounded-md border border-border p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold">{line.name}</div>
                        <div className="font-mono text-[11px] text-ink-muted">{line.sku}</div>
                      </div>
                      <button type="button" className="text-ink-muted hover:text-brand" onClick={() => removeLine(line.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setQty(line.id, line.qty - (line.isWeighted ? 0.1 : 1))}>
                        −
                      </Button>
                      <Input
                        className="h-8 w-20 text-center"
                        value={line.qty}
                        onChange={(e) => setQty(line.id, Number(e.target.value) || 0)}
                      />
                      <Button size="sm" variant="secondary" onClick={() => setQty(line.id, line.qty + (line.isWeighted ? 0.1 : 1))}>
                        +
                      </Button>
                      <div className="ml-auto text-sm font-bold">
                        {formatMoney(
                          Math.round(line.unitPriceMinor * line.qty) -
                            (line.discountPercent
                              ? Math.round((line.unitPriceMinor * line.qty * line.discountPercent) / 100)
                              : line.discountMinor),
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {hasPermission("sales.price_override") ? (
                        <>
                          <span className="text-xs text-ink-muted">Price</span>
                          <Input
                            className="h-8 w-24"
                            type="number"
                            step="0.01"
                            value={(line.unitPriceMinor / 100).toFixed(2)}
                            onChange={(e) => setLinePrice(line.id, Math.round(Number(e.target.value) * 100))}
                          />
                        </>
                      ) : null}
                      {hasPermission("sales.discount") ? (
                        <>
                          <span className="text-xs text-ink-muted">Disc %</span>
                          <Input
                            className="h-8 w-16"
                            type="number"
                            value={line.discountPercent || ""}
                            onChange={(e) => setLineDiscountPercent(line.id, Number(e.target.value || 0))}
                          />
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-border p-3">
            <div className="flex gap-2">
              <Input placeholder="Order note" value={note} onChange={(e) => setNote(e.target.value)} />
              {hasPermission("sales.discount") ? (
                <>
                  <Input
                    className="w-24"
                    type="number"
                    placeholder="Disc Rs"
                    value={cartDiscountMinor ? cartDiscountMinor / 100 : ""}
                    onChange={(e) => setCartDiscount(Math.round(Number(e.target.value || 0) * 100))}
                  />
                  <Input
                    className="w-20"
                    type="number"
                    placeholder="Disc %"
                    value={cartDiscountPercent || ""}
                    onChange={(e) => setCartDiscountPercent(Number(e.target.value || 0))}
                  />
                </>
              ) : null}
            </div>
            <Row label="Subtotal" value={formatMoney(totals.subtotalMinor)} />
            <Row label="Discount" value={`- ${formatMoney(totals.discountMinor)}`} />
            <Row label="Tax" value={formatMoney(totals.taxMinor)} />
            <Row label="Total" value={formatMoney(totals.totalMinor)} bold />
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Button
                variant="secondary"
                disabled={!lines.length}
                onClick={() => {
                  holdCart();
                  toast.message("Sale held");
                }}
              >
                <Pause className="h-4 w-4" /> Hold
              </Button>
              <Button variant="outline" disabled={!lines.length} onClick={() => clearCart()}>
                <X className="h-4 w-4" /> Clear
              </Button>
              <Button disabled={!lines.length} onClick={() => setCheckoutOpen(true)}>
                Pay
              </Button>
            </div>
          </div>
        </div>
      </div>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        totalMinor={totals.totalMinor}
        receiptPrefix={online ? (register?.code ?? "POS") : "OFF"}
        customerName={customers.find((c) => c.id === customerId)?.name ?? "Walk-in Customer"}
        branchId={branchId}
        registerId={register?.id ?? ""}
        customerId={customerId}
        note={note}
        cartDiscountMinor={cartDiscountMinor}
        cartDiscountPercent={cartDiscountPercent}
        online={online}
        onDone={(saleId) => {
          setLastReceiptId(saleId);
          setReceiptOpen(true);
          void refreshCatalog();
        }}
      />

      <Dialog open={Boolean(variantPicker)} onOpenChange={(o) => !o && setVariantPicker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select variant</DialogTitle>
            <DialogDescription>Choose size / option for this product.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {(variantPicker ?? []).map((v) => (
              <Button
                key={v.id}
                variant="outline"
                className="h-auto justify-start py-3"
                onClick={() => {
                  const result = addProduct(v);
                  if (!result.ok) toast.error(result.message);
                  else toast.success(`${v.name} added`);
                  setVariantPicker(null);
                }}
              >
                <div className="text-left">
                  <div className="font-semibold">
                    {Object.entries(v.attributes ?? {})
                      .map(([k, val]) => `${k} ${val}`)
                      .join(" · ") || v.sku}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {formatMoney(v.priceMinor)} · stock {v.stock}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={heldOpen} onOpenChange={setHeldOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Held sales</DialogTitle>
            <DialogDescription>Resume or discard parked carts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {held.length === 0 ? (
              <p className="text-sm text-ink-muted">No held sales</p>
            ) : (
              held.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <div className="font-semibold">{h.label}</div>
                    <div className="text-xs text-ink-muted">
                      {h.lines.length} items · {new Date(h.heldAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        resumeHeld(h.id);
                        setHeldOpen(false);
                      }}
                    >
                      <Play className="h-3.5 w-3.5" /> Resume
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deleteHeld(h.id)}>
                      Discard
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sale complete</DialogTitle>
            <DialogDescription>{lastSale?.receiptNo}</DialogDescription>
          </DialogHeader>
          {lastSale ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total</span>
                <span className="font-bold">{formatMoney(lastSale.totalMinor)}</span>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <span>{lastSale.paymentStatus ?? "paid"}</span>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  void (async () => {
                    const payload = {
                      storeName: RECEIPT_STORE.name,
                      receiptNo: lastSale.receiptNo,
                      soldAt: lastSale.soldAt,
                      customerName: lastSale.customerName,
                      items: lastSale.lines.map((l) => ({
                        name: l.name,
                        qty: l.qty,
                        unitPriceMinor: l.unitPriceMinor,
                        discountMinor: l.discountMinor,
                        lineTotalMinor: Math.round(l.unitPriceMinor * l.qty) - l.discountMinor,
                      })),
                      totals: {
                        subtotalMinor: lastSale.subtotalMinor,
                        discountMinor: lastSale.discountMinor,
                        taxMinor: lastSale.taxMinor,
                        totalMinor: lastSale.totalMinor,
                        changeMinor: lastSale.changeMinor,
                      },
                      payments: lastSale.payments,
                    };
                    try {
                      if (getPrintMethod() === "bridge") {
                        await bridgePrintReceipt(payload as never);
                      } else {
                        await printReceiptInBrowser(payload);
                      }
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Print failed");
                    }
                  })();
                }}
              >
                <Printer className="h-4 w-4" /> Print receipt
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StockBadge({ stock, reorder, unit }: { stock: number; reorder: number; unit: string }) {
  const tone = stock <= 0 ? "danger" : stock <= reorder ? "warning" : "muted";
  return (
    <Badge variant={tone}>
      {stock} {unit}
    </Badge>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between text-sm", bold && "text-base font-extrabold")}>
      <span className={bold ? undefined : "text-ink-muted"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function toDatetimeLocalValue(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function CheckoutDialog({
  open,
  onOpenChange,
  totalMinor,
  receiptPrefix,
  customerName,
  branchId,
  registerId,
  customerId,
  note,
  cartDiscountMinor,
  cartDiscountPercent,
  online,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  totalMinor: number;
  receiptPrefix: string;
  customerName: string;
  branchId: string;
  registerId: string;
  customerId: string;
  note: string;
  cartDiscountMinor: number;
  cartDiscountPercent: number;
  online: boolean;
  onDone: (saleId: string) => void;
}) {
  const completeSale = useCartStore((s) => s.completeSale);
  const lines = useCartStore((s) => s.lines);
  const syncNow = useOfflineStore((s) => s.syncNow);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState("");
  const [split, setSplit] = useState(false);
  const [secondMethod, setSecondMethod] = useState<PaymentMethod>("card");
  const [secondAmount, setSecondAmount] = useState("");
  const [reference, setReference] = useState("");
  const [saleDate, setSaleDate] = useState(toDatetimeLocalValue);
  const [payLater, setPayLater] = useState(false);

  useEffect(() => {
    if (open) {
      setReceived((totalMinor / 100).toFixed(2));
      setSplit(false);
      setSecondAmount("");
      setReference("");
      setMethod("cash");
      setPayLater(false);
      setSaleDate(toDatetimeLocalValue());
    }
  }, [open, totalMinor]);

  const receivedMinor = Math.round(Number(received || 0) * 100);
  const secondMinor = Math.round(Number(secondAmount || 0) * 100);
  const paid = payLater ? 0 : split ? receivedMinor + secondMinor : receivedMinor;
  const change = Math.max(0, paid - totalMinor);
  const hasCustomer = customerId && customerId !== "c_walkin";
  const canComplete = payLater ? hasCustomer : paid >= totalMinor || (hasCustomer && paid < totalMinor);

  const methods: PaymentMethod[] = ["cash", "card", "transfer", "wallet", "store_credit", "customer_credit"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
          <DialogDescription>Total due {formatMoney(totalMinor)}</DialogDescription>
        </DialogHeader>
        <div>
          <div className="mb-1 text-xs font-semibold text-ink-muted">Sale date</div>
          <Input type="datetime-local" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={payLater}
            disabled={!hasCustomer}
            onChange={(e) => setPayLater(e.target.checked)}
          />
          Charge to customer account (pay later)
          {!hasCustomer ? <span className="text-xs text-ink-muted">— select a customer first</span> : null}
        </label>
        {!payLater ? (
          <>
            <div className="flex flex-wrap gap-2">
              {methods.map((m) => (
                <Button key={m} size="sm" variant={method === m ? "default" : "outline"} onClick={() => setMethod(m)}>
                  {m.replace("_", " ")}
                </Button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} />
              Split payment
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold text-ink-muted">
                  {split ? `${method} amount` : "Amount received"}
                </div>
                <Input type="number" step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} />
              </div>
              {split ? (
                <div>
                  <div className="mb-1 text-xs font-semibold text-ink-muted">{secondMethod} amount</div>
                  <div className="flex gap-2">
                    <select
                      className="h-10 rounded-md border border-border px-2 text-sm"
                      value={secondMethod}
                      onChange={(e) => setSecondMethod(e.target.value as PaymentMethod)}
                    >
                      {methods.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <Input type="number" step="0.01" value={secondAmount} onChange={(e) => setSecondAmount(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-1 text-xs font-semibold text-ink-muted">Reference / note</div>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
                </div>
              )}
            </div>
          </>
        ) : null}
        <div className="rounded-md bg-surface-subtle p-3 text-sm">
          <div className="flex justify-between">
            <span>Paid now</span>
            <span className="font-bold">{formatMoney(paid)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>{payLater || paid < totalMinor ? "On account" : "Change"}</span>
            <span className="font-bold text-success">
              {formatMoney(payLater || paid < totalMinor ? Math.max(0, totalMinor - paid) : change)}
            </span>
          </div>
        </div>
        <Button
          size="lg"
          disabled={!canComplete || busy}
          onClick={() => {
            void (async () => {
              let payments: { method: PaymentMethod; amountMinor: number; reference?: string }[] = [];
              if (payLater) {
                payments = [{ method: "customer_credit", amountMinor: totalMinor }];
              } else if (split) {
                payments = [
                  { method, amountMinor: receivedMinor, reference },
                  { method: secondMethod, amountMinor: secondMinor },
                ];
              } else if (method === "customer_credit") {
                payments = [{ method: "customer_credit", amountMinor: totalMinor, reference }];
              } else {
                payments = [{ method, amountMinor: receivedMinor, reference }];
              }

              try {
                setBusy(true);
                const idempotencyKey =
                  typeof crypto !== "undefined" && "randomUUID" in crypto
                    ? crypto.randomUUID()
                    : `idem_${Date.now()}`;

                if (!online) {
                  const sale = completeSale({
                    payments,
                    customerName,
                    receiptPrefix,
                    soldAt: fromDatetimeLocalValue(saleDate),
                  });
                  const offlineId =
                    typeof crypto !== "undefined" && "randomUUID" in crypto
                      ? crypto.randomUUID()
                      : `off_${Date.now()}`;
                  await enqueueOfflineSale({
                    localReceiptNo: sale.receiptNo,
                    payload: {
                      offlineId,
                      idempotencyKey,
                      branchId,
                      registerId,
                      customerId: customerId === "c_walkin" ? undefined : customerId,
                      customerName,
                      notes: note,
                      cartDiscountMinor: cartDiscountMinor || undefined,
                      cartDiscountPercent: cartDiscountPercent || undefined,
                      allowNegativeStock: true,
                      soldAt: sale.soldAt,
                      items: sale.lines.map((l) => ({
                        variantId: l.productId,
                        qty: l.qty,
                        unitPriceMinor: l.unitPriceMinor,
                        discountMinor: l.discountMinor || undefined,
                        discountPercent: l.discountPercent || undefined,
                        note: l.note,
                      })),
                      payments: sale.payments,
                    },
                  });
                  toast.message(`Queued offline sale ${sale.receiptNo}`);
                  onOpenChange(false);
                  onDone(sale.id);
                  return;
                }

                const res = await checkoutSale(
                  {
                    branchId,
                    registerId,
                    customerId: customerId === "c_walkin" ? undefined : customerId,
                    customerName,
                    notes: note,
                    cartDiscountMinor: cartDiscountMinor || undefined,
                    cartDiscountPercent: cartDiscountPercent || undefined,
                    items: lines.map((l) => ({
                      variantId: l.productId,
                      qty: l.qty,
                      unitPriceMinor: l.unitPriceMinor,
                      discountMinor: l.discountMinor || undefined,
                      discountPercent: l.discountPercent || undefined,
                      note: l.note,
                    })),
                    payments,
                  },
                  idempotencyKey,
                );

                const sale = completeSale({
                  payments,
                  customerName: res.data.customerName || customerName,
                  receiptPrefix,
                  soldAt: res.data.soldAt || fromDatetimeLocalValue(saleDate),
                  receiptNo: res.data.receiptNo,
                  saleId: res.data.id,
                  paymentStatus: res.data.paymentStatus,
                });
                toast.success(`Sale ${res.data.receiptNo} completed`);
                void syncNow();
                onOpenChange(false);
                onDone(sale.id);
              } catch (err) {
                const message =
                  err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Checkout failed";
                toast.error(message);
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          {busy ? "Saving…" : online ? "Complete sale" : "Complete offline"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
