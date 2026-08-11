import mongoose from "mongoose";
import { z } from "zod";
import { AppError } from "../../lib/errors.js";

export const reportRangeQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  branchId: z.string().optional(),
});

export type ReportRangeQuery = z.infer<typeof reportRangeQuery>;

export function oid(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(400, "Invalid id", "INVALID_ID");
  }
  return new mongoose.Types.ObjectId(id);
}

export function parseDateRange(query: { from?: string; to?: string }) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new AppError(400, "Invalid date range", "INVALID_DATE");
  }
  if (from > to) {
    throw new AppError(400, "`from` must be before `to`", "INVALID_DATE");
  }
  return { from, to };
}

export function saleMatch(tenantId: string, range: { from: Date; to: Date }, branchId?: string) {
  const match: Record<string, unknown> = {
    tenantId: oid(tenantId),
    deletedAt: null,
    status: { $ne: "void" },
    soldAt: { $gte: range.from, $lte: range.to },
  };
  if (branchId) match.branchId = oid(branchId);
  return match;
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
