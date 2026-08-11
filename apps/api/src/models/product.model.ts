import mongoose, { Schema, type InferSchemaType } from "mongoose";

const productSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category" },
    brandId: { type: Schema.Types.ObjectId, ref: "Brand" },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit", required: true },
    taxCategory: { type: String, default: "standard" },
    trackBatch: { type: Boolean, default: false },
    isWeighted: { type: Boolean, default: false },
    isComposite: { type: Boolean, default: false },
    components: [
      {
        variantId: { type: Schema.Types.ObjectId, ref: "ProductVariant" },
        qty: { type: Number, required: true },
      },
    ],
    images: [{ type: String }],
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

productSchema.index({ tenantId: 1, name: "text" });
productSchema.index({ tenantId: 1, status: 1 });

export type ProductDoc = InferSchemaType<typeof productSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Product = mongoose.model("Product", productSchema);

const variantSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, default: "" },
    attributes: { type: Map, of: String, default: {} },
    costMinor: { type: Number, required: true, min: 0 },
    retailPriceMinor: { type: Number, required: true, min: 0 },
    wholesalePriceMinor: { type: Number, default: 0, min: 0 },
    minPriceMinor: { type: Number, default: 0, min: 0 },
    reorderLevel: { type: Number, default: 0, min: 0 },
    preferredSupplierId: { type: Schema.Types.ObjectId, ref: "Supplier" },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

variantSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
variantSchema.index({ tenantId: 1, productId: 1 });

export type ProductVariantDoc = InferSchemaType<typeof variantSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const ProductVariant = mongoose.model("ProductVariant", variantSchema);

const barcodeSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    variantId: { type: Schema.Types.ObjectId, ref: "ProductVariant", required: true, index: true },
    code: { type: String, required: true, trim: true },
    isPrimary: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

barcodeSchema.index({ tenantId: 1, code: 1 }, { unique: true });

export type BarcodeDoc = InferSchemaType<typeof barcodeSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Barcode = mongoose.model("Barcode", barcodeSchema);
