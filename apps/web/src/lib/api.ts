const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000";

export type ApiErrorBody = {
  error?: { code?: string; message?: string; details?: unknown };
};

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function clearLocalAuth() {
  try {
    const raw = localStorage.getItem("mms-auth");
    if (!raw) return;
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    if (parsed?.state) {
      parsed.state.user = null;
      parsed.state.tenant = null;
      parsed.state.branches = [];
      parsed.state.registers = [];
      parsed.state.isAuthenticated = false;
      localStorage.setItem("mms-auth", JSON.stringify(parsed));
    }
  } catch {
    localStorage.removeItem("mms-auth");
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown; _retried?: boolean } = {},
): Promise<{ ok: boolean; status: number; data: T; raw: Response }> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  const text = await res.text();
  let data = {} as T;
  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    data = { raw: text } as T;
  }

  const isAuthPath = path.startsWith("/auth/login") || path.startsWith("/auth/refresh");
  if (res.status === 401 && !init._retried && !isAuthPath) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return apiFetch<T>(path, { ...init, _retried: true });
    }
    clearLocalAuth();
  }

  return { ok: res.ok, status: res.status, data, raw: res };
}

/** Fetch that throws ApiError on non-2xx. */
export async function apiJson<T>(
  path: string,
  init: RequestInit & { json?: unknown; _retried?: boolean } = {},
): Promise<T> {
  const res = await apiFetch<T & ApiErrorBody>(path, init);
  if (!res.ok) {
    const body = res.data as ApiErrorBody;
    if (res.status === 401) {
      throw new ApiError(
        401,
        "Session expired — please sign in again",
        body.error?.code || "UNAUTHENTICATED",
        body.error?.details,
      );
    }
    throw new ApiError(
      res.status,
      body.error?.message || `Request failed (${res.status})`,
      body.error?.code,
      body.error?.details,
    );
  }
  return res.data as T;
}

export function apiBase() {
  return API_BASE;
}

export function moneyFromInput(value: string | number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
