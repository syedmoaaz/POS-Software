/**
 * Lightweight checkout load pass against a running seeded API.
 * Usage: node scripts/checkout-load.mjs
 * Env: API_URL, CONCURRENCY, ITERATIONS
 */
const API = process.env.API_URL ?? "http://localhost:4000/api/v1";
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 5);
const ITERATIONS = Number(process.env.ITERATIONS ?? 20);

function mergeCookies(prev, setCookie) {
  const map = new Map();
  for (const part of (prev || "").split(";").map((s) => s.trim()).filter(Boolean)) {
    const i = part.indexOf("=");
    if (i > 0) map.set(part.slice(0, i), part.slice(i + 1));
  }
  for (const c of setCookie ?? []) {
    const first = c.split(";")[0];
    const i = first.indexOf("=");
    if (i > 0) map.set(first.slice(0, i), first.slice(i + 1));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function api(path, { method = "GET", body, cookie, headers = {} } = {}) {
  const h = { "Content-Type": "application/json", ...headers };
  if (cookie) h.Cookie = cookie;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, setCookie };
}

async function prepare() {
  let cookie = "";
  const login = await api("/auth/login", {
    method: "POST",
    body: { email: "owner@karachimart.demo", password: "demo1234" },
  });
  if (login.status !== 200) throw new Error(`login failed: ${login.status}`);
  cookie = mergeCookies(cookie, login.setCookie);

  const ctx = await api("/context", { cookie });
  const branchId = ctx.json.data.branches[0].id;
  const registerId = ctx.json.data.registers[0].id;

  let session = await api(`/register-sessions/current?registerId=${registerId}`, { cookie });
  if (!session.json.data?.id) {
    session = await api("/register-sessions/open", {
      method: "POST",
      cookie,
      body: { registerId, openingCashMinor: 500000 },
    });
  }

  const products = await api("/products", { cookie });
  const variant = products.json.data[0].variants[0];
  return {
    cookie,
    branchId,
    registerId,
    variantId: variant.id,
    price: variant.retailPriceMinor,
  };
}

async function oneCheckout(ctx, i) {
  const started = performance.now();
  const r = await api("/sales/checkout", {
    method: "POST",
    cookie: ctx.cookie,
    headers: {
      "Idempotency-Key": `load-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    },
    body: {
      branchId: ctx.branchId,
      registerId: ctx.registerId,
      items: [{ variantId: ctx.variantId, qty: 1 }],
      payments: [{ method: "cash", amountMinor: ctx.price }],
    },
  });
  return { ok: r.status === 201 || r.status === 200, status: r.status, ms: performance.now() - started };
}

const ctx = await prepare();
const results = [];
for (let i = 0; i < ITERATIONS; i += CONCURRENCY) {
  const batch = [];
  for (let j = 0; j < CONCURRENCY && i + j < ITERATIONS; j++) {
    batch.push(oneCheckout(ctx, i + j));
  }
  results.push(...(await Promise.all(batch)));
}

const ok = results.filter((r) => r.ok).length;
const times = results.map((r) => r.ms).sort((a, b) => a - b);
const p50 = times[Math.floor(times.length * 0.5)] ?? 0;
const p95 = times[Math.floor(times.length * 0.95)] ?? 0;
const avg = times.reduce((s, n) => s + n, 0) / (times.length || 1);

console.log(
  JSON.stringify(
    {
      iterations: ITERATIONS,
      concurrency: CONCURRENCY,
      ok,
      failed: ITERATIONS - ok,
      avgMs: Math.round(avg),
      p50Ms: Math.round(p50),
      p95Ms: Math.round(p95),
    },
    null,
    2,
  ),
);

if (ok < ITERATIONS) process.exit(1);
