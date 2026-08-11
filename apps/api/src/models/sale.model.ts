import mongoose, { Schema, type InferSchemaType } from "mongoose";

const saleItemSchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: "ProductVariant", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    qty: { type: Number, required: true },
    unitPriceMinor: { type: Number, required: true },
    costMinor: { type: Number, required: true, default: 0 },
    discountMinor: { type: Number, default: 0 },
    taxMinor: { type: Number, default: 0 },
    lineTotalMinor: { type: Number, required: true },
    note: { type: String, default: "" },
  },
  { _id: true },
);

const paymentSchema = new Schema(
  {
    method: {
      type: String,
      enum: ["cash", "card", "transfer", "wallet", "store_credit", "customer_credit"],
      required: true,
    },
    amountMinor: { type: Number, required: true, min: 0 },
    reference: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { _id: true },
);

const saleSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    registerId: { type: Schema.Types.ObjectId, ref: "Register", required: true },
    registerSessionId: { type: Schema.Types.ObjectId, ref: "RegisterSession", required: true },
    receiptNo: { type: String, required: true },
    status: {
      type: String,
      enum: ["completed", "void", "returned", "partial_return"],
      default: "completed",
      index: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, default: "Walk-in Customer" },
    cashierId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [saleItemSchema], required: true },
    payments: { type: [paymentSchema], required: true },
    subtotalMinor: { type: Number, required: true },
    discountMinor: { type: Number, default: 0 },
    taxMinor: { type: Number, default: 0 },
    totalMinor: { type: Number, required: true },
    paidMinor: { type: Number, required: true },
    changeMinor: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["paid", "partial", "unpaid", "refunded"],
      default: "paid",
    },
    notes: { type: String, default: "" },
    idempotencyKey: { type: String, required: true },
    offlineId: { type: String },
    soldAt: { type: Date, default: Date.now, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

saleSchema.index({ tenantId: 1, receiptNo: 1 }, { unique: true });
saleSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });
saleSchema.index(
  { tenantId: 1, offlineId: 1 },
  { unique: true, partialFilterExpression: { offlineId: { $type: "string" } } },
);
saleSchema.index({ tenantId: 1, branchId: 1, soldAt: -1 });

export type SaleDoc = InferSchemaType<typeof saleSchema> & { _id: mongoose.Types.ObjectId };
export const Sale = mongoose.model("Sale", saleSchema);

const heldSaleSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    registerId: { type: Schema.Types.ObjectId, ref: "Register", required: true },
    label: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, default: "Walk-in Customer" },
    cartDiscountMinor: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    items: { type: [saleItemSchema], required: true },
    heldBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    heldAt: { type: Date, default: Date.now },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

heldSaleSchema.index({ tenantId: 1, branchId: 1, heldAt: -1 });

export type HeldSaleDoc = InferSchemaType<typeof heldSaleSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const HeldSale = mongoose.model("HeldSale", heldSaleSchema);

const returnLineSchema = new Schema(
  {
    saleItemId: { type: Schema.Types.ObjectId, required: true },
    variantId: { type: Schema.Types.ObjectId, ref: "ProductVariant", required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 0.001 },
    unitPriceMinor: { type: Number, required: true },
    refundMinor: { type: Number, required: true },
    disposition: {
      type: String,
      enum: ["restock", "damaged", "discard"],
      default: "restock",
    },
  },
  { _id: true },
);

const returnSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    saleId: { type: Schema.Types.ObjectId, ref: "Sale", required: true, index: true },
    returnNo: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "completed", "rejected"],
      default: "completed",
    },
    reason: { type: String, default: "" },
    lines: { type: [returnLineSchema], required: true },
    refundPayments: { type: [paymentSchema], required: true },
    totalRefundMinor: { type: Number, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    registerSessionId: { type: Schema.Types.ObjectId, ref: "RegisterSession" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

returnSchema.index({ tenantId: 1, returnNo: 1 }, { unique: true });
returnSchema.index({ tenantId: 1, createdAt: -1 });

export type ReturnDoc = InferSchemaType<typeof returnSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const ReturnModel = mongoose.model("Return", returnSchema);
