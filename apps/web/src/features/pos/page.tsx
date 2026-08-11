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
import { CATEGORIES, CUSTOMERS, PRODUCTS, type Product } from "@/mocks/data";
import { useCartStore } from "@/stores/cart-store";
import { useAuthStore } from "@/stores/auth-store";
import { useActiveRegister, useBranchStore } from "@/stores/branch-store";
import { useRegisterStore } from "@/stores/register-store";
import { useUiStore } from "@/stores/ui-store";
import { useOfflineStore } from "@/stores/offline-store";
import { enqueueOfflineSale } from "@/lib/offline/sync-engine";
import { bridgePrintReceipt } from "@/lib/print-bridge";
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

export function PosPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
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
  const note = useCartStore((s) => s.note);
  const addProduct = useCartStore((s) => s.addProduct);
  const setQty = useCartStore((s) => s.setQty);
  const removeLine = useCartStore((s) => s.removeLine);
  const setCustomerId = useCartStore((s) => s.setCustomerId);
  const setCartDiscount = useCartStore((s) => s.setCartDiscount);
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

  // Don't call totals() inside the Zustand selector — it returns a new object
  // every time and can infinite-loop / blank the POS page.
  const totals = useMemo(
    () => computeTotals(),
    [computeTotals, lines, cartDiscountMinor, taxRateBps],
  );

  const filtered = useMemo(() => {
    return PRODUCTS.filter((p) => {
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
  }, [category, query]);

  const tryAdd = (product: Product, qty = 1) => {
    const result = addProduct(product, qty);
    if (!result.ok) toast.error(result.message);
    else toast.success(`${product.name} added`);
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

      // Barcode scanner wedge: rapid keystrokes ending with Enter
      if (e.key === "Enter") {
        const code = scanBuffer.current;
        scanBuffer.current = "";
        if (code.length >= 6) {
          const product = PRODUCTS.find((p) => p.barcode === code || p.sku === code);
          if (product) {
            const result = addProduct(product);
            if (!result.ok) toast.error(result.message);
            else toast.success(`${product.name} added`);
          } else toast.error(`No product for barcode ${code}`);
        }
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
  }, [holdCart, addProduct]);

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
            placeholder="Search name, SKU, barcode… (Ctrl+F)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered[0]) {
                tryAdd(filtered[0]);
                setQuery("");
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
        <Button variant="outline" onClick={() => setHeldOpen(true)}>
          Held ({held.length})
        </Button>
        <Button variant="outline" onClick={() => setFullscreen((v) => !v)}>
          {fullscreen ? "Exit full screen" : "Full screen"}
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {["All", ...CATEGORIES].map((c) => (
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
            <div className="flex h-full items-center justify-center text-sm text-ink-muted">No products found</div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => tryAdd(p)}
                  className="rounded-lg border border-border p-3 text-left transition hover:border-brand hover:shadow-sm"
                >
                  <div
                    className="mb-2 flex h-16 items-center justify-center rounded-md text-xs font-bold text-ink-muted"
                    style={{ background: p.imageColor }}
                  >
                    {p.brand}
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
                  <div className="h-10 w-10 rounded-md" style={{ background: p.imageColor }} />
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
              {CUSTOMERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
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
                      <button
                        type="button"
                        className="text-ink-muted hover:text-brand"
                        onClick={() => {
                          if (!hasPermission("sales.void_item") && !hasPermission("sales.create")) {
                            toast.error("No permission to remove items");
                            return;
                          }
                          removeLine(line.id);
                        }}
                      >
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
                        {formatMoney(line.unitPriceMinor * line.qty - line.discountMinor)}
                      </div>
                    </div>
                    {hasPermission("sales.price_override") ? (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-ink-muted">Price</span>
                        <Input
                          className="h-8 w-28"
                          type="number"
                          step="0.01"
                          value={(line.unitPriceMinor / 100).toFixed(2)}
                          onChange={(e) => setLinePrice(line.id, Math.round(Number(e.target.value) * 100))}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-border p-3">
            <div className="flex gap-2">
              <Input
                placeholder="Order note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              {hasPermission("sales.discount") ? (
                <Input
                  className="w-28"
                  type="number"
                  placeholder="Disc Rs"
                  value={cartDiscountMinor ? cartDiscountMinor / 100 : ""}
                  onChange={(e) => setCartDiscount(Math.round(Number(e.target.value || 0) * 100))}
                />
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
            <p className="text-[11px] text-ink-muted">Shortcuts: Ctrl+P pay · Ctrl+H hold · F11 fullscreen</p>
          </div>
        </div>
      </div>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        totalMinor={totals.totalMinor}
        receiptPrefix={online ? (register?.code ?? "POS") : "OFF"}
        customerName={CUSTOMERS.find((c) => c.id === customerId)?.name ?? "Walk-in Customer"}
        branchId={branchId}
        registerId={register?.id ?? ""}
        customerId={customerId}
        note={note}
        cartDiscountMinor={cartDiscountMinor}
        online={online}
        onDone={(saleId) => {
          setLastReceiptId(saleId);
          setReceiptOpen(true);
        }}
      />

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
                        toast.success("Cart resumed");
                      }}
                    >
                      <Play className="h-4 w-4" /> Resume
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deleteHeld(h.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sale complete</DialogTitle>
            <DialogDescription>Receipt preview (58/80mm mock)</DialogDescription>
          </DialogHeader>
          {lastSale ? (
            <div className="rounded-md border border-border bg-white p-4 font-mono text-xs">
              <div className="text-center">
                <img src="/logo.jpeg" alt="" className="mx-auto h-12 w-12 object-contain" />
                <div className="mt-1 font-bold">MEGA MODERN SOLUTIONS</div>
                <div>Karachi Mart · {register.name}</div>
                <div className="mt-2">{lastSale.receiptNo}</div>
              </div>
              <div className="my-3 border-t border-dashed border-border" />
              {lastSale.lines.map((l) => (
                <div key={l.id} className="flex justify-between gap-2">
                  <span>
                    {l.qty} x {l.name}
                  </span>
                  <span>{formatMoney(l.unitPriceMinor * l.qty - l.discountMinor)}</span>
                </div>
              ))}
              <div className="my-3 border-t border-dashed border-border" />
              <div className="flex justify-between font-bold">
                <span>TOTAL</span>
                <span>{formatMoney(lastSale.totalMinor)}</span>
              </div>
              {lastSale.payments.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span>{p.method}</span>
                  <span>{formatMoney(p.amountMinor)}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span>Change</span>
                <span>{formatMoney(lastSale.changeMinor)}</span>
              </div>
              <div className="mt-3 text-center">Thank you for shopping with us</div>
            </div>
          ) : null}
          <Button
            onClick={() => {
              void (async () => {
                if (!lastSale) return;
                try {
                  const res = await bridgePrintReceipt({
                    storeName: "Karachi Mart Demo",
                    receiptNo: lastSale.receiptNo,
                    soldAt: lastSale.soldAt,
                    items: lastSale.lines.map((l) => ({
                      name: l.name,
                      qty: l.qty,
                      unitPriceMinor: l.unitPriceMinor,
                      lineTotalMinor: Math.max(
                        0,
                        Math.round(l.unitPriceMinor * l.qty) - l.discountMinor,
                      ),
                    })),
                    totals: {
                      subtotalMinor: lastSale.subtotalMinor,
                      discountMinor: lastSale.discountMinor,
                      taxMinor: lastSale.taxMinor,
                      totalMinor: lastSale.totalMinor,
                      changeMinor: lastSale.changeMinor,
                    },
                    payments: lastSale.payments.map((p) => ({
                      method: p.method,
                      amountMinor: p.amountMinor,
                    })),
                    paperWidthMm: 80,
                  });
                  if (!res.ok || res.data.data?.status === "failed") {
                    throw new Error(res.data.data?.error || "Print failed");
                  }
                  toast.success("Receipt sent to print bridge");
                  setReceiptOpen(false);
                } catch (err) {
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : "Print bridge offline — start @mms/print-bridge",
                  );
                }
              })();
            }}
          >
            <Printer className="h-4 w-4" /> Print receipt
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StockBadge({ stock, reorder, unit }: { stock: number; reorder: number; unit: string }) {
  if (stock <= 0) return <Badge variant="danger">Out</Badge>;
  if (stock <= reorder) return <Badge variant="warning">{stock} {unit}</Badge>;
  return <Badge variant="muted">{stock} {unit}</Badge>;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? "text-base font-extrabold text-brand" : ""}`}>
      <span className={bold ? "" : "text-ink-muted"}>{label}</span>
      <span>{value}</span>
    </div>
  );
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

  useEffect(() => {
    if (open) {
      setReceived((totalMinor / 100).toFixed(2));
      setSplit(false);
      setSecondAmount("");
      setReference("");
      setMethod("cash");
    }
  }, [open, totalMinor]);

  const receivedMinor = Math.round(Number(received || 0) * 100);
  const secondMinor = Math.round(Number(secondAmount || 0) * 100);
  const paid = split ? receivedMinor + secondMinor : receivedMinor;
  const change = Math.max(0, paid - totalMinor);

  const methods: PaymentMethod[] = ["cash", "card", "transfer", "wallet", "store_credit", "customer_credit"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
          <DialogDescription>Total due {formatMoney(totalMinor)}</DialogDescription>
        </DialogHeader>
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
        <div className="rounded-md bg-surface-subtle p-3 text-sm">
          <div className="flex justify-between">
            <span>Paid</span>
            <span className="font-bold">{formatMoney(paid)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Change</span>
            <span className="font-bold text-success">{formatMoney(change)}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[totalMinor, totalMinor + 10000, totalMinor + 50000].map((v) => (
            <Button key={v} variant="secondary" size="sm" onClick={() => setReceived((v / 100).toFixed(2))}>
              {formatMoney(v)}
            </Button>
          ))}
        </div>
        <Button
          size="lg"
          disabled={paid < totalMinor || busy}
          onClick={() => {
            void (async () => {
              const payments = split
                ? [
                    { method, amountMinor: receivedMinor, reference },
                    { method: secondMethod, amountMinor: secondMinor },
                  ]
                : [{ method, amountMinor: receivedMinor, reference }];
              const sale = completeSale({ payments, customerName, receiptPrefix });
              try {
                setBusy(true);
                if (!online) {
                  const offlineId =
                    typeof crypto !== "undefined" && "randomUUID" in crypto
                      ? crypto.randomUUID()
                      : `off_${Date.now()}`;
                  const idempotencyKey =
                    typeof crypto !== "undefined" && "randomUUID" in crypto
                      ? crypto.randomUUID()
                      : `idem_${Date.now()}`;
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
                      allowNegativeStock: true,
                      soldAt: sale.soldAt,
                      items: sale.lines.map((l) => ({
                        variantId: l.productId,
                        qty: l.qty,
                        unitPriceMinor: l.unitPriceMinor,
                        discountMinor: l.discountMinor || undefined,
                        note: l.note,
                      })),
                      payments: sale.payments,
                    },
                  });
                  toast.message(`Queued offline sale ${sale.receiptNo}`, {
                    description: "Will sync when connection returns",
                  });
                } else {
                  toast.success(`Sale ${sale.receiptNo} completed`);
                  // Push any previously queued offline sales
                  void syncNow();
                }
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not queue sale");
              } finally {
                setBusy(false);
                onOpenChange(false);
                onDone(sale.id);
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
