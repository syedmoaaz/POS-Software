import type { ClientSession } from "mongoose";
import { Supplier, SupplierLedger } from "../models/supplier.model.js";
import { Customer, CustomerLedger } from "../models/customer.model.js";
import { AppError } from "./errors.js";

export async function postSupplierLedger(input: {
  tenantId: string;
  supplierId: string;
  type: "purchase" | "payment" | "purchase_return" | "adjustment";
  amountMinor: number;
  createdBy: string;
  refType?: string;
  refId?: string;
  note?: string;
  session?: ClientSession | null;
}) {
  const supplier = await Supplier.findOne({
    _id: input.supplierId,
    tenantId: input.tenantId,
    deletedAt: null,
  }).session(input.session ?? null);
  if (!supplier) throw new AppError(404, "Supplier not found", "SUPPLIER_NOT_FOUND");

  supplier.balanceMinor += input.amountMinor;
  await supplier.save(input.session ? { session: input.session } : undefined);

  const [entry] = await SupplierLedger.create(
    [
      {
        tenantId: input.tenantId,
        supplierId: input.supplierId,
        type: input.type,
        amountMinor: input.amountMinor,
        balanceAfterMinor: supplier.balanceMinor,
        refType: input.refType,
        refId: input.refId,
        note: input.note ?? "",
        createdBy: input.createdBy,
      },
    ],
    input.session ? { session: input.session } : undefined,
  );

  return { supplier, entry };
}

export async function postCustomerLedger(input: {
  tenantId: string;
  customerId: string;
  type: "sale" | "payment" | "credit" | "advance" | "adjustment" | "refund";
  amountMinor: number;
  createdBy: string;
  refType?: string;
  refId?: string;
  note?: string;
  session?: ClientSession | null;
  enforceCreditLimit?: boolean;
}) {
  const customer = await Customer.findOne({
    _id: input.customerId,
    tenantId: input.tenantId,
    deletedAt: null,
  }).session(input.session ?? null);
  if (!customer) throw new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND");

  const next = customer.balanceMinor + input.amountMinor;
  if (
    input.enforceCreditLimit &&
    input.amountMinor > 0 &&
    customer.creditLimitMinor > 0 &&
    next > customer.creditLimitMinor
  ) {
    throw new AppError(400, "Credit limit exceeded", "CREDIT_LIMIT", {
      balanceMinor: customer.balanceMinor,
      creditLimitMinor: customer.creditLimitMinor,
    });
  }

  customer.balanceMinor = next;
  await customer.save(input.session ? { session: input.session } : undefined);

  const [entry] = await CustomerLedger.create(
    [
      {
        tenantId: input.tenantId,
        customerId: input.customerId,
        type: input.type,
        amountMinor: input.amountMinor,
        balanceAfterMinor: customer.balanceMinor,
        refType: input.refType,
        refId: input.refId,
        note: input.note ?? "",
        createdBy: input.createdBy,
      },
    ],
    input.session ? { session: input.session } : undefined,
  );

  return { customer, entry };
}
