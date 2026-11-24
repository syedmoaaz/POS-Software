import { useEffect, useState } from "react";
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
import { fetchDashboard } from "@/lib/domain-api";
import { useAuthStore } from "@/stores/auth-store";

export function DashboardPage() {
  const canSeeProfit = useAuthStore((s) => s.hasPermission("reports.profit"));
  const tenant = useAuthStore((s) => s.tenant);
  const [data, setData] = useState<{
    todaySalesMinor: number;
    todaySalesCount: number;
    todayProfitMinor: number | null;
    lowStockCount: number;
    receivableMinor: number;
    payableMinor: number;
    openRegisterSessions: number;
    salesTrend: Array<{ day: string; salesMinor: number }>;
  } | null>(null);

  useEffect(() => {
    void fetchDashboard()
      .then((res) => {
        const d = res.data as never as {
          todaySalesMinor?: number;
          todaySalesCount?: number;
          todayProfitMinor?: number | null;
          lowStockCount?: number;
          receivableMinor?: number;
          payableMinor?: number;
          openRegisterSessions?: number;
          salesTrend?: Array<{ day: string; salesMinor: number }>;
        };
        setData({
          todaySalesMinor: d.todaySalesMinor ?? 0,
          todaySalesCount: d.todaySalesCount ?? 0,
          todayProfitMinor: d.todayProfitMinor ?? null,
          lowStockCount: d.lowStockCount ?? 0,
          receivableMinor: d.receivableMinor ?? 0,
          payableMinor: d.payableMinor ?? 0,
          openRegisterSessions: d.openRegisterSessions ?? 0,
          salesTrend: d.salesTrend ?? [],
        });
      })
      .catch(() => setData(null));
  }, []);

  const todaySales = data?.todaySalesMinor ?? 0;
  const orders = data?.todaySalesCount ?? 0;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={
          tenant
            ? `${tenant.name} — your data is isolated to this business.`
            : "Today's performance across your active branch."
        }
        actions={
          <Button asChild>
            <Link to="/pos">Open POS</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Today's sales" value={formatMoney(todaySales)} />
        {canSeeProfit && data?.todayProfitMinor != null ? (
          <Kpi title="Today's profit" value={formatMoney(data.todayProfitMinor)} />
        ) : null}
        <Kpi title="Orders" value={String(orders)} />
        <Kpi title="Avg order" value={formatMoney(Math.round(todaySales / Math.max(1, orders)))} />
        <Kpi title="Low stock" value={String(data?.lowStockCount ?? 0)} tone="warning" />
        <Kpi title="Customer credit" value={formatMoney(data?.receivableMinor ?? 0)} />
        <Kpi title="Supplier payables" value={formatMoney(data?.payableMinor ?? 0)} />
        <Kpi title="Open registers" value={String(data?.openRegisterSessions ?? 0)} tone="success" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Sales trend (7 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={(data?.salesTrend ?? []).map((t) => ({
                  day: t.day.slice(5),
                  sales: Math.round(t.salesMinor / 100),
                }))}
              >
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E00818" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#E00818" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="day" />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(v: number) => formatMoney(v * 100)} />
                <Area type="monotone" dataKey="sales" stroke="#E00818" fill="url(#salesFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Link className="block font-semibold text-brand hover:underline" to="/inventory/alerts">
              Low stock alerts
            </Link>
            <Link className="block font-semibold text-brand hover:underline" to="/reports/receivables">
              Customer receivables
            </Link>
            <Link className="block font-semibold text-brand hover:underline" to="/products/new">
              Add product / variants
            </Link>
            <Link className="block font-semibold text-brand hover:underline" to="/labels">
              Print barcode labels
            </Link>
            <p className="pt-2 text-xs text-ink-muted">
              Cloud MongoDB keeps stock movements and sales per tenant. Use strong passwords and role
              permissions for staff.
            </p>
          </CardContent>
        </Card>
      </div>
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
            tone === "warning" ? "text-amber-600" : tone === "success" ? "text-success" : "text-ink"
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
