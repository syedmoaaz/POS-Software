import mongoose from "mongoose";
import { AppError } from "../../lib/errors.js";
import { applyStockMovement, withTransaction } from "../../lib/stock.js";
import { nextSequence } from "../../models/counter.model.js";
import { ProductVariant, Product } from "../../models/product.model.js";
import { Register } from "../../models/register.model.js";
import { RegisterSession } from "../../models/register-session.model.js";
import { BranchInventory } from "../../models/inventory.model.js";
import { Sale, ReturnModel } from "../../models/sale.model.js";
import { AuditLog } from "../../models/audit.model.js";

export type CheckoutLineInput = {
  variantId: string;
  qty: number;
  unitPriceMinor?: number;
  discountMinor?: number;
  note?: string;
};

export type CheckoutPaymentInput = {
  method: "cash" | "card" | "transfer" | "wallet" | "store_credit" | "customer_credit";
  amountMinor: number;
  reference?: string;
  notes?: string;
};

export type CheckoutInput = {
  tenantId: string;
  userId: string;
  branchId: string;
  registerId: string;
  idempotencyKey: string;
  items: CheckoutLineInput[];
  payments: CheckoutPaymentInput[];
  cartDiscountMinor?: number;
  customerId?: string;
  customerName?: string;
  notes?: string;
  offlineId?: string;
  soldAt?: Date;
  allowNegativeStock?: boolean;
  requestId?: string;
  ip?: string;
};

function lineNet(unitPriceMinor: number, qty: number, discountMinor: number) {
  return Math.max(0, Math.round(unitPriceMinor * qty) - discountMinor);
}

