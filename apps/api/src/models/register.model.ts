import mongoose, { Schema, type InferSchemaType } from "mongoose";

const registerSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    isActive: { type: Boolean, default: true },
    printerDeviceId: { type: Schema.Types.ObjectId, ref: "HardwareDevice" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

registerSchema.index({ tenantId: 1, branchId: 1, code: 1 }, { unique: true });

export type RegisterDoc = InferSchemaType<typeof registerSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Register = mongoose.model("Register", registerSchema);
