import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { PERMISSIONS, type Permission } from "@mms/shared";

const roleSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", default: null, index: true },
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true },
    isSystem: { type: Boolean, default: false },
    permissions: [{ type: String, enum: [...PERMISSIONS] }],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

roleSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export type RoleDoc = InferSchemaType<typeof roleSchema> & { _id: mongoose.Types.ObjectId };
export const Role = mongoose.model("Role", roleSchema);
