import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@mms/shared";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DASHBOARD_TREND, PRODUCTS, SALES, SUPPLIERS, CUSTOMERS } from "@/mocks/data";
import { useAuthStore } from "@/stores/auth-store";

export function DashboardPage() {
  const canSeeProfit = useAuthStore((s) => s.hasPermission("reports.profit"));
  const lowStock = PRODUCTS.filter((p) => p.stock <= p.reorderLevel).length;
  const receivable = CUSTOMERS.reduce((s, c) => s + c.balanceMinor, 0);
  const payable = SUPPLIERS.reduce((s, c) => s + c.balanceMinor, 0);
  const todaySales = SALES.filter((s) => new Date(s.soldAt).toDateString() === new Date().toDateString()).reduce(
    (s, x) => s + x.totalMinor,
    0,
  );

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Today's performance across your active branch."
        actions={
          <Button asChild>
            <Link to="/pos">Open POS</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Today's sales" value={formatMoney(todaySales)} />
        {canSeeProfit ? <Kpi title="Today's profit" value={formatMoney(Math.round(todaySales * 0.18))} /> : null}
        <Kpi title="Orders" value={String(SALES.length)} />
        <Kpi title="Avg order" value={formatMoney(Math.round(todaySales / Math.max(1, SALES.length)))} />
        <Kpi title="Low stock" value={String(lowStock)} tone="warning" />
        <Kpi title="Customer credit" value={formatMoney(receivable)} />
        <Kpi title="Supplier payables" value={formatMoney(payable)} />
        <Kpi title="Open registers" value="2" tone="success" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Sales trend (7 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={DASHBOARD_TREND}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E00818" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#E00818" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="day" />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => formatMoney(v * 100)} />
                <Area type="monotone" dataKey="sales" stroke="#E00818" fill="url(#salesFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {PRODUCTS.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-ink-muted">{p.sku}</div>
                </div>
                <Badge variant={p.stock === 0 ? "danger" : p.stock <= p.reorderLevel ? "warning" : "muted"}>
                  {p.stock} {p.unit}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-ink-muted">
              <tr>
                <th className="py-2">Receipt</th>
                <th>Cashier</th>
                <th>Customer</th>
                <th>Status</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {SALES.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-2 font-mono text-xs">{s.receiptNo}</td>
                  <td>{s.cashierName}</td>
                  <td>{s.customerName}</td>
                  <td>
                    <Badge variant={s.paymentStatus === "paid" ? "success" : "warning"}>
                      {s.paymentStatus}
                    </Badge>
                  </td>
                  <td className="text-right font-semibold">{formatMoney(s.totalMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone?: "warning" | "success";
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</div>
        <div
          className={`mt-1 text-2xl font-extrabold ${
            tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-ink"
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
