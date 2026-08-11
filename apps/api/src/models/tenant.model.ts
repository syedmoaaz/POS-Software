import mongoose, { Schema, type InferSchemaType } from "mongoose";

const tenantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    status: {
      type: String,
      enum: ["trial", "active", "suspended", "cancelled"],
      default: "trial",
      index: true,
    },
    logoUrl: { type: String },
    timezone: { type: String, default: "Asia/Karachi" },
    currency: { type: String, default: "PKR" },
    locale: { type: String, default: "en-PK" },
    taxSettings: {
      taxInclusive: { type: Boolean, default: true },
      defaultRateBps: { type: Number, default: 0 },
    },
    receiptSettings: {
      header: { type: String, default: "" },
      footer: { type: String, default: "Thank you for shopping with us" },
      paperWidthMm: { type: Number, enum: [58, 80], default: 80 },
    },
    featureFlags: {
      loyalty: { type: Boolean, default: true },
      storeCredit: { type: Boolean, default: true },
      customerCredit: { type: Boolean, default: true },
      weightedProducts: { type: Boolean, default: true },
    },
    limits: {
      maxBranches: { type: Number, default: 3 },
      maxUsers: { type: Number, default: 15 },
      maxProducts: { type: Number, default: 10000 },
      maxRegisters: { type: Number, default: 10 },
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type TenantDoc = InferSchemaType<typeof tenantSchema> & { _id: mongoose.Types.ObjectId };
export const Tenant = mongoose.model("Tenant", tenantSchema);
