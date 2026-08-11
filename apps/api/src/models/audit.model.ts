import mongoose, { Schema, type InferSchemaType } from "mongoose";

const loginHistorySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", default: null, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    method: { type: String, enum: ["password", "pin", "refresh"], required: true },
    success: { type: Boolean, required: true },
    ip: { type: String },
    userAgent: { type: String },
    message: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type LoginHistoryDoc = InferSchemaType<typeof loginHistorySchema> & {
  _id: mongoose.Types.ObjectId;
};
export const LoginHistory = mongoose.model("LoginHistory", loginHistorySchema);

const auditLogSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", default: null, index: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String },
    entityId: { type: String },
    meta: { type: Schema.Types.Mixed },
    ip: { type: String },
    requestId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ tenantId: 1, createdAt: -1 });

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
