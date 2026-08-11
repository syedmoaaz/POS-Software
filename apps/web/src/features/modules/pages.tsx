import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatMoney } from "@mms/shared";
import {
  CATEGORIES,
  CUSTOMERS,
  EXPENSES,
  PRODUCTS,
  PURCHASE_ORDERS,
  SALES,
  STOCK_TRANSFERS,
  SUPPLIERS,
} from "@/mocks/data";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { useRegisterStore } from "@/stores/register-store";
import { useBranchStore } from "@/stores/branch-store";
import { useUiStore } from "@/stores/ui-store";
import { useOfflineStore } from "@/stores/offline-store";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
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
  const canCost = useAuthStore((s) => s.hasPermission("products.cost.view"));
  const rows = PRODUCTS.filter(
    (p) =>
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.sku.toLowerCase().includes(q.toLowerCase()) ||
      p.barcode.includes(q),
  );
  return (
    <div>
      <PageHeader
        title="Products"
        description="Catalogue for the current tenant."
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
        rows={rows.map((p) => [
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

export function ProductFormPage() {
  return (
    <div>
      <PageHeader title="New product" description="Create a catalogue item (mock save)." />
      <Card className="max-w-2xl">
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
          {["Name", "SKU", "Barcode", "Category", "Brand", "Retail price (PKR)", "Cost (PKR)", "Reorder level"].map(
            (label) => (
              <div key={label} className="space-y-1">
                <div className="text-xs font-semibold text-ink-muted">{label}</div>
                <Input placeholder={label} />
              </div>
            ),
          )}
          <div className="sm:col-span-2">
            <Button
              onClick={() => toast.success("Product saved (prototype)")}
            >
              Save product
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProductImportPage() {
  return (
    <div>
      <PageHeader title="Import products" description="CSV / Excel bulk import (mock)." />
      <Card className="max-w-xl">
        <CardContent className="space-y-3 pt-4">
          <Input type="file" accept=".csv,.xlsx" />
          <Button onClick={() => toast.success("Imported 24 products (mock)")}>Upload & import</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function CategoriesPage() {
  return (
    <div>
      <PageHeader title="Categories" actions={<Button onClick={() => toast.success("Category added")}>Add</Button>} />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((c) => (
          <Card key={c}>
            <CardContent className="flex items-center justify-between pt-4">
              <div className="font-semibold">{c}</div>
              <Badge variant="muted">{PRODUCTS.filter((p) => p.category === c).length}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function BrandsPage() {
  const brands = [...new Set(PRODUCTS.map((p) => p.brand))];
  return (
    <div>
      <PageHeader title="Brands" actions={<Button onClick={() => toast.success("Brand added")}>Add</Button>} />
      <DataTable
        headers={["Brand", "Products"]}
        rows={brands.map((b) => [b, String(PRODUCTS.filter((p) => p.brand === b).length)])}
      />
    </div>
  );
}

export function LabelsPage() {
  const [selected, setSelected] = useState(PRODUCTS[0].id);
  return (
    <div>
      <PageHeader title="Barcode labels" description="Generate shelf labels for printing." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Select product</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="h-10 w-full rounded-md border border-border px-2 text-sm"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {PRODUCTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button onClick={() => toast.success("Label sent to printer (mock)")}>Print label</Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-center pt-6">
            {(() => {
              const p = PRODUCTS.find((x) => x.id === selected)!;
              return (
                <div className="w-56 rounded border border-border p-3 text-center font-mono text-xs">
                  <div className="font-sans text-sm font-bold">{p.name}</div>
                  <div className="my-2 text-lg tracking-[0.2em]">||||| {p.barcode} |||||</div>
                  <div>{formatMoney(p.priceMinor)}</div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function InventoryPage() {
  return (
    <div>
      <PageHeader title="Branch stock" description="Live quantities for the selected branch." />
      <DataTable
        headers={["Product", "On hand", "Reorder", "Value"]}
        rows={PRODUCTS.map((p) => [
          p.name,
          `${p.stock} ${p.unit}`,
          String(p.reorderLevel),
          formatMoney(Math.round(p.stock * p.costMinor)),
        ])}
      />
    </div>
  );
}

export function MovementsPage() {
  const rows = [
    ["Sale", "Nestlé Milk Pack 1L", "-2", "GUL-01-000184"],
    ["Purchase receive", "Tapal Danedar 950g", "+20", "PO-2026-014"],
    ["Adjustment", "Coca-Cola 1.5L", "-1", "Damage"],
    ["Transfer out", "Lays Classic 50g", "-12", "TR-001"],
  ];
  return (
    <div>
      <PageHeader title="Stock movements" description="Ledger is the source of truth." />
      <DataTable
        headers={["Type", "Product", "Qty", "Reference"]}
        rows={rows.map((r) => r.map((c) => c))}
      />
    </div>
  );
}

export function CountsPage() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <PageHeader
        title="Stock counts"
        actions={<Button onClick={() => setOpen(true)}>Start count</Button>}
      />
      <EmptyState
        title="No open counts"
        description="Start a physical count to capture variances."
        action={<Button onClick={() => setOpen(true)}>Start count</Button>}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New stock count</DialogTitle>
            <DialogDescription>Count session created for Gulshan Branch.</DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => {
              toast.success("Count session started");
              setOpen(false);
            }}
          >
            Confirm
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function TransfersPage() {
  return (
    <div>
      <PageHeader
        title="Stock transfers"
        actions={<Button onClick={() => toast.success("Draft transfer created")}>New transfer</Button>}
      />
      <DataTable
        headers={["From", "To", "Items", "Status", "Created"]}
        rows={STOCK_TRANSFERS.map((t) => [
          t.from,
          t.to,
          String(t.items),
          <Badge key={t.id} variant={t.status === "received" ? "success" : "warning"}>
            {t.status}
          </Badge>,
          new Date(t.createdAt).toLocaleString(),
        ])}
      />
    </div>
  );
}

export function AlertsPage() {
  const alerts = PRODUCTS.filter((p) => p.stock <= p.reorderLevel);
  return (
    <div>
      <PageHeader title="Stock alerts" description="Low and out-of-stock items." />
      <DataTable
        headers={["Product", "Stock", "Reorder", "Status"]}
        rows={alerts.map((p) => [
          p.name,
          String(p.stock),
          String(p.reorderLevel),
          <Badge key={p.id} variant={p.stock === 0 ? "danger" : "warning"}>
            {p.stock === 0 ? "Out of stock" : "Low"}
          </Badge>,
        ])}
      />
    </div>
  );
}

export function CustomersPage() {
  return (
    <div>
      <PageHeader
        title="Customers"
        actions={<Button onClick={() => toast.success("Customer form ready")}>Add customer</Button>}
      />
      <DataTable
        headers={["Name", "Phone", "Group", "Balance", "Loyalty", "Store credit"]}
        rows={CUSTOMERS.filter((c) => c.id !== "c_walkin").map((c) => [
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
  const customer = CUSTOMERS[1];
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
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => toast.success("Payment recorded")}>Record payment</Button>
          <Button variant="outline" onClick={() => toast.message("Statement exported")}>
            Statement
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function SuppliersPage() {
  return (
    <div>
      <PageHeader title="Suppliers" actions={<Button onClick={() => toast.success("Supplier saved")}>Add</Button>} />
      <DataTable
        headers={["Supplier", "Phone", "Payable"]}
        rows={SUPPLIERS.map((s) => [s.name, s.phone, formatMoney(s.balanceMinor)])}
      />
    </div>
  );
}

export function PurchaseOrdersPage() {
  return (
    <div>
      <PageHeader
        title="Purchase orders"
        actions={<Button onClick={() => toast.success("Draft PO created")}>New PO</Button>}
      />
      <DataTable
        headers={["PO #", "Supplier", "Status", "Total", "Ordered"]}
        rows={PURCHASE_ORDERS.map((p) => [
          p.number,
          p.supplierName,
          <Badge key={p.id} variant={p.status === "draft" ? "muted" : "warning"}>
            {p.status}
          </Badge>,
          formatMoney(p.totalMinor),
          new Date(p.orderedAt).toLocaleDateString(),
        ])}
      />
    </div>
  );
}

export function PurchasesPage() {
  return (
    <div>
      <PageHeader title="Purchases / receiving" />
      <DataTable
        headers={["Reference", "Supplier", "Status", "Total"]}
        rows={[
          ["GRN-0091", "National Distributors", <Badge variant="success">Received</Badge>, formatMoney(2100000)],
          ["GRN-0092", "Fresh Dairy Supply Co.", <Badge variant="warning">Partial</Badge>, formatMoney(540000)],
        ]}
      />
    </div>
  );
}

export function SupplierPaymentsPage() {
  return (
    <div>
      <PageHeader
        title="Supplier payments"
        actions={<Button onClick={() => toast.success("Payment recorded")}>Pay supplier</Button>}
      />
      <DataTable
        headers={["Supplier", "Method", "Amount", "Date"]}
        rows={[
          ["National Distributors", "transfer", formatMoney(1000000), "Today"],
          ["Fresh Dairy Supply Co.", "cash", formatMoney(200000), "Yesterday"],
        ]}
      />
    </div>
  );
}

export function SalesPage() {
  const completed = useCartStore((s) => s.completed);
  const all = useMemo(
    () => [
      ...completed.map((c) => ({
        id: c.id,
        receiptNo: c.receiptNo,
        cashierName: "You",
        customerName: c.customerName,
        totalMinor: c.totalMinor,
        paymentStatus: "paid" as const,
        soldAt: c.soldAt,
      })),
      ...SALES,
    ],
    [completed],
  );
  return (
    <div>
      <PageHeader title="Sales history" />
      <DataTable
        headers={["Receipt", "Customer", "Cashier", "Status", "Total", "When"]}
        rows={all.map((s) => [
          <Link key={s.id} to={`/sales/${s.id}`} className="font-mono text-xs text-brand hover:underline">
            {s.receiptNo}
          </Link>,
          s.customerName,
          s.cashierName,
          <Badge variant={s.paymentStatus === "paid" ? "success" : "warning"}>{s.paymentStatus}</Badge>,
          formatMoney(s.totalMinor),
          new Date(s.soldAt).toLocaleString(),
        ])}
      />
    </div>
  );
}

export function SaleDetailPage() {
  const sale = SALES[0];
  return (
    <div>
      <PageHeader
        title={sale.receiptNo}
        description={sale.customerName}
        actions={
          <>
            <Button variant="outline" onClick={() => toast.success("Reprint queued")}>
              Reprint
            </Button>
            <Button asChild>
              <Link to="/returns/new">Return</Link>
            </Button>
          </>
        }
      />
      <Card>
        <CardContent className="space-y-2 pt-4 text-sm">
          <div>Cashier: {sale.cashierName}</div>
          <div>Payment: {sale.paymentMethod}</div>
          <div className="text-lg font-extrabold text-brand">{formatMoney(sale.totalMinor)}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ReturnsPage() {
  return (
    <div>
      <PageHeader title="Returns" actions={<Button asChild><Link to="/returns/new">New return</Link></Button>} />
      <DataTable
        headers={["Return #", "Original sale", "Status", "Amount"]}
        rows={[
          ["RET-0012", "GUL-01-000180", <Badge variant="success">Refunded</Badge>, formatMoney(42000)],
        ]}
      />
    </div>
  );
}

export function ReturnWizardPage() {
  const [receipt, setReceipt] = useState("GUL-01-000184");
  const [found, setFound] = useState(false);
  return (
    <div>
      <PageHeader title="Process return" description="Find a sale by receipt, customer, or date." />
      <Card className="max-w-xl">
        <CardContent className="space-y-3 pt-4">
          <Input value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="Receipt number" />
          <Button
            onClick={() => {
              setFound(true);
              toast.success("Sale found");
            }}
          >
            Find sale
          </Button>
          {found ? (
            <div className="rounded-md border border-border p-3 text-sm">
              <div className="font-semibold">{receipt}</div>
              <div className="text-ink-muted">Nestlé Milk Pack 1L × 2</div>
              <div className="mt-3 flex gap-2">
                <Button
                  onClick={() => toast.success("Return completed · stock restocked")}
                >
                  Refund & restock
                </Button>
                <Button variant="outline" onClick={() => toast.message("Marked damaged")}>
                  Refund · damaged
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function RegisterPage() {
  const session = useRegisterStore();
  const [opening, setOpening] = useState("5000");
  const [cashMove, setCashMove] = useState("500");
  return (
    <div>
      <PageHeader title="Cash register" description="Open/close sessions, cash in/out, X/Z reports." />
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
                    session.openSession(Math.round(Number(opening) * 100));
                    toast.success("Register opened");
                  }}
                >
                  Open
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  session.closeSession();
                  toast.success("Register closed · Z report ready");
                }}
              >
                Close (Z report)
              </Button>
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
                  session.cashIn(Math.round(Number(cashMove) * 100));
                  toast.success("Cash in recorded");
                }}
              >
                Cash in
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  session.cashOut(Math.round(Number(cashMove) * 100));
                  toast.success("Cash out recorded");
                }}
              >
                Cash out
              </Button>
              <Button variant="secondary" onClick={() => toast.success("Drawer kick sent (mock)")}>
                Open drawer
              </Button>
            </div>
            <Button variant="ghost" onClick={() => toast.message("X report generated")}>
              Print X report
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ExpensesPage() {
  return (
    <div>
      <PageHeader
        title="Expenses"
        actions={<Button onClick={() => toast.success("Expense saved")}>Add expense</Button>}
      />
      <DataTable
        headers={["Category", "Note", "Method", "Amount", "Date"]}
        rows={EXPENSES.map((e) => [
          e.category,
          e.note,
          e.method,
          formatMoney(e.amountMinor),
          new Date(e.date).toLocaleDateString(),
        ])}
      />
    </div>
  );
}

export function OfflineQueuePage() {
  const queue = useOfflineStore((s) => s.queue);
  const pendingCount = useOfflineStore((s) => s.pendingCount);
  const syncing = useOfflineStore((s) => s.syncing);
  const catalogueMeta = useOfflineStore((s) => s.catalogueMeta);
  const refresh = useOfflineStore((s) => s.refresh);
  const syncNow = useOfflineStore((s) => s.syncNow);
  const pullCatalogueForBranch = useOfflineStore((s) => s.pullCatalogueForBranch);
  const branchId = useBranchStore((s) => s.branchId);
  const online = useUiStore((s) => s.online);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openIssues = queue.filter((q) => q.status === "failed" || q.status === "conflict");

  return (
    <div>
      <PageHeader
        title="Offline sync queue"
        description="Local sales waiting to reach the server. Conflicts need a manager review."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={syncing || !online}
              onClick={async () => {
                try {
                  await pullCatalogueForBranch(branchId, true);
                  toast.success("Catalogue cached for offline use");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Catalogue pull failed");
                }
              }}
            >
              Pull catalogue
            </Button>
            <Button
              disabled={syncing || !online || pendingCount === 0}
              onClick={async () => {
                const result = await syncNow();
                if (result.failed) toast.error(`${result.failed} sale(s) failed to sync`);
                else if (result.synced) toast.success(`Synced ${result.synced} sale(s)`);
                else toast.message("Nothing to sync");
              }}
            >
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-ink-muted">Pending / failed</div>
            <div className="text-2xl font-extrabold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-ink-muted">Connection</div>
            <div className="text-2xl font-extrabold">{online ? "Online" : "Offline"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-ink-muted">Catalogue cache</div>
            <div className="text-sm font-semibold">
              {catalogueMeta
                ? `${catalogueMeta.productCount} products · ${new Date(catalogueMeta.pulledAt).toLocaleString()}`
                : "Not pulled yet"}
            </div>
          </CardContent>
        </Card>
      </div>

      {!online ? (
        <div className="mb-4 rounded-md border border-brand/30 bg-brand-muted px-3 py-2 text-sm text-brand">
          You are offline. New POS sales will queue locally; stock figures may be stale.
        </div>
      ) : null}

      {openIssues.length ? (
        <Card className="mb-4 border-amber-300">
          <CardHeader>
            <CardTitle className="text-base">Needs review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {openIssues.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border bg-surface-subtle px-3 py-2"
              >
                <div>
                  <div className="font-semibold">
                    {item.localReceiptNo}{" "}
                    <Badge variant="warning">{item.status}</Badge>
                  </div>
                  <div className="text-xs text-ink-muted">
                    {item.lastErrorCode}: {item.lastError}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!online || syncing}
                  onClick={async () => {
                    await syncNow();
                  }}
                >
                  Retry
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {queue.length === 0 ? (
        <EmptyState
          title="Queue clear"
          description="All local sales are synchronized."
          action={
            <Button
              onClick={async () => {
                await refresh();
                toast.success("Queue refreshed");
              }}
            >
              Refresh
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left">Local receipt</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-left">Server receipt</th>
                <th className="px-3 py-2 text-left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => {
                const total = item.payload.payments.reduce((s, p) => s + p.amountMinor, 0);
                return (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{item.localReceiptNo}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          item.status === "synced"
                            ? "success"
                            : item.status === "failed" || item.status === "conflict"
                              ? "danger"
                              : "muted"
                        }
                      >
                        {item.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{formatMoney(total)}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {item.serverReceiptNo ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-muted">
                      {new Date(item.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
