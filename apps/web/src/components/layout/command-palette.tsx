import { useEffect, useMemo, useState } from "react";
import { useUiStore } from "@/stores/ui-store";
import { TENANT_NAV } from "@/app/nav";
import { PRODUCTS } from "@/mocks/data";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function CommandPalette({ onNavigate }: { onNavigate: (to: string) => void }) {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const pages = useMemo(() => {
    const flat = TENANT_NAV.flatMap((n) =>
      n.children?.length
        ? n.children.map((c) => ({ label: `${n.label} → ${c.label}`, to: c.to }))
        : [{ label: n.label, to: n.to }],
    );
    return flat.filter((p) => p.label.toLowerCase().includes(q.toLowerCase()));
  }, [q]);

  const products = useMemo(
    () =>
      PRODUCTS.filter(
        (p) =>
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          p.sku.toLowerCase().includes(q.toLowerCase()) ||
          p.barcode.includes(q),
      ).slice(0, 6),
    [q],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl gap-2 p-0 overflow-hidden">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-sm">Command palette</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-2">
          <Input
            autoFocus
            placeholder="Jump to page or find product…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="max-h-80 overflow-auto px-2 pb-3">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            Pages
          </div>
          {pages.map((p) => (
            <button
              key={p.to}
              type="button"
              className="flex w-full rounded-md px-3 py-2 text-left text-sm hover:bg-brand-muted"
              onClick={() => {
                setOpen(false);
                onNavigate(p.to);
              }}
            >
              {p.label}
            </button>
          ))}
          {q ? (
            <>
              <div className="mt-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                Products
              </div>
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-brand-muted"
                  onClick={() => {
                    setOpen(false);
                    onNavigate("/products");
                  }}
                >
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-ink-muted">
                    {p.sku} · {p.barcode}
                  </span>
                </button>
              ))}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
