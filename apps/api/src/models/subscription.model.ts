import mongoose, { Schema, type InferSchemaType } from "mongoose";

const planSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    name: { type: String, required: true },
    priceMinor: { type: Number, required: true },
    interval: { type: String, enum: ["month", "year"], default: "month" },
    limits: {
      maxBranches: { type: Number, required: true },
      maxUsers: { type: Number, required: true },
      maxProducts: { type: Number, required: true },
      maxRegisters: { type: Number, required: true },
    },
    features: [{ type: String }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type SubscriptionPlanDoc = InferSchemaType<typeof planSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const SubscriptionPlan = mongoose.model("SubscriptionPlan", planSchema);

const subscriptionSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
    status: {
      type: String,
      enum: ["trialing", "active", "past_due", "cancelled", "suspended"],
      default: "trialing",
      index: true,
    },
    trialEndsAt: { type: Date },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date },
    cancelAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true },
);

subscriptionSchema.index({ tenantId: 1, status: 1 });

export type SubscriptionDoc = InferSchemaType<typeof subscriptionSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Subscription = mongoose.model("Subscription", subscriptionSchema);
