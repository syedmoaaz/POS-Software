import mongoose, { Schema, type InferSchemaType } from "mongoose";

const refreshSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jti: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String },
    ip: { type: String },
  },
  { timestamps: true },
);

refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshSessionDoc = InferSchemaType<typeof refreshSessionSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const RefreshSession = mongoose.model("RefreshSession", refreshSessionSchema);