export async function checkoutSale(input: CheckoutInput) {
  if (!input.items.length) throw new AppError(400, "Cart is empty", "EMPTY_CART");
  if (!input.payments.length) throw new AppError(400, "Payment required", "NO_PAYMENT");
  if (!input.idempotencyKey) {
    throw new AppError(400, "Idempotency-Key required", "IDEMPOTENCY_REQUIRED");
  }

  const existing = await Sale.findOne({
    tenantId: input.tenantId,
    idempotencyKey: input.idempotencyKey,
    deletedAt: null,
  }).lean();
  if (existing) {
    return { sale: existing, replayed: true as const };
  }

  if (input.offlineId) {
    const byOffline = await Sale.findOne({
      tenantId: input.tenantId,
      offlineId: input.offlineId,
      deletedAt: null,
    }).lean();
    if (byOffline) {
      return { sale: byOffline, replayed: true as const };
    }
  }

  const register = await Register.findOne({
    _id: input.registerId,
    tenantId: input.tenantId,
    branchId: input.branchId,
    deletedAt: null,
    isActive: true,
  });
  if (!register) throw new AppError(404, "Register not found", "REGISTER_NOT_FOUND");

  const sessionDoc = await RegisterSession.findOne({
    tenantId: input.tenantId,
    registerId: input.registerId,
    status: "open",
  });
  if (!sessionDoc) {
    throw new AppError(400, "Open a register session before selling", "REGISTER_CLOSED");
  }

  const sale = await withTransaction(async (session) => {
    const q = <T extends { session: (s: mongoose.ClientSession | null) => T }>(query: T) =>
      query.session(session ?? null);

    // Re-check idempotency inside transaction
    const again = await q(
      Sale.findOne({
        tenantId: input.tenantId,
        idempotencyKey: input.idempotencyKey,
      }),
    );
    if (again) return again;

    const builtItems = [];
    let subtotalMinor = 0;

    for (const line of input.items) {
      if (line.qty <= 0) throw new AppError(400, "Invalid line quantity", "INVALID_QTY");
      const variant = await q(
        ProductVariant.findOne({
          _id: line.variantId,
          tenantId: input.tenantId,
          deletedAt: null,
          isActive: true,
        }),
      );
      if (!variant) throw new AppError(404, `Variant not found: ${line.variantId}`, "VARIANT_NOT_FOUND");

      const product = await q(
        Product.findOne({
          _id: variant.productId,
          tenantId: input.tenantId,
          deletedAt: null,
          status: "active",
        }),
      );
      if (!product) throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");

      const unitPriceMinor = line.unitPriceMinor ?? variant.retailPriceMinor;
      if (variant.minPriceMinor > 0 && unitPriceMinor < variant.minPriceMinor) {
        throw new AppError(400, `${product.name} below minimum price`, "MIN_PRICE");
      }

      const discountMinor = line.discountMinor ?? 0;
      const lineTotalMinor = lineNet(unitPriceMinor, line.qty, discountMinor);
      subtotalMinor += lineTotalMinor + discountMinor;

      builtItems.push({
        variantId: variant._id,
        productId: product._id,
        name: product.name,
        sku: variant.sku,
        qty: line.qty,
        unitPriceMinor,
        costMinor: variant.costMinor,
        discountMinor,
        taxMinor: 0,
        lineTotalMinor,
        note: line.note ?? "",
      });
    }

    const linesDiscount = builtItems.reduce((s, i) => s + i.discountMinor, 0);
    const cartDiscountMinor = Math.min(input.cartDiscountMinor ?? 0, subtotalMinor - linesDiscount);
    const discountMinor = linesDiscount + cartDiscountMinor;
    const taxable = Math.max(0, subtotalMinor - discountMinor);
    const taxMinor = 0;
    const totalMinor = taxable + taxMinor;

    const paidMinor = input.payments.reduce((s, p) => s + p.amountMinor, 0);
    if (paidMinor < totalMinor) {
      throw new AppError(400, "Insufficient payment", "UNDERPAID", {
        totalMinor,
        paidMinor,
      });
    }
    const changeMinor = paidMinor - totalMinor;

    const seq = await nextSequence(
      {
        tenantId: input.tenantId,
        key: "receipt",
        branchId: input.branchId,
        registerId: input.registerId,
      },
      session,
    );
    const receiptNo = `${register.code}-${String(seq).padStart(6, "0")}`;

    const [created] = await Sale.create(
      [
        {
          tenantId: input.tenantId,
          branchId: input.branchId,
          registerId: input.registerId,
          registerSessionId: sessionDoc._id,
          receiptNo,
          status: "completed",
          customerId: input.customerId || undefined,
          customerName: input.customerName || "Walk-in Customer",
          cashierId: input.userId,
          items: builtItems,
          payments: input.payments.map((p) => ({
            method: p.method,
            amountMinor: p.amountMinor,
            reference: p.reference ?? "",
            notes: p.notes ?? "",
          })),
          subtotalMinor,
          discountMinor,
          taxMinor,
          totalMinor,
          paidMinor,
          changeMinor,
          paymentStatus: "paid",
          notes: input.notes ?? "",
          idempotencyKey: input.idempotencyKey,
          ...(input.offlineId ? { offlineId: input.offlineId } : {}),
          soldAt: input.soldAt ?? new Date(),
        },
      ],
      session ? { session } : undefined,
    );

    for (const item of builtItems) {
      const inv = await q(
        BranchInventory.findOne({
          tenantId: input.tenantId,
          branchId: input.branchId,
          variantId: item.variantId,
        }),
      );

      await applyStockMovement({
        tenantId: input.tenantId,
        branchId: input.branchId,
        variantId: String(item.variantId),
        type: "sale",
        qtyDelta: -item.qty,
        unitCostMinor: inv?.avgCostMinor ?? item.costMinor,
        createdBy: input.userId,
        allowNegative: input.allowNegativeStock ?? false,
        refType: "sale",
        refId: String(created._id),
        session,
      });
    }

    const cashPaid = input.payments
      .filter((p) => p.method === "cash")
      .reduce((s, p) => s + p.amountMinor, 0);
    if (cashPaid > 0) {
      const cashKept = Math.max(0, cashPaid - changeMinor);
      sessionDoc.cashSalesMinor += cashKept;
      await sessionDoc.save(session ? { session } : undefined);
    }

    return created;
  });

  await AuditLog.create({
    tenantId: input.tenantId,
    actorUserId: input.userId,
    action: "sale.checkout",
    entityType: "Sale",
    entityId: String(sale._id),
    meta: { receiptNo: sale.receiptNo, totalMinor: sale.totalMinor },
    requestId: input.requestId,
    ip: input.ip,
  });

  return { sale, replayed: false as const };
}

