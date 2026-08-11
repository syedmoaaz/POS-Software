import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatMoney } from "@mms/shared";
import { ADMIN_TENANTS } from "@/mocks/data";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AdminDashboardPage() {
  const active = ADMIN_TENANTS.filter((t) => t.status === "active").length;
  const trials = ADMIN_TENANTS.filter((t) => t.status === "trial").length;
  const suspended = ADMIN_TENANTS.filter((t) => t.status === "suspended").length;
  const mrr = ADMIN_TENANTS.reduce((s, t) => s + t.mrrMinor, 0);

  return (
    <div>
      <PageHeader title="Platform overview" description="Mega Modern Solutions SaaS control plane." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Tenants" value={String(ADMIN_TENANTS.length)} />
        <Metric title="Active" value={String(active)} />
        <Metric title="Trials" value={String(trials)} />
        <Metric title="Suspended" value={String(suspended)} />
        <Metric title="MRR" value={formatMoney(mrr)} />
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Plan distribution</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {["Starter", "Growth", "Enterprise"].map((plan) => (
            <Badge key={plan} variant="muted">
              {plan}: {ADMIN_TENANTS.filter((t) => t.plan === plan).length}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</div>
        <div className="mt-1 text-2xl font-extrabold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function AdminTenantsPage() {
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const rows = useMemo(
    () => ADMIN_TENANTS.filter((t) => t.name.toLowerCase().includes(q.toLowerCase())),
    [q],
  );

  return (
    <div>
      <PageHeader
        title="Tenants"
        actions={<Button onClick={() => setCreateOpen(true)}>Create tenant</Button>}
      />
      <Input className="mb-3 max-w-md" placeholder="Search tenants…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-surface-subtle text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-3 py-2">Business</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Branches</th>
              <th className="px-3 py-2">MRR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <Link className="font-semibold text-brand hover:underline" to={`/admin/tenants/${t.id}`}>
                    {t.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{t.plan}</td>
                <td className="px-3 py-2">
                  <Badge
                    variant={
                      t.status === "active" ? "success" : t.status === "trial" ? "warning" : "danger"
                    }
                  >
                    {t.status}
                  </Badge>
                </td>
                <td className="px-3 py-2">{t.branches}</td>
                <td className="px-3 py-2 font-semibold">{formatMoney(t.mrrMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create tenant</DialogTitle>
            <DialogDescription>Provision a new business workspace.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Business name" />
          <Input placeholder="Owner email" />
          <Button
            onClick={() => {
              toast.success("Tenant created (mock)");
              setCreateOpen(false);
            }}
          >
            Create
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdminTenantDetailPage() {
  const tenant = ADMIN_TENANTS[0];
  return (
    <div>
      <PageHeader
        title={tenant.name}
        description={`${tenant.plan} · ${tenant.status}`}
        actions={
          <>
            <Button variant="outline" onClick={() => toast.message("Trial extended 7 days")}>
              Extend trial
            </Button>
            <Button variant="outline" onClick={() => toast.warning("Tenant suspended")}>
              Suspend
            </Button>
            <Button
              onClick={() =>
                toast.message("Impersonation started", {
                  description: "Audited mock session — expires in 15 minutes",
                })
              }
            >
              Impersonate
            </Button>
          </>
        }
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Plan: {tenant.plan}</div>
            <div>MRR: {formatMoney(tenant.mrrMinor)}</div>
            <div>Users: {tenant.users}</div>
            <div>Branches: {tenant.branches}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Internal notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <textarea
              className="min-h-28 w-full rounded-md border border-border p-2 text-sm"
              defaultValue="Demo tenant for sales demos and QA."
            />
            <Button onClick={() => toast.success("Notes saved")}>Save notes</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function AdminPlansPage() {
  const plans = [
    { name: "Starter", price: 500000, limits: "1 branch · 3 users · 1k products" },
    { name: "Growth", price: 1500000, limits: "3 branches · 15 users · 10k products" },
    { name: "Enterprise", price: 4500000, limits: "Unlimited · SSO · custom SLA" },
  ];
  return (
    <div>
      <PageHeader title="Subscription plans" />
      <div className="grid gap-3 lg:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.name}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold text-brand">{formatMoney(p.price)}/mo</div>
              <p className="mt-2 text-sm text-ink-muted">{p.limits}</p>
              <Button className="mt-4" variant="outline" onClick={() => toast.success("Plan updated")}>
                Edit
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function AdminSubscriptionsPage() {
  return (
    <div>
      <PageHeader title="Subscriptions" />
      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-left">Tenant</th>
              <th className="px-3 py-2 text-left">Plan</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">MRR</th>
            </tr>
          </thead>
          <tbody>
            {ADMIN_TENANTS.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-3 py-2">{t.name}</td>
                <td className="px-3 py-2">{t.plan}</td>
                <td className="px-3 py-2">
                  <Badge variant={t.status === "active" ? "success" : "warning"}>{t.status}</Badge>
                </td>
                <td className="px-3 py-2 text-right">{formatMoney(t.mrrMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminAuditPage() {
  const logs = [
    ["impersonate.start", "Platform Admin", "Karachi Mart Demo"],
    ["tenant.suspend", "Platform Admin", "Islamabad Grocers"],
    ["plan.update", "Platform Admin", "Growth pricing"],
    ["tenant.create", "Platform Admin", "Lahore Fresh Foods"],
  ];
  return (
    <div>
      <PageHeader title="Platform audit logs" />
      <div className="space-y-2">
        {logs.map(([action, actor, target], i) => (
          <Card key={i}>
            <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-4 text-sm">
              <div>
                <div className="font-semibold">{action}</div>
                <div className="text-ink-muted">
                  {actor} → {target}
                </div>
              </div>
              <Badge variant="muted">Audited</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function AdminHealthPage() {
  return (
    <div>
      <PageHeader title="System health" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["API", "Healthy"],
          ["Database", "Healthy"],
          ["Object storage", "Healthy"],
          ["Queue workers", "Degraded"],
          ["Print bridge samples", "Healthy"],
        ].map(([name, status]) => (
          <Card key={name}>
            <CardContent className="pt-4">
              <div className="text-sm font-semibold">{name}</div>
              <Badge className="mt-2" variant={status === "Healthy" ? "success" : "warning"}>
                {status}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
