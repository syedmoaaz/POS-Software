import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { formatMoney } from "@mms/shared";
import { moneyFromInput } from "@/lib/api";
import { printBarcodeLabels, barcodeSvg } from "@/lib/barcode-label";
import {
  closeRegisterSession,
  createCustomer,
  createProduct,
  currentRegisterSession,
  fetchBrands,
  fetchCategories,
  fetchCustomer,
  fetchCustomers,
  fetchInventory,
  fetchSale,
  fetchSales,
  fetchSuppliers,
  fetchUnits,
  generateBarcode,
  importProductsCsv,
  listAllProducts,
  listProductsForPos,
  openRegisterSession,
  receivePurchase,
  recordCustomerPayment,
  type SaleListItem,
} from "@/lib/domain-api";
import { printReceiptInBrowser } from "@/lib/receipt-print";
import { useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { useRegisterStore } from "@/stores/register-store";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-surface-subtle text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border hover:bg-brand-muted/30">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-middle">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProductsPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<
    Array<{
      id: string;
      name: string;
      sku: string;
      barcode: string;
      category: string;
      brand: string;
      stock: number;
      unit: string;
      priceMinor: number;
      costMinor: number;
      reorderLevel: number;
      active: boolean;
    }>
  >([]);
  const canCost = useAuthStore((s) => s.hasPermission("products.cost.view"));
  const branchId = useBranchStore((s) => s.branchId);

  useEffect(() => {
    if (!branchId) return;
    void listProductsForPos(branchId)
      .then(setRows)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load products"));
  }, [branchId]);

  const filtered = rows.filter(
    (p) =>
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.sku.toLowerCase().includes(q.toLowerCase()) ||
      p.barcode.includes(q),
  );

  return (
    <div>
      <PageHeader
        title="Products"
        description="Live catalogue for this business."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/products/import">Import</Link>
            </Button>
            <Button asChild>
              <Link to="/products/new">Add product</Link>
            </Button>
          </>
        }
      />
      <Input className="mb-3 max-w-md" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
      <DataTable
        headers={["Product", "SKU", "Category", "Stock", "Price", ...(canCost ? ["Cost"] : []), "Status"]}
        rows={filtered.map((p) => [
          <div key="n">
            <div className="font-semibold">{p.name}</div>
            <div className="text-xs text-ink-muted">{p.brand}</div>
          </div>,
          <span className="font-mono text-xs">{p.sku}</span>,
          p.category,
          <Badge variant={p.stock === 0 ? "danger" : p.stock <= p.reorderLevel ? "warning" : "muted"}>
            {p.stock} {p.unit}
          </Badge>,
          formatMoney(p.priceMinor),
          ...(canCost ? [formatMoney(p.costMinor)] : []),
          <Badge variant={p.active ? "success" : "muted"}>{p.active ? "Active" : "Inactive"}</Badge>,
        ])}
      />
    </div>
  );
}

type VariantDraft = {
  size: string;
  color: string;
  sku: string;
  barcode: string;
  retail: string;
  cost: string;
  qty: string;
};

