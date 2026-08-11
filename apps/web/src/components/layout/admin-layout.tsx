import { NavLink, Outlet, Navigate } from "react-router-dom";
import { ADMIN_NAV } from "@/app/nav";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isSuperAdminHost } from "@/lib/host";

export function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.role !== "super_admin") {
    return <Navigate to={isSuperAdminHost() ? "/login" : "/dashboard"} replace />;
  }

  return (
    <div className="flex min-h-screen bg-surface-subtle">
      <aside className="flex w-64 flex-col border-r border-border bg-white">
        <div className="flex h-16 items-center gap-3 border-b border-border px-4">
          <img src="/logo.jpeg" alt="Mega Modern Solutions" className="h-10 w-10 object-contain" />
          <div>
            <div className="text-sm font-extrabold text-brand">MEGA MODERN</div>
            <div className="text-[10px] font-semibold tracking-widest text-ink-muted">SUPER ADMIN</div>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/admin"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-ink-muted hover:bg-brand-muted hover:text-brand",
                    isActive && "bg-brand-muted text-brand",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-border p-3">
          <div className="mb-2 text-xs text-ink-muted">{user.email}</div>
          <Button variant="outline" className="w-full" onClick={logout}>
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-5">
        <Outlet />
      </main>
    </div>
  );
}
