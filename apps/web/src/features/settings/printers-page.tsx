import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBranchStore } from "@/stores/branch-store";
import {
  bridgeOpenDrawer,
  bridgeStatus,
  bridgeTestPrint,
  getBridgeConfig,
  pingBridge,
  printViaBridge,
  setBridgeConfig,
} from "@/lib/print-bridge";

export function PrintersSettingsPage() {
  const branchId = useBranchStore((s) => s.branchId);
  const cfg = getBridgeConfig();
  const [url, setUrl] = useState(cfg.url);
  const [token, setToken] = useState(cfg.token);
  const [paperWidthMm, setPaperWidthMm] = useState<58 | 80>(80);
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);
  const [bridgeMode, setBridgeMode] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const refreshBridge = async () => {
    try {
      const health = await pingBridge();
      setBridgeOnline(Boolean(health?.ok));
      const status = await bridgeStatus();
      if (status.ok) {
        const mode = (status.data as { data?: { mode?: string } }).data?.mode;
        setBridgeMode(mode ?? "");
      }
    } catch {
      setBridgeOnline(false);
      setBridgeMode("");
    }
  };

  useEffect(() => {
    void refreshBridge();
  }, []);

  return (
    <div>
      <PageHeader
        title="Printers & drawer"
        description="Local print bridge drives ESC/POS printers (58/80mm) and cash drawers."
        actions={
          <Button variant="outline" onClick={() => void refreshBridge()}>
            Refresh bridge
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Local bridge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              Status:{" "}
              {bridgeOnline == null ? (
                <Badge variant="muted">Checking…</Badge>
              ) : bridgeOnline ? (
                <Badge variant="success">Online {bridgeMode ? `(${bridgeMode})` : ""}</Badge>
              ) : (
                <Badge variant="danger">Offline</Badge>
              )}
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-ink-muted">Bridge URL</div>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-ink-muted">Pairing token</div>
              <Input value={token} onChange={(e) => setToken(e.target.value)} />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-ink-muted">Paper width</div>
              <select
                className="h-10 w-full rounded-md border border-border px-2 text-sm"
                value={paperWidthMm}
                onChange={(e) => setPaperWidthMm(Number(e.target.value) as 58 | 80)}
              >
                <option value={80}>80 mm</option>
                <option value={58}>58 mm</option>
              </select>
            </div>
            <Button
              onClick={() => {
                setBridgeConfig({ url, token });
                toast.success("Bridge settings saved on this device");
                void refreshBridge();
              }}
            >
              Save bridge settings
            </Button>
            <p className="text-xs text-ink-muted">
              Run <code className="rounded bg-surface-subtle px-1">pnpm --filter @mms/print-bridge dev</code> on the
              store PC. Default token: <code className="rounded bg-surface-subtle px-1">mms-dev-bridge-token</code>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    setBridgeConfig({ url, token });
                    try {
                      await printViaBridge({
                        branchId,
                        type: "test",
                        paperWidthMm,
                        payload: { storeName: "Karachi Mart Demo" },
                      });
                    } catch {
                      const direct = await bridgeTestPrint(paperWidthMm);
                      if (!direct.ok || direct.data.data?.status === "failed") {
                        throw new Error(direct.data.data?.error || "Bridge test failed");
                      }
                    }
                    toast.success(`Test page sent (${paperWidthMm}mm)`);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Test print failed");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              Test print
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    setBridgeConfig({ url, token });
                    try {
                      await printViaBridge({ branchId, type: "drawer_kick" });
                    } catch {
                      const direct = await bridgeOpenDrawer();
                      if (!direct.ok || direct.data.data?.status === "failed") {
                        throw new Error("Drawer open failed");
                      }
                    }
                    toast.success("Drawer kick sent");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Drawer open failed");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              Open cash drawer
            </Button>
            <p className="text-xs text-ink-muted">
              In simulate mode, jobs are written as `.bin` ESC/POS files under the bridge `.output` folder. Use network
              mode for a real TCP printer.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
