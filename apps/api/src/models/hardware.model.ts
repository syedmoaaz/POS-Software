import mongoose, { Schema, type InferSchemaType } from "mongoose";

const hardwareDeviceSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    registerId: { type: Schema.Types.ObjectId, ref: "Register" },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["printer", "drawer", "scanner"],
      required: true,
      index: true,
    },
    connection: {
      kind: {
        type: String,
        enum: ["bridge", "network", "browser"],
        default: "bridge",
      },
      bridgeUrl: { type: String, default: "http://127.0.0.1:9100" },
      host: { type: String, default: "" },
      port: { type: Number },
      paperWidthMm: { type: Number, enum: [58, 80], default: 80 },
    },
    bridgeId: { type: String, default: "" },
    pairingTokenHash: { type: String, default: "" },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date },
    notes: { type: String, default: "" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

hardwareDeviceSchema.index({ tenantId: 1, branchId: 1, type: 1 });

export type HardwareDeviceDoc = InferSchemaType<typeof hardwareDeviceSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const HardwareDevice = mongoose.model("HardwareDevice", hardwareDeviceSchema);

const printJobSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    deviceId: { type: Schema.Types.ObjectId, ref: "HardwareDevice", required: true, index: true },
    type: {
      type: String,
      enum: ["receipt", "label", "test", "drawer_kick"],
      required: true,
    },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["queued", "sent", "printing", "done", "failed"],
      default: "queued",
      index: true,
    },
    error: { type: String, default: "" },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    bridgeJobId: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    completedAt: { type: Date },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

printJobSchema.index({ tenantId: 1, createdAt: -1 });
printJobSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export type PrintJobDoc = InferSchemaType<typeof printJobSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const PrintJob = mongoose.model("PrintJob", printJobSchema);
