import mongoose, { Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", default: null, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    pinHash: { type: String },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    roleIds: [{ type: Schema.Types.ObjectId, ref: "Role" }],
    branchIds: [{ type: Schema.Types.ObjectId, ref: "Branch" }],
    status: { type: String, enum: ["active", "invited", "disabled"], default: "active" },
    mfaEnabled: { type: Boolean, default: false },
    sessionVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, status: 1 });

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export const User = mongoose.model("User", userSchema);
