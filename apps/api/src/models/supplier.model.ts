import mongoose, { Schema, type InferSchemaType } from "mongoose";

const supplierSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    taxNumber: { type: String, default: "" },
    balanceMinor: { type: Number, default: 0 }, // positive = we owe supplier
    notes: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

supplierSchema.index({ tenantId: 1, name: 1 });

export type SupplierDoc = InferSchemaType<typeof supplierSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Supplier = mongoose.model("Supplier", supplierSchema);

const supplierLedgerSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    type: {
      type: String,
      enum: ["purchase", "payment", "purchase_return", "adjustment"],
      required: true,
    },
    amountMinor: { type: Number, required: true }, // + increases payable, - decreases
    balanceAfterMinor: { type: Number, required: true },
    refType: { type: String },
    refId: { type: String },
    note: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

supplierLedgerSchema.index({ tenantId: 1, supplierId: 1, createdAt: -1 });

export type SupplierLedgerDoc = InferSchemaType<typeof supplierLedgerSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const SupplierLedger = mongoose.model("SupplierLedger", supplierLedgerSchema);

const poLineSchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: "ProductVariant", required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    qtyOrdered: { type: Number, required: true, min: 0.001 },
    qtyReceived: { type: Number, default: 0 },
    unitCostMinor: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const purchaseOrderSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    number: { type: String, required: true },
    status: {
      type: String,
      enum: ["draft", "ordered", "partial", "received", "cancelled"],
      default: "draft",
      index: true,
    },
    lines: { type: [poLineSchema], required: true },
    notes: { type: String, default: "" },
    expectedAt: { type: Date },
    orderedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    totalMinor: { type: Number, required: true, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

purchaseOrderSchema.index({ tenantId: 1, number: 1 }, { unique: true });

export type PurchaseOrderDoc = InferSchemaType<typeof purchaseOrderSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const PurchaseOrder = mongoose.model("PurchaseOrder", purchaseOrderSchema);

const purchaseLineSchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: "ProductVariant", required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    qty: { type: Number, required: true, min: 0.001 },
    unitCostMinor: { type: Number, required: true, min: 0 },
    lineTotalMinor: { type: Number, required: true },
  },
  { _id: true },
);

const purchaseSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    purchaseOrderId: { type: Schema.Types.ObjectId, ref: "PurchaseOrder" },
    number: { type: String, required: true },
    invoiceNo: { type: String, default: "" },
    status: {
      type: String,
      enum: ["draft", "received", "cancelled"],
      default: "received",
    },
    lines: { type: [purchaseLineSchema], required: true },
    subtotalMinor: { type: Number, required: true },
    expenseMinor: { type: Number, default: 0 },
    totalMinor: { type: Number, required: true },
    paidMinor: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "unpaid",
    },
    notes: { type: String, default: "" },
    receivedAt: { type: Date, default: Date.now },
    dueAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

purchaseSchema.index({ tenantId: 1, number: 1 }, { unique: true });
purchaseSchema.index({ tenantId: 1, branchId: 1, receivedAt: -1 });

export type PurchaseDoc = InferSchemaType<typeof purchaseSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Purchase = mongoose.model("Purchase", purchaseSchema);

const supplierPaymentSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    purchaseId: { type: Schema.Types.ObjectId, ref: "Purchase" },
    amountMinor: { type: Number, required: true, min: 1 },
    method: {
      type: String,
      enum: ["cash", "card", "transfer", "wallet"],
      required: true,
    },
    reference: { type: String, default: "" },
    notes: { type: String, default: "" },
    paidAt: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type SupplierPaymentDoc = InferSchemaType<typeof supplierPaymentSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const SupplierPayment = mongoose.model("SupplierPayment", supplierPaymentSchema);
