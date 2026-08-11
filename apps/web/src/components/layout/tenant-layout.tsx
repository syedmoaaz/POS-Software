import { useEffect } from "react";
import { Outlet, Navigate, useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import { isSuperAdminHost } from "@/lib/host";

export function TenantLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const setOnline = useUiStore((s) => s.setOnline);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const navigate = useNavigate();

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("keydown", onKey);
    };
  }, [setOnline, setCommandOpen]);

  // Super Admin subdomain is platform-only — never show shop POS here.
  if (isSuperAdminHost()) return <Navigate to="/admin" replace />;

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.role === "super_admin") return <Navigate to="/admin" replace />;

  return (
    <div className="flex h-full min-h-screen bg-surface-subtle">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-auto p-3 md:p-5">
          <Outlet />
        </main>
      </div>
      <CommandPalette onNavigate={(to) => navigate(to)} />
    </div>
  );
}
