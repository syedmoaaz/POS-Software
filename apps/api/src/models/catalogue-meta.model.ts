import mongoose, { Schema, type InferSchemaType } from "mongoose";

const categorySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

categorySchema.index({ tenantId: 1, name: 1 });

export type CategoryDoc = InferSchemaType<typeof categorySchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Category = mongoose.model("Category", categorySchema);

const brandSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

brandSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export type BrandDoc = InferSchemaType<typeof brandSchema> & { _id: mongoose.Types.ObjectId };
export const Brand = mongoose.model("Brand", brandSchema);

const unitSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, lowercase: true },
    allowsDecimal: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

unitSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export type UnitDoc = InferSchemaType<typeof unitSchema> & { _id: mongoose.Types.ObjectId };
export const Unit = mongoose.model("Unit", unitSchema);
