import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const STOCK_MOVEMENT_TYPES = [
  "opening",
  "purchase",
  "sale",
  "sale_return",
  "purchase_return",
  "adjust",
  "damage",
  "transfer_out",
  "transfer_in",
  "count",
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

const branchInventorySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    variantId: { type: Schema.Types.ObjectId, ref: "ProductVariant", required: true, index: true },
    qtyOnHand: { type: Number, default: 0 },
    qtyReserved: { type: Number, default: 0 },
    qtyDamaged: { type: Number, default: 0 },
    qtyExpired: { type: Number, default: 0 },
    avgCostMinor: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

branchInventorySchema.index({ tenantId: 1, branchId: 1, variantId: 1 }, { unique: true });

export type BranchInventoryDoc = InferSchemaType<typeof branchInventorySchema> & {
  _id: mongoose.Types.ObjectId;
};
export const BranchInventory = mongoose.model("BranchInventory", branchInventorySchema);

const stockMovementSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    variantId: { type: Schema.Types.ObjectId, ref: "ProductVariant", required: true, index: true },
    type: { type: String, enum: STOCK_MOVEMENT_TYPES, required: true },
    qtyDelta: { type: Number, required: true },
    unitCostMinor: { type: Number, min: 0 },
    qtyAfter: { type: Number, required: true },
    refType: { type: String },
    refId: { type: String },
    note: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

stockMovementSchema.index({ tenantId: 1, branchId: 1, variantId: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, refType: 1, refId: 1 });

export type StockMovementDoc = InferSchemaType<typeof stockMovementSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const StockMovement = mongoose.model("StockMovement", stockMovementSchema);

const stockCountSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    status: {
      type: String,
      enum: ["draft", "in_progress", "completed", "cancelled"],
      default: "draft",
    },
    lines: [
      {
        variantId: { type: Schema.Types.ObjectId, ref: "ProductVariant", required: true },
        expectedQty: { type: Number, required: true },
        countedQty: { type: Number },
        varianceQty: { type: Number },
      },
    ],
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    completedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type StockCountDoc = InferSchemaType<typeof stockCountSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const StockCount = mongoose.model("StockCount", stockCountSchema);

const stockTransferSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    fromBranchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    toBranchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    status: {
      type: String,
      enum: ["draft", "approved", "dispatched", "received", "cancelled"],
      default: "draft",
      index: true,
    },
    lines: [
      {
        variantId: { type: Schema.Types.ObjectId, ref: "ProductVariant", required: true },
        qty: { type: Number, required: true, min: 0.001 },
      },
    ],
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    dispatchedBy: { type: Schema.Types.ObjectId, ref: "User" },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    dispatchedAt: { type: Date },
    receivedAt: { type: Date },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

stockTransferSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export type StockTransferDoc = InferSchemaType<typeof stockTransferSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const StockTransfer = mongoose.model("StockTransfer", stockTransferSchema);
