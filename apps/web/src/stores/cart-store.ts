import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MoneyMinor, PaymentMethod } from "@mms/shared";
import { uid } from "@/lib/utils";
import type { PosCatalogItem } from "@/lib/catalog-types";

export type CartLine = {
  id: string;
  productId: string; // variantId for API checkout
  name: string;
  sku: string;
  unit: string;
  qty: number;
  unitPriceMinor: MoneyMinor;
  discountMinor: MoneyMinor;
  discountPercent?: number;
  note?: string;
  isWeighted?: boolean;
};

export type HeldCart = {
  id: string;
  label: string;
  lines: CartLine[];
  customerId: string;
  cartDiscountMinor: MoneyMinor;
  cartDiscountPercent: number;
  note: string;
  heldAt: string;
};

export type CompletedSale = {
  id: string;
  receiptNo: string;
  lines: CartLine[];
  customerId: string;
  customerName: string;
  subtotalMinor: MoneyMinor;
  discountMinor: MoneyMinor;
  taxMinor: MoneyMinor;
  totalMinor: MoneyMinor;
  payments: { method: PaymentMethod; amountMinor: MoneyMinor; reference?: string }[];
  changeMinor: MoneyMinor;
  paymentStatus?: string;
  soldAt: string;
};

type CartState = {
  lines: CartLine[];
  customerId: string;
  cartDiscountMinor: MoneyMinor;
  cartDiscountPercent: number;
  note: string;
  held: HeldCart[];
  completed: CompletedSale[];
  allowNegativeStock: boolean;
  taxRateBps: number;
  addProduct: (product: PosCatalogItem, qty?: number) => { ok: boolean; message?: string };
  setQty: (lineId: string, qty: number) => void;
  setLineDiscount: (lineId: string, discountMinor: MoneyMinor) => void;
  setLineDiscountPercent: (lineId: string, percent: number) => void;
  setLinePrice: (lineId: string, unitPriceMinor: MoneyMinor) => void;
  setLineNote: (lineId: string, note: string) => void;
  removeLine: (lineId: string) => void;
  clearCart: () => void;
  setCustomerId: (id: string) => void;
  setCartDiscount: (discountMinor: MoneyMinor) => void;
  setCartDiscountPercent: (percent: number) => void;
  setNote: (note: string) => void;
  holdCart: (label?: string) => void;
  resumeHeld: (id: string) => void;
  deleteHeld: (id: string) => void;
  completeSale: (input: {
    payments: { method: PaymentMethod; amountMinor: MoneyMinor; reference?: string }[];
    customerName: string;
    receiptPrefix: string;
    soldAt?: string;
    receiptNo?: string;
    saleId?: string;
    paymentStatus?: string;
  }) => CompletedSale;
  totals: () => {
    subtotalMinor: MoneyMinor;
    discountMinor: MoneyMinor;
    taxMinor: MoneyMinor;
    totalMinor: MoneyMinor;
  };
};

function effectiveLineDiscount(line: CartLine) {
  if (line.discountPercent && line.discountPercent > 0) {
    const gross = Math.round(line.unitPriceMinor * line.qty);
    return Math.min(gross, Math.round((gross * line.discountPercent) / 100));
  }
  return line.discountMinor;
}

function lineNet(line: CartLine) {
  return Math.max(0, Math.round(line.unitPriceMinor * line.qty) - effectiveLineDiscount(line));
}