export function ProductFormPage() {
  const navigate = useNavigate();
  const branchId = useBranchStore((s) => s.branchId);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [units, setUnits] = useState<Array<{ id: string; name: string }>>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([
    { size: "", color: "", sku: "", barcode: "", retail: "", cost: "", qty: "0" },
  ]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([fetchCategories(), fetchBrands(), fetchUnits()]).then(([c, b, u]) => {
      setCategories(c);
      setBrands(b);
      setUnits(u);
      if (u[0]) setUnitId(u[0].id);
    });
  }, []);

  const addVariantRow = () =>
    setVariants((v) => [...v, { size: "", color: "", sku: "", barcode: "", retail: "", cost: "", qty: "0" }]);

  return (
    <div>
      <PageHeader title="New product" description="Create a product with optional size/color variants." />
      <Card className="max-w-4xl">
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <div className="text-xs font-semibold text-ink-muted">Name</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nike Air Runner" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-ink-muted">Category</div>
            <select className="h-10 w-full rounded-md border border-border px-2 text-sm" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-ink-muted">Brand</div>
            <select className="h-10 w-full rounded-md border border-border px-2 text-sm" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">—</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-ink-muted">Unit</div>
            <select className="h-10 w-full rounded-md border border-border px-2 text-sm" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-bold">Variants (size / color)</div>
              <Button type="button" variant="outline" size="sm" onClick={addVariantRow}>
                Add variant
              </Button>
            </div>
            <div className="space-y-3">
              {variants.map((v, idx) => (
                <div key={idx} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-4">
                  <Input placeholder="Size" value={v.size} onChange={(e) => setVariants((all) => all.map((x, i) => (i === idx ? { ...x, size: e.target.value } : x)))} />
                  <Input placeholder="Color" value={v.color} onChange={(e) => setVariants((all) => all.map((x, i) => (i === idx ? { ...x, color: e.target.value } : x)))} />
                  <Input placeholder="SKU *" value={v.sku} onChange={(e) => setVariants((all) => all.map((x, i) => (i === idx ? { ...x, sku: e.target.value } : x)))} />
                  <Input placeholder="Barcode (auto if empty)" value={v.barcode} onChange={(e) => setVariants((all) => all.map((x, i) => (i === idx ? { ...x, barcode: e.target.value } : x)))} />
                  <Input placeholder="Retail PKR" type="number" value={v.retail} onChange={(e) => setVariants((all) => all.map((x, i) => (i === idx ? { ...x, retail: e.target.value } : x)))} />
                  <Input placeholder="Cost PKR" type="number" value={v.cost} onChange={(e) => setVariants((all) => all.map((x, i) => (i === idx ? { ...x, cost: e.target.value } : x)))} />
                  <Input placeholder="Opening qty" type="number" value={v.qty} onChange={(e) => setVariants((all) => all.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))} />
                </div>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <Button
              disabled={busy}
              onClick={() => {
                void (async () => {
                  if (!name.trim() || !unitId) return toast.error("Name and unit required");
                  if (variants.some((v) => !v.sku.trim())) return toast.error("Each variant needs a SKU");
                  setBusy(true);
                  try {
                    await createProduct({
                      name: name.trim(),
                      categoryId: categoryId || null,
                      brandId: brandId || null,
                      unitId,
                      branchId: branchId || undefined,
                      variants: variants.map((v) => {
                        const attributes: Record<string, string> = {};
                        if (v.size.trim()) attributes.size = v.size.trim();
                        if (v.color.trim()) attributes.color = v.color.trim();
                        return {
                          sku: v.sku.trim(),
                          attributes,
                          retailPriceMinor: moneyFromInput(v.retail),
                          costMinor: moneyFromInput(v.cost),
                          barcode: v.barcode.trim() || undefined,
                          openingQty: Number(v.qty || 0),
                        };
                      }),
                    });
                    toast.success("Product saved");
                    navigate("/products");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Save failed");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              {busy ? "Saving…" : "Save product"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProductImportPage() {
  const branchId = useBranchStore((s) => s.branchId);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");

  return (
    <div>
      <PageHeader
        title="Import products"
        description="CSV columns: name, sku, barcode, category, brand, unit, retailPrice, cost, reorderLevel, qtyOnHand, size, color"
      />
      <Card className="max-w-xl">
        <CardContent className="space-y-3 pt-4">
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void (async () => {
                setBusy(true);
                try {
                  const text = await file.text();
                  const lines = text.split(/\r?\n/).filter((l) => l.trim());
                  if (lines.length < 2) throw new Error("CSV needs a header and at least one row");
                  const headers = lines[0]!.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
                  const rows = lines.slice(1).map((line) => {
                    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
                    const obj: Record<string, string> = {};
                    headers.forEach((h, i) => {
                      obj[h] = cols[i] ?? "";
                    });
                    return {
                      name: obj.name || obj.Name,
                      sku: obj.sku || obj.SKU,
                      barcode: obj.barcode || undefined,
                      category: obj.category || undefined,
                      brand: obj.brand || undefined,
                      unit: obj.unit || undefined,
                      retailPrice: obj.retailPrice ? Number(obj.retailPrice) : undefined,
                      cost: obj.cost ? Number(obj.cost) : undefined,
                      reorderLevel: obj.reorderLevel ? Number(obj.reorderLevel) : undefined,
                      qtyOnHand: obj.qtyOnHand ? Number(obj.qtyOnHand) : undefined,
                      size: obj.size || undefined,
                      color: obj.color || undefined,
                    };
                  });
                  const res = await importProductsCsv(rows as never, branchId || undefined);
                  const created = res.data.created;
                  const errors = res.data.errors?.length ?? 0;
                  setResult(`Created ${created}. Errors: ${errors}.`);
                  toast.success(`Imported ${created} products`);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Import failed");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          />
          <p className="text-xs text-ink-muted">
            Opening quantities use the current branch{branchId ? ` (${branchId.slice(-6)})` : ""}.
          </p>
          <Button
            disabled={busy}
            onClick={() => toast.message("Choose a CSV file above")}
          >
            {busy ? "Importing…" : "Upload & import"}
          </Button>
          {result ? <p className="text-sm">{result}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function LabelsPage() {
  const branchId = useBranchStore((s) => s.branchId);
  const [items, setItems] = useState<
    Array<{ id: string; productId: string; name: string; sku: string; barcode: string; priceMinor: number; attributes?: Record<string, string> }>
  >([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [copiesById, setCopiesById] = useState<Record<string, number>>({});
  const [productFilter, setProductFilter] = useState("");
  const [bulkCopies, setBulkCopies] = useState("1");

  useEffect(() => {
    if (!branchId) return;
    void listProductsForPos(branchId).then((rows) => {
      setItems(
        rows.map((r) => ({
          id: r.id,
          productId: r.productId,
          name: r.name,
          sku: r.sku,
          barcode: r.barcode,
          priceMinor: r.priceMinor,
          attributes: r.attributes,
        })),
      );
    });
  }, [branchId]);

  const copiesOf = (id: string) => Math.max(1, Math.min(200, copiesById[id] ?? 1));

  const setCopies = (id: string, value: number) => {
    const n = Math.max(1, Math.min(200, Math.floor(value) || 1));
    setCopiesById((prev) => ({ ...prev, [id]: n }));
  };

  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(productFilter.toLowerCase()) ||
      i.sku.toLowerCase().includes(productFilter.toLowerCase()),
  );
  const selectedItems = items.filter((i) => selected.includes(i.id) && i.barcode);
  const totalStickers = selectedItems.reduce((s, i) => s + copiesOf(i.id), 0);

  const toLabel = (p: (typeof items)[number]) => ({
    name: p.name.split(" (")[0] ?? p.name,
    sku: p.sku,
    barcode: p.barcode,
    priceMinor: p.priceMinor,
    attributeLine: Object.entries(p.attributes ?? {})
      .map(([k, v]) => `${k} ${v}`)
      .join(" · "),
  });

  return (
    <div>
      <PageHeader
        title="Barcode labels"
        description="Har size ke alag copies set karo — ek print mein 10 + 15 mix possible."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Select variants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Filter…" value={productFilter} onChange={(e) => setProductFilter(e.target.value)} />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSelected(filtered.filter((i) => i.barcode).map((i) => i.id))}
              >
                Select filtered
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelected([])}>
                Clear
              </Button>
              <span className="self-center text-ink-muted">{selectedItems.length} selected</span>
              <div className="ml-auto flex items-center gap-1">
                <span className="text-ink-muted">Set all copies</span>
                <Input
                  className="h-8 w-16"
                  type="number"
                  min={1}
                  max={200}
                  value={bulkCopies}
                  onChange={(e) => setBulkCopies(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const n = Math.max(1, Math.min(200, Number(bulkCopies) || 1));
                    const next = { ...copiesById };
                    for (const id of selected) next[id] = n;
                    setCopiesById(next);
                  }}
                >
                  Apply
                </Button>
              </div>
            </div>
            <div className="max-h-80 space-y-1 overflow-auto rounded border border-border p-2">
              {filtered.map((i) => (
                <div key={i.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(i.id)}
                    onChange={(e) => {
                      setSelected((s) =>
                        e.target.checked ? [...s, i.id] : s.filter((x) => x !== i.id),
                      );
                      if (e.target.checked && copiesById[i.id] == null) {
                        setCopies(i.id, 1);
                      }
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate">{i.name}</span>
                  {selected.includes(i.id) ? (
                    <Input
                      className="h-8 w-16 shrink-0"
                      type="number"
                      min={1}
                      max={200}
                      title="Copies for this barcode"
                      value={copiesOf(i.id)}
                      onChange={(e) => setCopies(i.id, Number(e.target.value))}
                    />
                  ) : null}
                </div>
              ))}
            </div>
            <p className="text-xs text-ink-muted">
              Example: size 34 → copies <strong>10</strong>, size 35 → copies <strong>15</strong>, then one Print.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  if (!selectedItems.length) return toast.error("Select variants with barcodes");
                  try {
                    const expanded = selectedItems.flatMap((p) =>
                      Array.from({ length: copiesOf(p.id) }, () => toLabel(p)),
                    );
                    printBarcodeLabels(expanded, 1);
                    toast.success(`Print dialog: ${totalStickers} sticker(s) in one go`);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Print failed");
                  }
                }}
              >
                Print selected ({totalStickers})
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void (async () => {
                    const target = selected[0] ?? selectedItems[0]?.id;
                    if (!target) return toast.error("Select a variant first");
                    try {
                      const res = await generateBarcode(target);
                      setItems((all) =>
                        all.map((i) => (i.id === target ? { ...i, barcode: res.data.code } : i)),
                      );
                      toast.success(`Barcode ${res.data.code}`);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Generate failed");
                    }
                  })();
                }}
              >
                Generate barcode
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              Preview {selectedItems.length ? `(${selectedItems.length} codes · ${totalStickers} stickers)` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedItems.length ? (
              <div className="grid max-h-[28rem] grid-cols-1 gap-3 overflow-auto sm:grid-cols-2">
                {selectedItems.map((p) => (
                  <div key={p.id} className="rounded border border-border p-3 text-center text-xs">
                    <div className="font-sans text-sm font-bold">{p.name.split(" (")[0]}</div>
                    <div className="text-[11px] text-ink-muted">
                      {Object.entries(p.attributes ?? {})
                        .map(([k, v]) => `${k} ${v}`)
                        .join(" · ")}
                    </div>
                    <div
                      className="my-2 overflow-hidden"
                      dangerouslySetInnerHTML={{
                        __html: barcodeSvg(p.barcode, { height: 40, moduleWidth: 1.1 }),
                      }}
                    />
                    <div className="font-mono">{p.barcode}</div>
                    <div className="mt-1 font-bold">{formatMoney(p.priceMinor)}</div>
                    <div className="mt-1 text-ink-muted">× {copiesOf(p.id)} stickers</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-ink-muted">
                Tick sizes, set copies per row (10, 15, …), then Print once.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function InventoryPage() {
  const branchId = useBranchStore((s) => s.branchId);
  const [rows, setRows] = useState<
    Array<{
      variantId: string;
      productName: string;
      sku: string;
      qtyOnHand: number;
      reorderLevel: number;
      valuationMinor?: number;
      isLow: boolean;
    }>
  >([]);

  useEffect(() => {
    if (!branchId) return;
    void fetchInventory(branchId)
      .then((res) => setRows(res.data))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load stock";
        toast.error(msg);
        if (msg.toLowerCase().includes("sign in") || msg.toLowerCase().includes("authentication")) {
          window.location.href = "/login";
        }
      });
  }, [branchId]);

  return (
    <div>
      <PageHeader title="Branch stock" description="Live quantities for the selected branch." />
      <DataTable
        headers={["Product", "SKU", "On hand", "Reorder", "Value"]}
        rows={rows.map((p) => [
          p.productName,
          p.sku,
          <Badge key={p.variantId} variant={p.isLow || p.qtyOnHand <= 0 ? "warning" : "muted"}>
            {p.qtyOnHand}
          </Badge>,
          String(p.reorderLevel),
          p.valuationMinor != null ? formatMoney(p.valuationMinor) : "—",
        ])}
      />
    </div>
  );
}

export function AlertsPage() {
  const branchId = useBranchStore((s) => s.branchId);
  const [rows, setRows] = useState<
    Array<{ variantId: string; productName: string; sku: string; qtyOnHand: number; reorderLevel: number }>
  >([]);

  useEffect(() => {
    if (!branchId) return;
    void fetchInventory(branchId, true).then((res) => setRows(res.data));
  }, [branchId]);

  return (
    <div>
      <PageHeader title="Low stock alerts" description="Items at or below reorder level." />
      <DataTable
        headers={["Product", "SKU", "On hand", "Reorder"]}
        rows={rows.map((p) => [p.productName, p.sku, String(p.qtyOnHand), String(p.reorderLevel)])}
      />
    </div>
  );
}

export function CustomersPage() {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      name: string;
      phone: string;
      group: string;
      balanceMinor: number;
      loyaltyPoints: number;
      storeCreditMinor: number;
    }>
  >([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const reload = () =>
    void fetchCustomers()
      .then((res) => setRows(res.data))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load customers"));

  useEffect(() => {
    reload();
  }, []);

  return (
    <div>
      <PageHeader
        title="Customers"
        actions={
          <div className="flex gap-2">
            <Input className="w-40" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input className="w-36" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button
              onClick={() => {
                void (async () => {
                  try {
                    await createCustomer({ name, phone });
                    setName("");
                    setPhone("");
                    toast.success("Customer added");
                    reload();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed");
                  }
                })();
              }}
            >
              Add customer
            </Button>
          </div>
        }
      />
      <DataTable
        headers={["Name", "Phone", "Group", "Balance", "Loyalty", "Store credit"]}
        rows={rows.map((c) => [
          <Link key={c.id} className="font-semibold text-brand hover:underline" to={`/customers/${c.id}`}>
            {c.name}
          </Link>,
          c.phone,
          c.group,
          formatMoney(c.balanceMinor),
          String(c.loyaltyPoints),
          formatMoney(c.storeCreditMinor),
        ])}
      />
    </div>
  );
}

export function CustomerDetailPage() {
  const { id } = useParams();
  const [customer, setCustomer] = useState<{
    id: string;
    name: string;
    phone: string;
    balanceMinor: number;
    creditLimitMinor: number;
    loyaltyPoints: number;
  } | null>(null);
  const [amount, setAmount] = useState("");

  const reload = () => {
    if (!id) return;
    void fetchCustomer(id)
      .then((res) => setCustomer(res.data))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Not found"));
  };

  useEffect(() => {
    reload();
  }, [id]);

  if (!customer) return <p className="text-sm text-ink-muted">Loading…</p>;

  return (
    <div>
      <PageHeader title={customer.name} description={customer.phone} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-ink-muted">Outstanding</div>
            <div className="text-xl font-extrabold">{formatMoney(customer.balanceMinor)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-ink-muted">Credit limit</div>
            <div className="text-xl font-extrabold">{formatMoney(customer.creditLimitMinor)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-ink-muted">Loyalty points</div>
            <div className="text-xl font-extrabold">{customer.loyaltyPoints}</div>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Record payment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input className="w-40" type="number" placeholder="Amount PKR" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Button
            onClick={() => {
              void (async () => {
                try {
                  await recordCustomerPayment(customer.id, {
                    amountMinor: moneyFromInput(amount),
                    method: "cash",
                  });
                  toast.success("Payment recorded");
                  setAmount("");
                  reload();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Payment failed");
                }
              })();
            }}
          >
            Record payment
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function PurchasesPage() {
  const branchId = useBranchStore((s) => s.branchId);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [variants, setVariants] = useState<Array<{ id: string; name: string; sku: string }>>([]);
  const [supplierId, setSupplierId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchSuppliers().then((res) => {
      setSuppliers(res.data);
      if (res.data[0]) setSupplierId(res.data[0].id);
    });
    void listAllProducts().then((res) => {
      const flat = res.data.flatMap((p) =>
        p.variants.map((v) => ({ id: v.id, name: `${p.name} (${v.sku})`, sku: v.sku })),
      );
      setVariants(flat);
      if (flat[0]) setVariantId(flat[0].id);
    });
  }, []);

  return (
    <div>
      <PageHeader title="Purchases / receiving" description="Receive stock against a supplier (GRN)." />
      <Card className="max-w-xl">
        <CardContent className="space-y-3 pt-4">
          <div>
            <div className="mb-1 text-xs font-semibold text-ink-muted">Supplier</div>
            <select className="h-10 w-full rounded-md border border-border px-2 text-sm" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-ink-muted">Variant</div>
            <select className="h-10 w-full rounded-md border border-border px-2 text-sm" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
            <Input type="number" placeholder="Unit cost PKR" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <Button
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const res = await receivePurchase({
                    branchId,
                    supplierId,
                    lines: [
                      {
                        variantId,
                        qty: Number(qty),
                        unitCostMinor: moneyFromInput(cost),
                      },
                    ],
                  });
                  toast.success(`Received ${res.data.number}`);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Receive failed");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            {busy ? "Receiving…" : "Receive stock"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function RegisterPage() {
  const registerId = useBranchStore((s) => s.registerId);
  const session = useRegisterStore();
  const [opening, setOpening] = useState("5000");
  const [cashMove, setCashMove] = useState("500");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [closing, setClosing] = useState("5000");

  useEffect(() => {
    if (!registerId) return;
    void currentRegisterSession(registerId)
      .then((res) => {
        if (res.data) {
          setSessionId(res.data.id);
          session.openSession(res.data.openingCashMinor);
          useRegisterStore.setState({
            cashInMinor: res.data.cashInMinor,
            cashOutMinor: res.data.cashOutMinor,
          });
        } else {
          setSessionId(null);
          session.closeSession();
        }
      })
      .catch(() => undefined);
  }, [registerId]);

  return (
    <div>
      <PageHeader title="Cash register" description="Open/close sessions against the live API." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant={session.open ? "success" : "danger"}>{session.open ? "Open" : "Closed"}</Badge>
            <div className="text-sm">Opening cash: {formatMoney(session.openingCashMinor)}</div>
            <div className="text-sm">Cash in: {formatMoney(session.cashInMinor)}</div>
            <div className="text-sm">Cash out: {formatMoney(session.cashOutMinor)}</div>
            {!session.open ? (
              <div className="flex gap-2">
                <Input value={opening} onChange={(e) => setOpening(e.target.value)} />
                <Button
                  onClick={() => {
                    void (async () => {
                      try {
                        const res = await openRegisterSession(registerId, moneyFromInput(opening));
                        setSessionId(res.data.id);
                        session.openSession(res.data.openingCashMinor);
                        toast.success("Register opened");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Open failed");
                      }
                    })();
                  }}
                >
                  Open
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input value={closing} onChange={(e) => setClosing(e.target.value)} placeholder="Closing cash" />
                <Button
                  variant="outline"
                  onClick={() => {
                    void (async () => {
                      if (!sessionId) return toast.error("No session id");
                      try {
                        await closeRegisterSession(sessionId, moneyFromInput(closing));
                        session.closeSession();
                        setSessionId(null);
                        toast.success("Register closed");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Close failed");
                      }
                    })();
                  }}
                >
                  Close (Z report)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cash movements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={cashMove} onChange={(e) => setCashMove(e.target.value)} />
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  session.cashIn(moneyFromInput(cashMove));
                  toast.success("Cash in recorded locally — use API session endpoints for persistence");
                }}
              >
                Cash in
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  session.cashOut(moneyFromInput(cashMove));
                  toast.success("Cash out recorded locally");
                }}
              >
                Cash out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function CategoriesPage() {
  const [cats, setCats] = useState<Array<{ id: string; name: string }>>([]);
  const [name, setName] = useState("");
  useEffect(() => {
    void fetchCategories().then(setCats);
  }, []);
  return (
    <div>
      <PageHeader
        title="Categories"
        actions={
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" />
            <Button
              onClick={() => {
                void (async () => {
                  const { apiJson } = await import("@/lib/api");
                  await apiJson("/categories", { method: "POST", json: { name } });
                  setName("");
                  setCats(await fetchCategories());
                  toast.success("Category added");
                })();
              }}
            >
              Add
            </Button>
          </div>
        }
      />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => (
          <Card key={c.id}>
            <CardContent className="pt-4 font-semibold">{c.name}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function BrandsPage() {
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [name, setName] = useState("");
  useEffect(() => {
    void fetchBrands().then(setBrands);
  }, []);
  return (
    <div>
      <PageHeader
        title="Brands"
        actions={
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New brand" />
            <Button
              onClick={() => {
                void (async () => {
                  const { apiJson } = await import("@/lib/api");
                  await apiJson("/brands", { method: "POST", json: { name } });
                  setName("");
                  setBrands(await fetchBrands());
                  toast.success("Brand added");
                })();
              }}
            >
              Add
            </Button>
          </div>
        }
      />
      <DataTable headers={["Brand"]} rows={brands.map((b) => [b.name])} />
    </div>
  );
}

export function SalesPage() {
  const branchId = useBranchStore((s) => s.branchId);
  const [rows, setRows] = useState<SaleListItem[]>([]);

  useEffect(() => {
    void fetchSales(branchId || undefined)
      .then((res) => setRows(res.data))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load sales"));
  }, [branchId]);

  return (
    <div>
      <PageHeader title="Sales history" description="Live receipts from this branch." />
      <DataTable
        headers={["Receipt", "Items", "Customer", "Status", "Total", "When"]}
        rows={rows.map((s) => [
          <Link key={s.id} to={`/sales/${s.id}`} className="font-mono text-xs text-brand hover:underline">
            {s.receiptNo}
          </Link>,
          <span key={`${s.id}-items`} className="text-xs text-ink-muted">
            {(s.items ?? [])
              .slice(0, 2)
              .map((i) => i.name)
              .join(", ")}
            {(s.items?.length ?? 0) > 2 ? "…" : ""}
          </span>,
          s.customerName || "Walk-in",
          <Badge
            key={`${s.id}-st`}
            variant={s.paymentStatus === "paid" ? "success" : "warning"}
          >
            {s.paymentStatus}
          </Badge>,
          formatMoney(s.totalMinor),
          new Date(s.soldAt).toLocaleString(),
        ])}
      />
    </div>
  );
}

export function SaleDetailPage() {
  const { id } = useParams();
  const [sale, setSale] = useState<SaleListItem | null>(null);

  useEffect(() => {
    if (!id) return;
    void fetchSale(id)
      .then((res) => setSale(res.data))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Sale not found"));
  }, [id]);

  if (!sale) {
    return <p className="text-sm text-ink-muted">Loading sale…</p>;
  }

  return (
    <div>
      <PageHeader
        title={sale.receiptNo}
        description={sale.customerName || "Walk-in Customer"}
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void (async () => {
                try {
                  await printReceiptInBrowser({
                    receiptNo: sale.receiptNo,
                    soldAt: sale.soldAt,
                    customerName: sale.customerName,
                    items: (sale.items ?? []).map((l) => ({
                      name: l.name,
                      qty: l.qty,
                      unitPriceMinor: l.unitPriceMinor,
                      discountMinor: l.discountMinor,
                      lineTotalMinor: l.lineTotalMinor,
                    })),
                    totals: {
                      subtotalMinor: sale.subtotalMinor,
                      discountMinor: sale.discountMinor,
                      taxMinor: sale.taxMinor,
                      totalMinor: sale.totalMinor,
                      changeMinor: sale.changeMinor,
                    },
                    payments: (sale.payments ?? []).map((p) => ({
                      method: p.method,
                      amountMinor: p.amountMinor,
                    })),
                  });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Print failed");
                }
              })();
            }}
          >
            Reprint
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="space-y-1 pt-4 text-sm">
          <div>
            Status: <Badge variant={sale.paymentStatus === "paid" ? "success" : "warning"}>{sale.paymentStatus}</Badge>
          </div>
          <div>When: {new Date(sale.soldAt).toLocaleString()}</div>
          <div>
            Payments:{" "}
            {(sale.payments ?? [])
              .map((p) => `${p.method} ${formatMoney(p.amountMinor)}`)
              .join(" · ")}
          </div>
          <div className="text-lg font-extrabold text-brand">{formatMoney(sale.totalMinor)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            headers={["Product / size", "SKU", "Barcode", "Qty", "Price", "Line total"]}
            rows={(sale.items ?? []).map((i) => [
              <div key={`${i.id}-n`}>
                <div className="font-semibold">{i.name}</div>
              </div>,
              <span key={`${i.id}-s`} className="font-mono text-xs">
                {i.sku}
              </span>,
              <span key={`${i.id}-b`} className="font-mono text-xs">
                {i.barcode || "—"}
              </span>,
              String(i.qty),
              formatMoney(i.unitPriceMinor),
              formatMoney(i.lineTotalMinor),
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
