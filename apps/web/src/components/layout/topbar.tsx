import { Bell, Search, Wifi, WifiOff, LogOut, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BRANCHES, REGISTERS } from "@/mocks/data";
import { useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { useUiStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { SidebarToggle } from "@/components/layout/sidebar";
import { toast } from "sonner";

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const switchRole = useAuthStore((s) => s.switchRole);
  const branchId = useBranchStore((s) => s.branchId);
  const registerId = useBranchStore((s) => s.registerId);
  const setBranchId = useBranchStore((s) => s.setBranchId);
  const setRegisterId = useBranchStore((s) => s.setRegisterId);
  const online = useUiStore((s) => s.online);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const navigate = useNavigate();

  const registers = REGISTERS.filter((r) => r.branchId === branchId);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-white/95 px-3 backdrop-blur md:px-4">
      <SidebarToggle />
      <div className="hidden items-center gap-2 md:flex">
        <select
          className="h-9 rounded-md border border-border bg-white px-2 text-sm font-medium"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
        >
          {BRANCHES.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-border bg-white px-2 text-sm"
          value={registerId}
          onChange={(e) => setRegisterId(e.target.value)}
        >
          {registers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <Button
        variant="outline"
        className="ml-auto hidden max-w-md flex-1 justify-start gap-2 text-ink-muted sm:flex"
        onClick={() => setCommandOpen(true)}
      >
        <Search className="h-4 w-4" />
        Search or jump to…
        <kbd className="ml-auto rounded border border-border px-1.5 text-[10px]">Ctrl K</kbd>
      </Button>

      <div
        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
          online ? "bg-green-50 text-success" : "bg-brand-muted text-brand"
        }`}
      >
        {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        {online ? "Online" : "Offline"}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => toast.message("3 low-stock alerts", { description: "Olper's Milk, Coca-Cola, Bread" })}
      >
        <Bell className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
        <UserRound className="h-4 w-4 text-brand" />
        <div className="hidden leading-tight sm:block">
          <div className="text-xs font-bold">{user?.name}</div>
          <select
            className="bg-transparent text-[10px] uppercase tracking-wide text-ink-muted"
            value={user?.role}
            onChange={(e) => switchRole(e.target.value as never)}
            title="Demo role switcher"
          >
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="cashier">Cashier</option>
            <option value="inventory">Inventory</option>
          </select>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
