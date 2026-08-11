import mongoose, { Schema, type InferSchemaType } from "mongoose";

const expenseCategorySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

expenseCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

export type ExpenseCategoryDoc = InferSchemaType<typeof expenseCategorySchema> & {
  _id: mongoose.Types.ObjectId;
};
export const ExpenseCategory = mongoose.model("ExpenseCategory", expenseCategorySchema);

const expenseSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    registerId: { type: Schema.Types.ObjectId, ref: "Register" },
    categoryId: { type: Schema.Types.ObjectId, ref: "ExpenseCategory", required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier" },
    amountMinor: { type: Number, required: true, min: 1 },
    method: {
      type: String,
      enum: ["cash", "card", "transfer", "wallet"],
      required: true,
    },
    note: { type: String, default: "" },
    attachmentUrl: { type: String },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },
    expenseDate: { type: Date, default: Date.now, index: true },
    recurring: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

expenseSchema.index({ tenantId: 1, branchId: 1, expenseDate: -1 });

export type ExpenseDoc = InferSchemaType<typeof expenseSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Expense = mongoose.model("Expense", expenseSchema);
