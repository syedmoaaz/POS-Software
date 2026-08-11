import mongoose from "mongoose";
import { AppError } from "../lib/errors.js";
import {
  BranchInventory,
  StockMovement,
  type StockMovementType,
} from "../models/inventory.model.js";

export type ApplyMovementInput = {
  tenantId: string;
  branchId: string;
  variantId: string;
  type: StockMovementType;
  qtyDelta: number;
  unitCostMinor?: number;
  refType?: string;
  refId?: string;
  note?: string;
  createdBy: string;
  allowNegative?: boolean;
  session?: mongoose.ClientSession | null;
};

/** Apply a stock movement and update BranchInventory projection in the same session. */
export async function applyStockMovement(input: ApplyMovementInput) {
  if (input.qtyDelta === 0) {
    throw new AppError(400, "Quantity delta cannot be zero", "INVALID_QTY");
  }

  const filter = {
    tenantId: input.tenantId,
    branchId: input.branchId,
    variantId: input.variantId,
  };

  let inv = await BranchInventory.findOne(filter).session(input.session ?? null);
  if (!inv) {
    const created = await BranchInventory.create(
      [
        {
          ...filter,
          qtyOnHand: 0,
          qtyReserved: 0,
          qtyDamaged: 0,
          qtyExpired: 0,
          avgCostMinor: input.unitCostMinor ?? 0,
        },
      ],
      input.session ? { session: input.session } : undefined,
    );
    inv = created[0];
  }

  const nextQty = inv.qtyOnHand + input.qtyDelta;
  if (!input.allowNegative && nextQty < -0.0001) {
    throw new AppError(400, "Insufficient stock", "INSUFFICIENT_STOCK", {
      variantId: input.variantId,
      available: inv.qtyOnHand,
      requestedDelta: input.qtyDelta,
    });
  }

  // Weighted average cost on inbound stock with cost
  if (input.qtyDelta > 0 && typeof input.unitCostMinor === "number") {
    const currentValue = inv.qtyOnHand * inv.avgCostMinor;
    const inboundValue = input.qtyDelta * input.unitCostMinor;
    const newQty = Math.max(nextQty, 0.0001);
    inv.avgCostMinor = Math.round((currentValue + inboundValue) / newQty);
  }

  if (input.type === "damage" && input.qtyDelta < 0) {
    inv.qtyDamaged += Math.abs(input.qtyDelta);
  }

  inv.qtyOnHand = nextQty;
  await inv.save(input.session ? { session: input.session } : undefined);

  const [movement] = await StockMovement.create(
    [
      {
        tenantId: input.tenantId,
        branchId: input.branchId,
        variantId: input.variantId,
        type: input.type,
        qtyDelta: input.qtyDelta,
        unitCostMinor: input.unitCostMinor,
        qtyAfter: nextQty,
        refType: input.refType,
        refId: input.refId,
        note: input.note ?? "",
        createdBy: input.createdBy,
      },
    ],
    input.session ? { session: input.session } : undefined,
  );

  return { inventory: inv, movement };
}

export async function withTransaction<T>(fn: (session: mongoose.ClientSession | null) => Promise<T>) {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    try {
      await session.withTransaction(async () => {
        result = await fn(session);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Local standalone MongoDB (non-replica) cannot run multi-doc transactions.
      if (msg.includes("replica set") || msg.includes("Transaction numbers")) {
        result = await fn(null);
      } else {
        throw err;
      }
    }
    return result;
  } finally {
    await session.endSession();
  }
}
