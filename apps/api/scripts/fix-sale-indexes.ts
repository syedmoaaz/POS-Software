import mongoose from "mongoose";
import { Sale } from "../src/models/sale.model.js";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/mega_modern_pos");
  console.log(
    "before",
    (await Sale.collection.indexes()).map((i) => ({ name: i.name, unique: i.unique, partial: i.partialFilterExpression })),
  );
  try {
    await Sale.collection.dropIndex("tenantId_1_offlineId_1");
    console.log("dropped old index");
  } catch (err) {
    console.log("drop skipped:", err instanceof Error ? err.message : err);
  }
  await Sale.syncIndexes();
  console.log(
    "after",
    (await Sale.collection.indexes()).map((i) => ({ name: i.name, unique: i.unique, partial: i.partialFilterExpression })),
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
