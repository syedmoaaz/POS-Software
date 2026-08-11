import { NavLink } from "react-router-dom";
import { ChevronDown, Menu } from "lucide-react";
import { useState } from "react";
import { TENANT_NAV, type NavItem } from "@/app/nav";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function NavGroup({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(true);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  if (item.permission && !hasPermission(item.permission)) return null;

  const Icon = item.icon;
  const children = item.children?.filter(
    (c) => !c.permission || hasPermission(c.permission),
  );

  if (!children?.length) {
    return (
      <NavLink
        to={item.to}
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
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-subtle"
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="ml-4 space-y-0.5 border-l border-border pl-2">
          {children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              end={child.to === item.to}
              className={({ isActive }) =>
                cn(
                  "block rounded-md px-3 py-1.5 text-sm text-ink-muted hover:bg-brand-muted hover:text-brand",
                  isActive && "bg-brand-muted font-semibold text-brand",
                )
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-white transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-border px-4">
          <img src="/logo.jpeg" alt="Mega Modern Solutions" className="h-10 w-10 object-contain" />
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold tracking-wide text-brand">MEGA MODERN</div>
            <div className="truncate text-[10px] font-semibold tracking-[0.18em] text-ink-muted">
              SOLUTIONS POS
            </div>
          </div>
        </div>
        <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto p-3">
          {TENANT_NAV.map((item) => (
            <NavGroup key={item.to + item.label} item={item} />
          ))}
        </nav>
      </aside>
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-ink/30 lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
    </>
  );
}

export function SidebarToggle() {
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  return (
    <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden">
      <Menu className="h-5 w-5" />
    </Button>
  );
}
