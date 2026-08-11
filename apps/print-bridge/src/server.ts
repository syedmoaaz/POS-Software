import express from "express";
import cors from "cors";
import { z } from "zod";
import { buildDrawerKick, buildReceipt, buildTestPage, type ReceiptPayload } from "./escpos.js";
import { createJob, getJob, listJobs, updateJob } from "./jobs.js";
import { sendBytes } from "./printer.js";

const PORT = Number(process.env.BRIDGE_PORT ?? 9100);
const TOKEN = process.env.BRIDGE_TOKEN ?? "mms-dev-bridge-token";
const DEFAULT_MODE = (process.env.BRIDGE_MODE ?? "simulate") as "simulate" | "network";
const PRINTER_HOST = process.env.PRINTER_HOST ?? "";
const PRINTER_PORT = Number(process.env.PRINTER_PORT ?? 9100);

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.get("x-bridge-token") || req.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!header || header !== TOKEN) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid bridge token" } });
    return;
  }
  next();
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "mms-print-bridge",
    mode: DEFAULT_MODE,
    paperWidths: [58, 80],
    time: new Date().toISOString(),
  });
});

app.get("/status", auth, (_req, res) => {
  res.json({
    data: {
      online: true,
      mode: DEFAULT_MODE,
      printerHost: PRINTER_HOST || null,
      printerPort: PRINTER_HOST ? PRINTER_PORT : null,
      tokenConfigured: Boolean(TOKEN),
      recentJobs: listJobs(10),
    },
  });
});

app.get("/jobs", auth, (_req, res) => {
  res.json({ data: listJobs(50) });
});

app.get("/jobs/:id", auth, (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Job not found" } });
    return;
  }
  res.json({ data: job });
});

async function runJob(input: {
  type: "receipt" | "label" | "test" | "drawer_kick";
  payload?: ReceiptPayload;
  paperWidthMm?: 58 | 80;
}) {
  const paperWidthMm = input.paperWidthMm ?? input.payload?.paperWidthMm ?? 80;
  let buf: Buffer;
  if (input.type === "drawer_kick") buf = buildDrawerKick();
  else if (input.type === "test") buf = buildTestPage(paperWidthMm);
  else buf = buildReceipt({ ...input.payload, paperWidthMm });

  const job = createJob({
    type: input.type,
    bytes: buf.length,
    paperWidthMm,
    mode: DEFAULT_MODE,
    status: "printing",
  });

  try {
    const result = await sendBytes(buf, {
      mode: DEFAULT_MODE,
      host: PRINTER_HOST || undefined,
      port: PRINTER_PORT,
    });
    return updateJob(job.id, {
      status: "done",
      completedAt: new Date().toISOString(),
      mode: result.mode,
      error: result.path ? `simulated:${result.path}` : undefined,
    });
  } catch (err) {
    return updateJob(job.id, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : "Print failed",
    });
  }
}

app.post("/print", auth, async (req, res) => {
  const schema = z.object({
    type: z.enum(["receipt", "label", "test"]).default("receipt"),
    paperWidthMm: z.union([z.literal(58), z.literal(80)]).optional(),
    payload: z.record(z.unknown()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "INVALID_BODY", message: parsed.error.message } });
    return;
  }

  const job = await runJob({
    type: parsed.data.type,
    paperWidthMm: parsed.data.paperWidthMm,
    payload: (parsed.data.payload ?? {}) as ReceiptPayload,
  });
  res.status(job?.status === "failed" ? 502 : 201).json({ data: job });
});

app.post("/test", auth, async (req, res) => {
  const paperWidthMm = req.body?.paperWidthMm === 58 ? 58 : 80;
  const job = await runJob({ type: "test", paperWidthMm });
  res.status(job?.status === "failed" ? 502 : 201).json({ data: job });
});

app.post("/drawer/open", auth, async (_req, res) => {
  const job = await runJob({ type: "drawer_kick" });
  res.status(job?.status === "failed" ? 502 : 201).json({ data: job });
});

app.listen(PORT, "127.0.0.1", () => {
  // eslint-disable-next-line no-console
  console.log(`[print-bridge] listening on http://127.0.0.1:${PORT} mode=${DEFAULT_MODE}`);
  // eslint-disable-next-line no-console
  console.log(`[print-bridge] token=${TOKEN}`);
});
