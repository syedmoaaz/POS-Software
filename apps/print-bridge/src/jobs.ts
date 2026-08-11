export type BridgeJob = {
  id: string;
  type: "receipt" | "label" | "test" | "drawer_kick";
  status: "queued" | "printing" | "done" | "failed";
  createdAt: string;
  completedAt?: string;
  error?: string;
  bytes: number;
  paperWidthMm?: 58 | 80;
  mode: "simulate" | "network";
};

const jobs = new Map<string, BridgeJob>();

export function createJob(partial: Omit<BridgeJob, "id" | "createdAt" | "status"> & { status?: BridgeJob["status"] }) {
  const id = `bj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const job: BridgeJob = {
    id,
    createdAt: new Date().toISOString(),
    status: partial.status ?? "queued",
    type: partial.type,
    bytes: partial.bytes,
    paperWidthMm: partial.paperWidthMm,
    mode: partial.mode,
    error: partial.error,
    completedAt: partial.completedAt,
  };
  jobs.set(id, job);
  return job;
}

export function updateJob(id: string, patch: Partial<BridgeJob>) {
  const cur = jobs.get(id);
  if (!cur) return null;
  const next = { ...cur, ...patch };
  jobs.set(id, next);
  return next;
}

export function getJob(id: string) {
  return jobs.get(id) ?? null;
}

export function listJobs(limit = 50) {
  return [...jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