export async function createReturn(input: {
  tenantId: string;
  userId: string;
  saleId: string;
  reason?: string;
  registerSessionId?: string;
  lines: {
    saleItemId: string;
    qty: number;
    disposition?: "restock" | "damaged" | "discard";
  }[];
  refundPayments: CheckoutPaymentInput[];
  requestId?: string;
  ip?: string;
}) {
  if (!input.lines.length) throw new AppError(400, "No return lines", "EMPTY_RETURN");

  const sale = await Sale.findOne({
    _id: input.saleId,
    tenantId: input.tenantId,
    deletedAt: null,
  });
  if (!sale) throw new AppError(404, "Sale not found", "SALE_NOT_FOUND");
  if (sale.status === "void") throw new AppError(400, "Cannot return a voided sale", "SALE_VOID");

  const ret = await withTransaction(async (session) => {
    const returnLines = [];
    let totalRefundMinor = 0;

    for (const line of input.lines) {
      const saleItem = sale.items.id(line.saleItemId);
      if (!saleItem) throw new AppError(400, "Sale item not found", "SALE_ITEM_NOT_FOUND");
      if (line.qty <= 0 || line.qty > saleItem.qty) {
        throw new AppError(400, "Invalid return quantity", "INVALID_RETURN_QTY");
      }

      const unitNet = Math.round(saleItem.lineTotalMinor / saleItem.qty);
      const refundMinor = Math.round(unitNet * line.qty);
      totalRefundMinor += refundMinor;

      returnLines.push({
        saleItemId: saleItem._id,
        variantId: saleItem.variantId,
        name: saleItem.name,
        qty: line.qty,
        unitPriceMinor: saleItem.unitPriceMinor,
        refundMinor,
        disposition: line.disposition ?? "restock",
      });
    }

    const refundPaid = input.refundPayments.reduce((s, p) => s + p.amountMinor, 0);
    if (refundPaid !== totalRefundMinor) {
      throw new AppError(400, "Refund payments must equal refund total", "REFUND_MISMATCH", {
        totalRefundMinor,
        refundPaid,
      });
    }

    const seq = await nextSequence(
      { tenantId: input.tenantId, key: "return", branchId: String(sale.branchId) },
      session,
    );
    const returnNo = `RET-${String(seq).padStart(6, "0")}`;

    const [created] = await ReturnModel.create(
      [
        {
          tenantId: input.tenantId,
          branchId: sale.branchId,
          saleId: sale._id,
          returnNo,
          status: "completed",
          reason: input.reason ?? "",
          lines: returnLines,
          refundPayments: input.refundPayments,
          totalRefundMinor,
          createdBy: input.userId,
          registerSessionId: input.registerSessionId || sale.registerSessionId,
        },
      ],
      session ? { session } : undefined,
    );

    for (const line of returnLines) {
      if (line.disposition === "restock") {
        await applyStockMovement({
          tenantId: input.tenantId,
          branchId: String(sale.branchId),
          variantId: String(line.variantId),
          type: "sale_return",
          qtyDelta: line.qty,
          createdBy: input.userId,
          refType: "return",
          refId: String(created._id),
          session,
        });
      }
    }

    const fullyReturned =
      sale.items.length === returnLines.length &&
      returnLines.every((l) => {
        const item = sale.items.id(l.saleItemId);
        return item != null && l.qty >= item.qty;
      });
    sale.status = fullyReturned ? "returned" : "partial_return";
    sale.paymentStatus = "refunded";
    await sale.save(session ? { session } : undefined);

    const cashRefund = input.refundPayments
      .filter((p) => p.method === "cash")
      .reduce((s, p) => s + p.amountMinor, 0);
    if (cashRefund > 0 && (input.registerSessionId || sale.registerSessionId)) {
      const regSession = await RegisterSession.findById(
        input.registerSessionId || sale.registerSessionId,
      ).session(session ?? null);
      if (regSession && regSession.status === "open") {
        regSession.cashRefundsMinor += cashRefund;
        await regSession.save(session ? { session } : undefined);
      }
    }

    return created;
  });

  await AuditLog.create({
    tenantId: input.tenantId,
    actorUserId: input.userId,
    action: "sale.return",
    entityType: "Return",
    entityId: String(ret._id),
    meta: { returnNo: ret.returnNo, totalRefundMinor: ret.totalRefundMinor },
    requestId: input.requestId,
    ip: input.ip,
  });

  return ret;
}

export function serializeSale(sale: {
  _id: { toString(): string };
  receiptNo: string;
  status: string;
  branchId: { toString(): string };
  registerId: { toString(): string };
  cashierId: { toString(): string };
  customerName?: string | null;
  customerId?: { toString(): string } | null;
  items: Array<{
    _id: { toString(): string };
    variantId: { toString(): string };
    name: string;
    sku: string;
    qty: number;
    unitPriceMinor: number;
    discountMinor: number;
    lineTotalMinor: number;
    costMinor?: number;
    note?: string;
  }>;
  payments: Array<{ method: string; amountMinor: number; reference?: string }>;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  paidMinor: number;
  changeMinor: number;
  paymentStatus: string;
  notes?: string;
  soldAt: Date;
  createdAt?: Date;
}, opts?: { includeCost?: boolean }) {
  return {
    id: String(sale._id),
    receiptNo: sale.receiptNo,
    status: sale.status,
    branchId: String(sale.branchId),
    registerId: String(sale.registerId),
    cashierId: String(sale.cashierId),
    customerId: sale.customerId ? String(sale.customerId) : null,
    customerName: sale.customerName,
    items: sale.items.map((i) => ({
      id: String(i._id),
      variantId: String(i.variantId),
      name: i.name,
      sku: i.sku,
      qty: i.qty,
      unitPriceMinor: i.unitPriceMinor,
      discountMinor: i.discountMinor,
      lineTotalMinor: i.lineTotalMinor,
      costMinor: opts?.includeCost ? i.costMinor : undefined,
      note: i.note,
    })),
    payments: sale.payments,
    subtotalMinor: sale.subtotalMinor,
    discountMinor: sale.discountMinor,
    taxMinor: sale.taxMinor,
    totalMinor: sale.totalMinor,
    paidMinor: sale.paidMinor,
    changeMinor: sale.changeMinor,
    paymentStatus: sale.paymentStatus,
    notes: sale.notes,
    soldAt: sale.soldAt,
    createdAt: sale.createdAt,
  };
}
