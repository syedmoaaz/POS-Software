import { apiFetch } from "@/lib/api";

const BRIDGE_URL_KEY = "mms-bridge-url";
const BRIDGE_TOKEN_KEY = "mms-bridge-token";

export function getBridgeConfig() {
  return {
    url: localStorage.getItem(BRIDGE_URL_KEY) || "http://127.0.0.1:9100",
    token: localStorage.getItem(BRIDGE_TOKEN_KEY) || "mms-dev-bridge-token",
  };
}

export function setBridgeConfig(input: { url?: string; token?: string }) {
  if (input.url !== undefined) localStorage.setItem(BRIDGE_URL_KEY, input.url.replace(/\/$/, ""));
  if (input.token !== undefined) localStorage.setItem(BRIDGE_TOKEN_KEY, input.token);
}

async function bridgeFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}) {
  const { url, token } = getBridgeConfig();
  const headers = new Headers(init.headers);
  headers.set("X-Bridge-Token", token);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  const res = await fetch(`${url}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

export async function pingBridge() {
  const { url } = getBridgeConfig();
  const res = await fetch(`${url}/health`);
  return res.json();
}

export async function bridgeStatus() {
  return bridgeFetch<{ data: unknown }>("/status");
}

export async function bridgeTestPrint(paperWidthMm: 58 | 80 = 80) {
  return bridgeFetch<{ data: { id: string; status: string; error?: string } }>("/test", {
    method: "POST",
    json: { paperWidthMm },
  });
}

export async function bridgeOpenDrawer() {
  return bridgeFetch<{ data: { id: string; status: string } }>("/drawer/open", { method: "POST" });
}

export async function bridgePrintReceipt(payload: Record<string, unknown>, paperWidthMm: 58 | 80 = 80) {
  return bridgeFetch<{ data: { id: string; status: string; error?: string } }>("/print", {
    method: "POST",
    json: { type: "receipt", paperWidthMm, payload },
  });
}

/** Create cloud print job, send to local bridge, report status back. */
export async function printViaBridge(input: {
  branchId: string;
  deviceId?: string;
  type: "receipt" | "label" | "test" | "drawer_kick";
  payload?: Record<string, unknown>;
  paperWidthMm?: 58 | 80;
}) {
  const created = await apiFetch<{
    data: {
      job: { id: string };
      device: { connection: { bridgeUrl?: string; paperWidthMm?: number } };
    };
  }>("/print-jobs", {
    method: "POST",
    json: {
      branchId: input.branchId,
      deviceId: input.deviceId,
      type: input.type,
      payload: input.payload ?? {},
    },
  });

  if (!created.ok) {
    throw new Error(
      (created.data as { error?: { message?: string } })?.error?.message ?? "Could not create print job",
    );
  }

  const jobId = created.data.data.job.id;
  const width =
    input.paperWidthMm ??
    ((created.data.data.device.connection.paperWidthMm === 58 ? 58 : 80) as 58 | 80);

  let bridgeResult: { ok: boolean; data: { data?: { id?: string; status?: string; error?: string } } };
  try {
    if (input.type === "drawer_kick") {
      bridgeResult = await bridgeOpenDrawer();
    } else if (input.type === "test") {
      bridgeResult = await bridgeTestPrint(width);
    } else {
      bridgeResult = await bridgePrintReceipt(input.payload ?? {}, width);
    }
  } catch (err) {
    await apiFetch(`/print-jobs/${jobId}/status`, {
      method: "POST",
      json: {
        status: "failed",
        error: err instanceof Error ? err.message : "Bridge unreachable",
      },
    });
    throw err;
  }

  const bridgeJobId = bridgeResult.data.data?.id;
  const failed = !bridgeResult.ok || bridgeResult.data.data?.status === "failed";
  await apiFetch(`/print-jobs/${jobId}/status`, {
    method: "POST",
    json: {
      status: failed ? "failed" : "done",
      bridgeJobId,
      error: failed ? bridgeResult.data.data?.error || "Bridge print failed" : undefined,
    },
  });

  if (failed) {
    throw new Error(bridgeResult.data.data?.error || "Bridge print failed");
  }

  return { jobId, bridgeJobId };
}
