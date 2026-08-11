import mongoose, { Schema, type InferSchemaType } from "mongoose";

const registerSessionSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    registerId: { type: Schema.Types.ObjectId, ref: "Register", required: true, index: true },
    openedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    closedBy: { type: Schema.Types.ObjectId, ref: "User" },
    openingCashMinor: { type: Number, required: true, min: 0 },
    closingCashMinor: { type: Number },
    expectedCashMinor: { type: Number },
    varianceMinor: { type: Number },
    cashSalesMinor: { type: Number, default: 0 },
    cashRefundsMinor: { type: Number, default: 0 },
    cashInMinor: { type: Number, default: 0 },
    cashOutMinor: { type: Number, default: 0 },
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
    blindClose: { type: Boolean, default: false },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

registerSessionSchema.index({ tenantId: 1, registerId: 1, status: 1 });

export type RegisterSessionDoc = InferSchemaType<typeof registerSessionSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const RegisterSession = mongoose.model("RegisterSession", registerSessionSchema);
