import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission, requireTenant } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { AppError } from "../../lib/errors.js";
import { Sale, ReturnModel } from "../../models/sale.model.js";
import { BranchInventory } from "../../models/inventory.model.js";
import { ProductVariant, Product } from "../../models/product.model.js";
import { Purchase } from "../../models/supplier.model.js";
import { Supplier } from "../../models/supplier.model.js";
import { Customer } from "../../models/customer.model.js";
import { Expense, ExpenseCategory } from "../../models/expense.model.js";
import { RegisterSession } from "../../models/register-session.model.js";
import { User } from "../../models/user.model.js";
import { Category } from "../../models/catalogue-meta.model.js";
import {
  endOfDay,
  oid,
  parseDateRange,
  reportRangeQuery,
  saleMatch,
  startOfDay,
  toCsv,
} from "./reports.helpers.js";

export const reportsRouter = Router();
reportsRouter.use(authenticate, requireTenant);

reportsRouter.get(
  "/dashboard",
  requirePermission("reports.sales"),
  validate({ query: reportRangeQuery.partial() }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const branchId = req.query.branchId as string | undefined;
      const now = new Date();
      const todayFrom = startOfDay(now);
      const todayTo = endOfDay(now);
      const weekFrom = startOfDay(new Date(now.getTime() - 6 * 86400000));
      const monthFrom = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));

      const matchBranch = (extra: Record<string, unknown> = {}) => {
        const m: Record<string, unknown> = {
          tenantId: oid(tenantId),
          deletedAt: null,
          status: { $ne: "void" },
          ...extra,
        };
        if (branchId) m.branchId = oid(branchId);
        return m;
      };

      const sumSales = async (from: Date, to: Date) => {
        const [row] = await Sale.aggregate([
          { $match: matchBranch({ soldAt: { $gte: from, $lte: to } }) },
          {
            $group: {
              _id: null,
              totalMinor: { $sum: "$totalMinor" },
              count: { $sum: 1 },
              cogsMinor: {
                $sum: {
                  $reduce: {
                    input: "$items",
                    initialValue: 0,
                    in: {
                      $add: [
                        "$$value",
                        { $multiply: ["$$this.costMinor", "$$this.qty"] },
                      ],
                    },
                  },
                },
              },
            },
          },
        ]);
        return {
          totalMinor: row?.totalMinor ?? 0,
          count: row?.count ?? 0,
          cogsMinor: row?.cogsMinor ?? 0,
        };
      };

      const [today, week, month, trend, lowStock, payables, receivables, openSessions] =
        await Promise.all([
          sumSales(todayFrom, todayTo),
          sumSales(weekFrom, todayTo),
          sumSales(monthFrom, todayTo),
          Sale.aggregate([
            { $match: matchBranch({ soldAt: { $gte: weekFrom, $lte: todayTo } }) },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$soldAt" } },
                salesMinor: { $sum: "$totalMinor" },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ]),
          (async () => {
            const inv = await BranchInventory.find({
              tenantId,
              ...(branchId ? { branchId } : {}),
            }).lean();
            const variants = await ProductVariant.find({
              tenantId,
              _id: { $in: inv.map((i) => i.variantId) },
              deletedAt: null,
            }).lean();
            const byId = new Map(variants.map((v) => [String(v._id), v]));
            return inv.filter((i) => {
              const v = byId.get(String(i.variantId));
              const reorder = v?.reorderLevel ?? 0;
              return i.qtyOnHand <= 0 || (reorder > 0 && i.qtyOnHand <= reorder);
            }).length;
          })(),
          Supplier.aggregate([
            {
              $match: {
                tenantId: oid(tenantId),
                deletedAt: null,
                balanceMinor: { $gt: 0 },
              },
            },
            { $group: { _id: null, totalMinor: { $sum: "$balanceMinor" } } },
          ]),
          Customer.aggregate([
            {
              $match: {
                tenantId: oid(tenantId),
                deletedAt: null,
                balanceMinor: { $gt: 0 },
              },
            },
            { $group: { _id: null, totalMinor: { $sum: "$balanceMinor" } } },
          ]),
          RegisterSession.countDocuments({
            tenantId,
            status: "open",
            ...(branchId ? { branchId } : {}),
          }),
        ]);

      const canProfit = req.auth!.permissions.includes("reports.profit");

      res.json({
        data: {
          range: { todayFrom, todayTo, weekFrom, monthFrom },
          todaySalesMinor: today.totalMinor,
          todaySalesCount: today.count,
          weekSalesMinor: week.totalMinor,
          monthSalesMinor: month.totalMinor,
          todayProfitMinor: canProfit ? today.totalMinor - today.cogsMinor : null,
          lowStockCount: lowStock,
          payableMinor: payables[0]?.totalMinor ?? 0,
          receivableMinor: receivables[0]?.totalMinor ?? 0,
          openRegisterSessions: openSessions,
          salesTrend: trend.map((t) => ({
            day: t._id,
            salesMinor: t.salesMinor,
            count: t.count,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/sales",
  requirePermission("reports.sales"),
  validate({ query: reportRangeQuery }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const range = parseDateRange(req.query as { from?: string; to?: string });
      const branchId = req.query.branchId as string | undefined;
      const match = saleMatch(tenantId, range, branchId);

      const [summary] = await Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            grossMinor: { $sum: "$subtotalMinor" },
            discountMinor: { $sum: "$discountMinor" },
            taxMinor: { $sum: "$taxMinor" },
            totalMinor: { $sum: "$totalMinor" },
          },
        },
      ]);

      const byDay = await Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$soldAt" } },
            totalMinor: { $sum: "$totalMinor" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const rows = await Sale.find(match)
        .sort({ soldAt: -1 })
        .limit(100)
        .select("receiptNo totalMinor soldAt paymentStatus payments customerName cashierId branchId")
        .lean();

      res.json({
        data: {
          range,
          summary: {
            count: summary?.count ?? 0,
            grossMinor: summary?.grossMinor ?? 0,
            discountMinor: summary?.discountMinor ?? 0,
            taxMinor: summary?.taxMinor ?? 0,
            totalMinor: summary?.totalMinor ?? 0,
          },
          byDay: byDay.map((d) => ({
            day: d._id,
            totalMinor: d.totalMinor,
            count: d.count,
          })),
          rows: rows.map((s) => ({
            id: String(s._id),
            receiptNo: s.receiptNo,
            totalMinor: s.totalMinor,
            soldAt: s.soldAt,
            paymentStatus: s.paymentStatus,
            paymentMethods: s.payments.map((p) => p.method),
            customerName: s.customerName,
            cashierId: String(s.cashierId),
            branchId: String(s.branchId),
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/sales-by-product",
  requirePermission("reports.sales"),
  validate({ query: reportRangeQuery }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const range = parseDateRange(req.query as { from?: string; to?: string });
      const match = saleMatch(tenantId, range, req.query.branchId as string | undefined);

      const rows = await Sale.aggregate([
        { $match: match },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.variantId",
            name: { $first: "$items.name" },
            sku: { $first: "$items.sku" },
            qty: { $sum: "$items.qty" },
            revenueMinor: { $sum: "$items.lineTotalMinor" },
          },
        },
        { $sort: { revenueMinor: -1 } },
        { $limit: 100 },
      ]);

      res.json({
        data: rows.map((r) => ({
          variantId: String(r._id),
          name: r.name,
          sku: r.sku,
          qty: r.qty,
          revenueMinor: r.revenueMinor,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/sales-by-category",
  requirePermission("reports.sales"),
  validate({ query: reportRangeQuery }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const range = parseDateRange(req.query as { from?: string; to?: string });
      const match = saleMatch(tenantId, range, req.query.branchId as string | undefined);

      const rows = await Sale.aggregate([
        { $match: match },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$product.categoryId",
            qty: { $sum: "$items.qty" },
            revenueMinor: { $sum: "$items.lineTotalMinor" },
          },
        },
        { $sort: { revenueMinor: -1 } },
      ]);

      const catIds = rows.map((r) => r._id).filter(Boolean);
      const cats = await Category.find({ _id: { $in: catIds } }).lean();
      const catMap = new Map(cats.map((c) => [String(c._id), c.name]));

      res.json({
        data: rows.map((r) => ({
          categoryId: r._id ? String(r._id) : null,
          categoryName: r._id ? (catMap.get(String(r._id)) ?? "Unknown") : "Uncategorized",
          qty: r.qty,
          revenueMinor: r.revenueMinor,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/sales-by-cashier",
  requirePermission("reports.sales"),
  validate({ query: reportRangeQuery }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const range = parseDateRange(req.query as { from?: string; to?: string });
      const match = saleMatch(tenantId, range, req.query.branchId as string | undefined);

      const rows = await Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$cashierId",
            count: { $sum: 1 },
            totalMinor: { $sum: "$totalMinor" },
          },
        },
        { $sort: { totalMinor: -1 } },
      ]);

      const users = await User.find({ _id: { $in: rows.map((r) => r._id) } })
        .select("name email")
        .lean();
      const userMap = new Map(users.map((u) => [String(u._id), u]));

      res.json({
        data: rows.map((r) => ({
          cashierId: String(r._id),
          name: userMap.get(String(r._id))?.name ?? "Unknown",
          email: userMap.get(String(r._id))?.email ?? "",
          count: r.count,
          totalMinor: r.totalMinor,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/payments",
  requirePermission("reports.sales"),
  validate({ query: reportRangeQuery }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const range = parseDateRange(req.query as { from?: string; to?: string });
      const match = saleMatch(tenantId, range, req.query.branchId as string | undefined);

      const rows = await Sale.aggregate([
        { $match: match },
        { $unwind: "$payments" },
        {
          $group: {
            _id: "$payments.method",
            amountMinor: { $sum: "$payments.amountMinor" },
            count: { $sum: 1 },
          },
        },
        { $sort: { amountMinor: -1 } },
      ]);

      res.json({
        data: {
          range,
          byMethod: rows.map((r) => ({
            method: r._id,
            amountMinor: r.amountMinor,
            count: r.count,
          })),
          totalMinor: rows.reduce((s, r) => s + r.amountMinor, 0),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/profit",
  requirePermission("reports.profit"),
  validate({ query: reportRangeQuery }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const range = parseDateRange(req.query as { from?: string; to?: string });
      const match = saleMatch(tenantId, range, req.query.branchId as string | undefined);

      const [summary] = await Sale.aggregate([
        { $match: match },
        { $unwind: "$items" },
        {
          $group: {
            _id: null,
            revenueMinor: { $sum: "$items.lineTotalMinor" },
            cogsMinor: { $sum: { $multiply: ["$items.costMinor", "$items.qty"] } },
            qty: { $sum: "$items.qty" },
          },
        },
      ]);

      const byProduct = await Sale.aggregate([
        { $match: match },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.variantId",
            name: { $first: "$items.name" },
            sku: { $first: "$items.sku" },
            qty: { $sum: "$items.qty" },
            revenueMinor: { $sum: "$items.lineTotalMinor" },
            cogsMinor: { $sum: { $multiply: ["$items.costMinor", "$items.qty"] } },
          },
        },
        {
          $addFields: {
            profitMinor: { $subtract: ["$revenueMinor", "$cogsMinor"] },
          },
        },
        { $sort: { profitMinor: -1 } },
        { $limit: 50 },
      ]);

      const revenueMinor = summary?.revenueMinor ?? 0;
      const cogsMinor = summary?.cogsMinor ?? 0;
      const profitMinor = revenueMinor - cogsMinor;

      res.json({
        data: {
          range,
          summary: {
            revenueMinor,
            cogsMinor,
            profitMinor,
            marginPct: revenueMinor > 0 ? Math.round((profitMinor / revenueMinor) * 10000) / 100 : 0,
            qty: summary?.qty ?? 0,
          },
          byProduct: byProduct.map((r) => ({
            variantId: String(r._id),
            name: r.name,
            sku: r.sku,
            qty: r.qty,
            revenueMinor: r.revenueMinor,
            cogsMinor: r.cogsMinor,
            profitMinor: r.profitMinor,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/inventory/valuation",
  requirePermission("reports.inventory"),
  validate({ query: z.object({ branchId: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const branchId = req.query.branchId as string | undefined;
      const filter: Record<string, unknown> = { tenantId };
      if (branchId) filter.branchId = branchId;

      const inv = await BranchInventory.find(filter).lean();
      const variants = await ProductVariant.find({
        tenantId,
        _id: { $in: inv.map((i) => i.variantId) },
        deletedAt: null,
      }).lean();
      const products = await Product.find({
        tenantId,
        _id: { $in: variants.map((v) => v.productId) },
        deletedAt: null,
      })
        .select("name")
        .lean();
      const vMap = new Map(variants.map((v) => [String(v._id), v]));
      const pMap = new Map(products.map((p) => [String(p._id), p.name]));

      let totalValueMinor = 0;
      const rows = inv.map((i) => {
        const v = vMap.get(String(i.variantId));
        const unitCost = i.avgCostMinor || v?.costMinor || 0;
        const valueMinor = Math.round(i.qtyOnHand * unitCost);
        totalValueMinor += valueMinor;
        return {
          variantId: String(i.variantId),
          branchId: String(i.branchId),
          sku: v?.sku ?? "",
          name: v ? (pMap.get(String(v.productId)) ?? v.name) : "",
          qtyOnHand: i.qtyOnHand,
          unitCostMinor: unitCost,
          valueMinor,
        };
      });

      res.json({
        data: {
          totalValueMinor,
          skuCount: rows.length,
          rows: rows.sort((a, b) => b.valueMinor - a.valueMinor).slice(0, 200),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/inventory/low-stock",
  requirePermission("reports.inventory"),
  validate({ query: z.object({ branchId: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const branchId = req.query.branchId as string | undefined;
      const filter: Record<string, unknown> = { tenantId };
      if (branchId) filter.branchId = branchId;

      const inv = await BranchInventory.find(filter).lean();
      const variants = await ProductVariant.find({
        tenantId,
        _id: { $in: inv.map((i) => i.variantId) },
        deletedAt: null,
      }).lean();
      const vMap = new Map(variants.map((v) => [String(v._id), v]));

      const rows = inv
        .map((i) => {
          const v = vMap.get(String(i.variantId));
          const reorder = v?.reorderLevel ?? 0;
          return {
            variantId: String(i.variantId),
            branchId: String(i.branchId),
            sku: v?.sku ?? "",
            name: v?.name ?? "",
            qtyOnHand: i.qtyOnHand,
            reorderLevel: reorder,
            isOutOfStock: i.qtyOnHand <= 0,
          };
        })
        .filter((r) => r.isOutOfStock || (r.reorderLevel > 0 && r.qtyOnHand <= r.reorderLevel));

      res.json({ data: rows });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/purchases",
  requirePermission("reports.purchases"),
  validate({ query: reportRangeQuery }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const range = parseDateRange(req.query as { from?: string; to?: string });
      const filter: Record<string, unknown> = {
        tenantId,
        deletedAt: null,
        receivedAt: { $gte: range.from, $lte: range.to },
      };
      if (req.query.branchId) filter.branchId = req.query.branchId;

      const [summary] = await Purchase.aggregate([
        {
          $match: {
            tenantId: oid(tenantId),
            deletedAt: null,
            receivedAt: { $gte: range.from, $lte: range.to },
            ...(req.query.branchId ? { branchId: oid(String(req.query.branchId)) } : {}),
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalMinor: { $sum: "$totalMinor" },
            paidMinor: { $sum: "$paidMinor" },
          },
        },
      ]);

      const rows = await Purchase.find(filter).sort({ receivedAt: -1 }).limit(100).lean();

      res.json({
        data: {
          range,
          summary: {
            count: summary?.count ?? 0,
            totalMinor: summary?.totalMinor ?? 0,
            paidMinor: summary?.paidMinor ?? 0,
            unpaidMinor: (summary?.totalMinor ?? 0) - (summary?.paidMinor ?? 0),
          },
          rows: rows.map((p) => ({
            id: String(p._id),
            number: p.number,
            supplierId: String(p.supplierId),
            totalMinor: p.totalMinor,
            paidMinor: p.paidMinor,
            paymentStatus: p.paymentStatus,
            receivedAt: p.receivedAt,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/payables",
  requirePermission("reports.purchases"),
  async (req, res, next) => {
    try {
      const rows = await Supplier.find({
        tenantId: req.auth!.tenantId,
        deletedAt: null,
        balanceMinor: { $gt: 0 },
      })
        .sort({ balanceMinor: -1 })
        .lean();

      res.json({
        data: {
          totalMinor: rows.reduce((s, r) => s + r.balanceMinor, 0),
          rows: rows.map((s) => ({
            id: String(s._id),
            name: s.name,
            phone: s.phone,
            balanceMinor: s.balanceMinor,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/receivables",
  requirePermission("reports.sales"),
  async (req, res, next) => {
    try {
      const rows = await Customer.find({
        tenantId: req.auth!.tenantId,
        deletedAt: null,
        balanceMinor: { $gt: 0 },
      })
        .sort({ balanceMinor: -1 })
        .lean();

      res.json({
        data: {
          totalMinor: rows.reduce((s, r) => s + r.balanceMinor, 0),
          rows: rows.map((c) => ({
            id: String(c._id),
            name: c.name,
            phone: c.phone,
            group: c.group,
            balanceMinor: c.balanceMinor,
            creditLimitMinor: c.creditLimitMinor,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/expenses",
  requirePermission("expenses.view"),
  validate({ query: reportRangeQuery }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const range = parseDateRange(req.query as { from?: string; to?: string });
      const match: Record<string, unknown> = {
        tenantId: oid(tenantId),
        deletedAt: null,
        status: "approved",
        expenseDate: { $gte: range.from, $lte: range.to },
      };
      if (req.query.branchId) match.branchId = oid(String(req.query.branchId));

      const byCategory = await Expense.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$categoryId",
            amountMinor: { $sum: "$amountMinor" },
            count: { $sum: 1 },
          },
        },
        { $sort: { amountMinor: -1 } },
      ]);

      const cats = await ExpenseCategory.find({
        _id: { $in: byCategory.map((r) => r._id) },
      }).lean();
      const catMap = new Map(cats.map((c) => [String(c._id), c.name]));

      const totalMinor = byCategory.reduce((s, r) => s + r.amountMinor, 0);

      res.json({
        data: {
          range,
          totalMinor,
          byCategory: byCategory.map((r) => ({
            categoryId: String(r._id),
            categoryName: catMap.get(String(r._id)) ?? "Unknown",
            amountMinor: r.amountMinor,
            count: r.count,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/tax",
  requirePermission("reports.sales"),
  validate({ query: reportRangeQuery }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const range = parseDateRange(req.query as { from?: string; to?: string });
      const match = saleMatch(tenantId, range, req.query.branchId as string | undefined);

      const [row] = await Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            taxableMinor: { $sum: "$subtotalMinor" },
            taxMinor: { $sum: "$taxMinor" },
            totalMinor: { $sum: "$totalMinor" },
            count: { $sum: 1 },
          },
        },
      ]);

      res.json({
        data: {
          range,
          taxableMinor: row?.taxableMinor ?? 0,
          taxMinor: row?.taxMinor ?? 0,
          totalMinor: row?.totalMinor ?? 0,
          saleCount: row?.count ?? 0,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/returns",
  requirePermission("reports.sales"),
  validate({ query: reportRangeQuery }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const range = parseDateRange(req.query as { from?: string; to?: string });
      const match: Record<string, unknown> = {
        tenantId: oid(tenantId),
        deletedAt: null,
        createdAt: { $gte: range.from, $lte: range.to },
      };
      if (req.query.branchId) match.branchId = oid(String(req.query.branchId));

      const [summary] = await ReturnModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            refundMinor: { $sum: "$totalRefundMinor" },
          },
        },
      ]);

      const rows = await ReturnModel.find({
        tenantId,
        deletedAt: null,
        createdAt: { $gte: range.from, $lte: range.to },
        ...(req.query.branchId ? { branchId: req.query.branchId } : {}),
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      res.json({
        data: {
          range,
          summary: {
            count: summary?.count ?? 0,
            refundMinor: summary?.refundMinor ?? 0,
          },
          rows: rows.map((r) => ({
            id: String(r._id),
            returnNo: r.returnNo,
            saleId: String(r.saleId),
            totalRefundMinor: r.totalRefundMinor,
            status: r.status,
            createdAt: r.createdAt,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/employees",
  requirePermission("reports.sales"),
  validate({ query: reportRangeQuery }),
  async (req, res, next) => {
    try {
      // Alias of sales-by-cashier with refund context
      const tenantId = req.auth!.tenantId!;
      const range = parseDateRange(req.query as { from?: string; to?: string });
      const match = saleMatch(tenantId, range, req.query.branchId as string | undefined);

      const sales = await Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$cashierId",
            saleCount: { $sum: 1 },
            salesMinor: { $sum: "$totalMinor" },
            discountMinor: { $sum: "$discountMinor" },
          },
        },
      ]);

      const users = await User.find({ _id: { $in: sales.map((r) => r._id) } })
        .select("name email")
        .lean();
      const userMap = new Map(users.map((u) => [String(u._id), u]));

      res.json({
        data: sales
          .map((r) => ({
            userId: String(r._id),
            name: userMap.get(String(r._id))?.name ?? "Unknown",
            email: userMap.get(String(r._id))?.email ?? "",
            saleCount: r.saleCount,
            salesMinor: r.salesMinor,
            discountMinor: r.discountMinor,
          }))
          .sort((a, b) => b.salesMinor - a.salesMinor),
      });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/registers",
  requirePermission("reports.sales"),
  validate({ query: reportRangeQuery }),
  async (req, res, next) => {
    try {
      const tenantId = req.auth!.tenantId!;
      const range = parseDateRange(req.query as { from?: string; to?: string });
      const filter: Record<string, unknown> = {
        tenantId,
        openedAt: { $gte: range.from, $lte: range.to },
      };
      if (req.query.branchId) filter.branchId = req.query.branchId;

      const sessions = await RegisterSession.find(filter).sort({ openedAt: -1 }).limit(100).lean();

      res.json({
        data: {
          range,
          rows: sessions.map((s) => ({
            id: String(s._id),
            registerId: String(s.registerId),
            branchId: String(s.branchId),
            status: s.status,
            openedAt: s.openedAt,
            closedAt: s.closedAt,
            openingCashMinor: s.openingCashMinor,
            closingCashMinor: s.closingCashMinor ?? null,
            expectedCashMinor: s.expectedCashMinor ?? null,
            cashSalesMinor: s.cashSalesMinor,
            cashRefundsMinor: s.cashRefundsMinor,
            varianceMinor: s.varianceMinor ?? null,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/export",
  requirePermission("reports.export"),
  validate({
    query: reportRangeQuery.extend({
      type: z.enum([
        "sales",
        "payments",
        "profit",
        "purchases",
        "payables",
        "receivables",
        "expenses",
        "inventory",
      ]),
      format: z.enum(["csv"]).default("csv"),
    }),
  }),
  async (req, res, next) => {
    try {
      const type = String(req.query.type);
      if (type === "profit" && !req.auth!.permissions.includes("reports.profit")) {
        throw new AppError(403, "Profit export requires reports.profit", "FORBIDDEN");
      }

      const tenantId = req.auth!.tenantId!;
      const range = parseDateRange(req.query as { from?: string; to?: string });
      const branchId = req.query.branchId as string | undefined;
      let headers: string[] = [];
      let rows: Array<Array<string | number>> = [];
      let filename = `report-${type}.csv`;

      if (type === "sales") {
        const match = saleMatch(tenantId, range, branchId);
        const sales = await Sale.find(match).sort({ soldAt: -1 }).limit(5000).lean();
        headers = ["receiptNo", "soldAt", "totalMinor", "taxMinor", "discountMinor", "customerName"];
        rows = sales.map((s) => [
          s.receiptNo,
          new Date(s.soldAt).toISOString(),
          s.totalMinor,
          s.taxMinor,
          s.discountMinor,
          s.customerName,
        ]);
      } else if (type === "payments") {
        const match = saleMatch(tenantId, range, branchId);
        const grouped = await Sale.aggregate([
          { $match: match },
          { $unwind: "$payments" },
          {
            $group: {
              _id: "$payments.method",
              amountMinor: { $sum: "$payments.amountMinor" },
              count: { $sum: 1 },
            },
          },
        ]);
        headers = ["method", "amountMinor", "count"];
        rows = grouped.map((g) => [g._id, g.amountMinor, g.count]);
      } else if (type === "profit") {
        const match = saleMatch(tenantId, range, branchId);
        const byProduct = await Sale.aggregate([
          { $match: match },
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.sku",
              name: { $first: "$items.name" },
              qty: { $sum: "$items.qty" },
              revenueMinor: { $sum: "$items.lineTotalMinor" },
              cogsMinor: { $sum: { $multiply: ["$items.costMinor", "$items.qty"] } },
            },
          },
        ]);
        headers = ["sku", "name", "qty", "revenueMinor", "cogsMinor", "profitMinor"];
        rows = byProduct.map((r) => [
          r._id,
          r.name,
          r.qty,
          r.revenueMinor,
          r.cogsMinor,
          r.revenueMinor - r.cogsMinor,
        ]);
      } else if (type === "purchases") {
        const purchases = await Purchase.find({
          tenantId,
          deletedAt: null,
          receivedAt: { $gte: range.from, $lte: range.to },
          ...(branchId ? { branchId } : {}),
        })
          .sort({ receivedAt: -1 })
          .limit(5000)
          .lean();
        headers = ["number", "receivedAt", "totalMinor", "paidMinor", "paymentStatus"];
        rows = purchases.map((p) => [
          p.number,
          new Date(p.receivedAt).toISOString(),
          p.totalMinor,
          p.paidMinor,
          p.paymentStatus,
        ]);
      } else if (type === "payables") {
        const suppliers = await Supplier.find({
          tenantId,
          deletedAt: null,
          balanceMinor: { $gt: 0 },
        }).lean();
        headers = ["name", "phone", "balanceMinor"];
        rows = suppliers.map((s) => [s.name, s.phone, s.balanceMinor]);
      } else if (type === "receivables") {
        const customers = await Customer.find({
          tenantId,
          deletedAt: null,
          balanceMinor: { $gt: 0 },
        }).lean();
        headers = ["name", "phone", "group", "balanceMinor", "creditLimitMinor"];
        rows = customers.map((c) => [
          c.name,
          c.phone,
          c.group,
          c.balanceMinor,
          c.creditLimitMinor,
        ]);
      } else if (type === "expenses") {
        const expenses = await Expense.find({
          tenantId,
          deletedAt: null,
          status: "approved",
          expenseDate: { $gte: range.from, $lte: range.to },
          ...(branchId ? { branchId } : {}),
        })
          .limit(5000)
          .lean();
        headers = ["expenseDate", "amountMinor", "method", "status", "note"];
        rows = expenses.map((e) => [
          new Date(e.expenseDate).toISOString(),
          e.amountMinor,
          e.method,
          e.status,
          e.note,
        ]);
      } else if (type === "inventory") {
        if (!req.auth!.permissions.includes("reports.inventory")) {
          throw new AppError(403, "Inventory export requires reports.inventory", "FORBIDDEN");
        }
        const inv = await BranchInventory.find({
          tenantId,
          ...(branchId ? { branchId } : {}),
        }).lean();
        const variants = await ProductVariant.find({
          tenantId,
          _id: { $in: inv.map((i) => i.variantId) },
        }).lean();
        const vMap = new Map(variants.map((v) => [String(v._id), v]));
        headers = ["sku", "qtyOnHand", "avgCostMinor", "valueMinor"];
        rows = inv.map((i) => {
          const v = vMap.get(String(i.variantId));
          const cost = i.avgCostMinor || v?.costMinor || 0;
          return [v?.sku ?? "", i.qtyOnHand, cost, Math.round(i.qtyOnHand * cost)];
        });
      }

      const csv = toCsv(headers, rows);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  },
);
