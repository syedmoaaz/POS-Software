import mongoose, { Schema, type InferSchemaType } from "mongoose";

const branchSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    settings: { type: Schema.Types.Mixed, default: {} },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

branchSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export type BranchDoc = InferSchemaType<typeof branchSchema> & { _id: mongoose.Types.ObjectId };
export const Branch = mongoose.model("Branch", branchSchema);
