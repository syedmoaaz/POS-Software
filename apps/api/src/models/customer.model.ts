import mongoose, { Schema, type InferSchemaType } from "mongoose";

const customerSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    taxNumber: { type: String, default: "" },
    group: { type: String, enum: ["retail", "wholesale"], default: "retail" },
    creditLimitMinor: { type: Number, default: 0, min: 0 },
    balanceMinor: { type: Number, default: 0 }, // positive = customer owes us
    storeCreditMinor: { type: Number, default: 0, min: 0 },
    loyaltyPoints: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

customerSchema.index({ tenantId: 1, phone: 1 });
customerSchema.index({ tenantId: 1, name: 1 });

export type CustomerDoc = InferSchemaType<typeof customerSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Customer = mongoose.model("Customer", customerSchema);

const customerLedgerSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    type: {
      type: String,
      enum: ["sale", "payment", "credit", "advance", "adjustment", "refund"],
      required: true,
    },
    amountMinor: { type: Number, required: true }, // + increases receivable
    balanceAfterMinor: { type: Number, required: true },
    refType: { type: String },
    refId: { type: String },
    note: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

customerLedgerSchema.index({ tenantId: 1, customerId: 1, createdAt: -1 });

export type CustomerLedgerDoc = InferSchemaType<typeof customerLedgerSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const CustomerLedger = mongoose.model("CustomerLedger", customerLedgerSchema);

const loyaltyTxnSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    type: { type: String, enum: ["earn", "redeem", "adjust"], required: true },
    points: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    refType: { type: String },
    refId: { type: String },
    note: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type LoyaltyTransactionDoc = InferSchemaType<typeof loyaltyTxnSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const LoyaltyTransaction = mongoose.model("LoyaltyTransaction", loyaltyTxnSchema);