function nextReceiptSeq(completed: CompletedSale[]) {
  let max = 477;
  for (const c of completed) {
    const part = c.receiptNo.split("-").pop();
    const n = Number(part);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      customerId: "c_walkin",
      cartDiscountMinor: 0,
      cartDiscountPercent: 0,
      note: "",
      held: [],
      completed: [],
      allowNegativeStock: false,
      taxRateBps: 0,
      addProduct: (product, qty = 1) => {
        const state = get();
        if (!state.allowNegativeStock && product.stock <= 0 && !product.isWeighted) {
          return { ok: false, message: `${product.name} is out of stock` };
        }
        const existing = state.lines.find((l) => l.productId === product.id);
        if (existing) {
          set({
            lines: state.lines.map((l) =>
              l.id === existing.id ? { ...l, qty: Number((l.qty + qty).toFixed(3)) } : l,
            ),
          });
        } else {
          set({
            lines: [
              ...state.lines,
              {
                id: uid("line"),
                productId: product.id,
                name: product.name,
                sku: product.sku,
                unit: product.unit,
                qty,
                unitPriceMinor: product.priceMinor,
                discountMinor: 0,
                discountPercent: 0,
                isWeighted: product.isWeighted,
              },
            ],
          });
        }
        return { ok: true };
      },
      setQty: (lineId, qty) =>
        set({
          lines: get().lines.map((l) =>
            l.id === lineId ? { ...l, qty: Math.max(0.001, Number(qty.toFixed(3))) } : l,
          ),
        }),
      setLineDiscount: (lineId, discountMinor) =>
        set({
          lines: get().lines.map((l) =>
            l.id === lineId ? { ...l, discountMinor, discountPercent: 0 } : l,
          ),
        }),
      setLineDiscountPercent: (lineId, percent) =>
        set({
          lines: get().lines.map((l) =>
            l.id === lineId
              ? { ...l, discountPercent: Math.max(0, Math.min(100, percent)), discountMinor: 0 }
              : l,
          ),
        }),
      setLinePrice: (lineId, unitPriceMinor) =>
        set({
          lines: get().lines.map((l) => (l.id === lineId ? { ...l, unitPriceMinor } : l)),
        }),
      setLineNote: (lineId, note) =>
        set({
          lines: get().lines.map((l) => (l.id === lineId ? { ...l, note } : l)),
        }),
      removeLine: (lineId) => set({ lines: get().lines.filter((l) => l.id !== lineId) }),
      clearCart: () =>
        set({ lines: [], cartDiscountMinor: 0, cartDiscountPercent: 0, note: "", customerId: "c_walkin" }),
      setCustomerId: (id) => set({ customerId: id }),
      setCartDiscount: (discountMinor) =>
        set({ cartDiscountMinor: Math.max(0, discountMinor), cartDiscountPercent: 0 }),
      setCartDiscountPercent: (percent) =>
        set({
          cartDiscountPercent: Math.max(0, Math.min(100, percent)),
          cartDiscountMinor: 0,
        }),
      setNote: (note) => set({ note }),
      holdCart: (label) => {
        const state = get();
        if (!state.lines.length) return;
        const held: HeldCart = {
          id: uid("hold"),
          label: label || `Hold #${state.held.length + 1}`,
          lines: state.lines,
          customerId: state.customerId,
          cartDiscountMinor: state.cartDiscountMinor,
          cartDiscountPercent: state.cartDiscountPercent,
          note: state.note,
          heldAt: new Date().toISOString(),
        };
        set({
          held: [held, ...state.held],
          lines: [],
          cartDiscountMinor: 0,
          cartDiscountPercent: 0,
          note: "",
          customerId: "c_walkin",
        });
      },
      resumeHeld: (id) => {
        const held = get().held.find((h) => h.id === id);
        if (!held) return;
        set({
          lines: held.lines,
          customerId: held.customerId,
          cartDiscountMinor: held.cartDiscountMinor,
          cartDiscountPercent: held.cartDiscountPercent ?? 0,
          note: held.note,
          held: get().held.filter((h) => h.id !== id),
        });
      },
      deleteHeld: (id) => set({ held: get().held.filter((h) => h.id !== id) }),
      completeSale: ({ payments, customerName, receiptPrefix, soldAt, receiptNo, saleId, paymentStatus }) => {
        const t = get().totals();
        const paid = payments.reduce((s, p) => s + p.amountMinor, 0);
        const when = soldAt && !Number.isNaN(new Date(soldAt).getTime()) ? soldAt : new Date().toISOString();
        const sale: CompletedSale = {
          id: saleId || uid("sale"),
          receiptNo: receiptNo || `${receiptPrefix}-${String(nextReceiptSeq(get().completed)).padStart(6, "0")}`,
          lines: get().lines,
          customerId: get().customerId,
          customerName,
          subtotalMinor: t.subtotalMinor,
          discountMinor: t.discountMinor,
          taxMinor: t.taxMinor,
          totalMinor: t.totalMinor,
          payments,
          changeMinor: Math.max(0, paid - t.totalMinor),
          paymentStatus,
          soldAt: when,
        };
        set({
          completed: [sale, ...get().completed],
          lines: [],
          cartDiscountMinor: 0,
          cartDiscountPercent: 0,
          note: "",
          customerId: "c_walkin",
        });
        return sale;
      },
      totals: () => {
        const state = get();
        const lineNets = state.lines.map((l) => lineNet(l));
        const linesSubtotal = lineNets.reduce((s, n) => s + n, 0);
        const linesDiscount = state.lines.reduce((s, l) => s + effectiveLineDiscount(l), 0);
        let cartDiscount = state.cartDiscountMinor;
        if (state.cartDiscountPercent > 0) {
          cartDiscount = Math.round((linesSubtotal * state.cartDiscountPercent) / 100);
        }
        cartDiscount = Math.min(cartDiscount, linesSubtotal);
        const taxable = Math.max(0, linesSubtotal - cartDiscount);
        const taxMinor = Math.round((taxable * state.taxRateBps) / 10000);
        return {
          subtotalMinor: linesSubtotal + linesDiscount,
          discountMinor: cartDiscount + linesDiscount,
          taxMinor,
          totalMinor: taxable + taxMinor,
        };
      },
    }),
    {
      name: "mms-cart",
      partialize: (s) => ({
        lines: s.lines,
        customerId: s.customerId,
        cartDiscountMinor: s.cartDiscountMinor,
        cartDiscountPercent: s.cartDiscountPercent,
        note: s.note,
        held: s.held,
        completed: s.completed,
        allowNegativeStock: s.allowNegativeStock,
      }),
    },
  ),
);
