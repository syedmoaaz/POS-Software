import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatMoney } from "@mms/shared";
import { DASHBOARD_TREND, PRODUCTS, SALES, SUPPLIERS } from "@/mocks/data";
import { useAuthStore } from "@/stores/auth-store";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function ReportsHubPage() {
  const links = [
    { to: "/reports/sales", label: "Sales reports" },
    { to: "/reports/profit", label: "Profit & COGS", permission: "reports.profit" as const },
    { to: "/reports/inventory", label: "Inventory" },
    { to: "/reports/payables", label: "Supplier payables" },
    { to: "/reports/receivables", label: "Customer receivables" },
  ];
  const hasPermission = useAuthStore((s) => s.hasPermission);
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Filterable operational and financial reports."
        actions={<Button onClick={() => toast.success("Exported CSV (mock)")}>Export</Button>}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links
          .filter((l) => !l.permission || hasPermission(l.permission))
          .map((l) => (
            <Link key={l.to} to={l.to} className="rounded-lg border border-border bg-white p-4 font-semibold hover:border-brand">
              {l.label}
            </Link>
          ))}
      </div>
    </div>
  );
}

export function SalesReportPage() {
  return (
    <div>
      <PageHeader title="Sales report" actions={<Button variant="outline" onClick={() => toast.message("PDF ready")}>PDF</Button>} />
      <Card className="mb-4">
        <CardContent className="h-64 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={DASHBOARD_TREND}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="sales" fill="#E00818" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-left">Receipt</th>
              <th className="px-3 py-2 text-left">Method</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {SALES.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{s.receiptNo}</td>
                <td className="px-3 py-2">{s.paymentMethod}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatMoney(s.totalMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProfitReportPage() {
  const allowed = useAuthStore((s) => s.hasPermission("reports.profit"));
  if (!allowed) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-ink-muted">
          You do not have permission to view profit and cost reports.
        </CardContent>
      </Card>
    );
  }
  const cogs = PRODUCTS.reduce((s, p) => s + p.costMinor * 2, 0);
  const sales = SALES.reduce((s, x) => s + x.totalMinor, 0);
  return (
    <div>
      <PageHeader title="Profit report" description="Visible only to authorized roles." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-ink-muted">Gross sales</div>
            <div className="text-xl font-extrabold">{formatMoney(sales)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-ink-muted">COGS</div>
            <div className="text-xl font-extrabold">{formatMoney(cogs)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-ink-muted">Gross profit</div>
            <div className="text-xl font-extrabold text-success">{formatMoney(sales - cogs)}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function InventoryReportPage() {
  return (
    <div>
      <PageHeader title="Inventory valuation" />
      <Card>
        <CardContent className="pt-4 text-2xl font-extrabold">
          {formatMoney(PRODUCTS.reduce((s, p) => s + Math.round(p.stock * p.costMinor), 0))}
        </CardContent>
      </Card>
    </div>
  );
}

export function PayablesReportPage() {
  return (
    <div>
      <PageHeader title="Supplier payables" />
      <div className="space-y-2">
        {SUPPLIERS.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex items-center justify-between pt-4">
              <div className="font-semibold">{s.name}</div>
              <div className="font-bold">{formatMoney(s.balanceMinor)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ReceivablesReportPage() {
  const [rows, setRows] = useState<
    Array<{
      id: string;
      name: string;
      phone: string;
      balanceMinor: number;
      aging?: { current: number; d30: number; d60: number; d90: number };
    }>
  >([]);
  const [totalMinor, setTotalMinor] = useState(0);

  useEffect(() => {
    void import("@/lib/domain-api").then(({ fetchReceivables }) =>
      fetchReceivables()
        .then((res) => {
          setRows(res.data.rows);
          setTotalMinor(res.data.totalMinor);
        })
        .catch(() => undefined),
    );
  }, []);

  return (
    <div>
      <PageHeader
        title="Customer receivables"
        description={`Outstanding ${formatMoney(totalMinor)} with aging buckets.`}
      />
      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-surface-subtle text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2 text-right">Current</th>
              <th className="px-3 py-2 text-right">1–30</th>
              <th className="px-3 py-2 text-right">31–60</th>
              <th className="px-3 py-2 text-right">60+</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-ink-muted">{c.phone}</div>
                </td>
                <td className="px-3 py-2 text-right font-bold text-brand">{formatMoney(c.balanceMinor)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(c.aging?.current ?? 0)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(c.aging?.d30 ?? 0)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(c.aging?.d60 ?? 0)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(c.aging?.d90 ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const sections = [
    ["Business profile", "/settings/business"],
    ["Branches", "/settings/branches"],
    ["Registers", "/settings/registers"],
    ["Users & roles", "/settings/users"],
    ["Taxes", "/settings/taxes"],
    ["Receipts", "/settings/receipts"],
    ["Printers & drawer", "/settings/printers"],
    ["Sales & stock rules", "/settings/sales-rules"],
    ["Credit & loyalty", "/settings/credit-loyalty"],
  ] as const;

  return (
    <div>
      <PageHeader title="Settings" description="Tenant configuration." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(([label, to]) => (
          <Link key={to} to={to} className="rounded-lg border border-border bg-white p-4 font-semibold hover:border-brand">
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SettingsSectionPage({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-ink-muted">
            Prototype settings form with realistic controls. Changes are saved locally for demo.
          </p>
          {title === "Credit & loyalty" ? (
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked /> Enable customer credit
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked /> Enable store credit
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked /> Enable loyalty points
              </label>
            </div>
          ) : title === "Sales & stock rules" ? (
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" /> Allow negative stock
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked /> Require manager approval for returns
              </label>
            </div>
          ) : title === "Business profile" ? (
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="" className="h-16 w-16 object-contain" />
              <Badge>Logo from Master Solutions</Badge>
            </div>
          ) : null}
          <Button onClick={() => toast.success(`${title} saved`)}>Save changes</Button>
        </CardContent>
      </Card>
    </div>
  );
}
