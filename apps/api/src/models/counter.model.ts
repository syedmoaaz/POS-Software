import mongoose, { Schema, type InferSchemaType } from "mongoose";

const counterSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    registerId: { type: Schema.Types.ObjectId, ref: "Register" },
    key: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true },
);

counterSchema.index(
  { tenantId: 1, branchId: 1, registerId: 1, key: 1 },
  { unique: true },
);

export type CounterDoc = InferSchemaType<typeof counterSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Counter = mongoose.model("Counter", counterSchema);

/** Atomically increment and return next sequence. */
export async function nextSequence(
  input: {
    tenantId: string;
    key: string;
    branchId?: string;
    registerId?: string;
  },
  session?: mongoose.ClientSession | null,
) {
  const filter: Record<string, unknown> = {
    tenantId: input.tenantId,
    key: input.key,
    branchId: input.branchId ?? null,
    registerId: input.registerId ?? null,
  };

  const doc = await Counter.findOneAndUpdate(
    filter,
    { $inc: { seq: 1 } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      ...(session ? { session } : {}),
    },
  );

  return doc!.seq;
}
