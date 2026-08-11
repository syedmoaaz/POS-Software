import { create } from "zustand";
import { persist } from "zustand/middleware";

type RegisterSession = {
  open: boolean;
  openingCashMinor: number;
  openedAt?: string;
  cashInMinor: number;
  cashOutMinor: number;
};

type RegisterState = RegisterSession & {
  openSession: (openingCashMinor: number) => void;
  closeSession: () => void;
  cashIn: (amountMinor: number) => void;
  cashOut: (amountMinor: number) => void;
};

export const useRegisterStore = create<RegisterState>()(
  persist(
    (set, get) => ({
      open: true,
      openingCashMinor: 500000,
      openedAt: new Date().toISOString(),
      cashInMinor: 0,
      cashOutMinor: 0,
      openSession: (openingCashMinor) =>
        set({
          open: true,
          openingCashMinor,
          openedAt: new Date().toISOString(),
          cashInMinor: 0,
          cashOutMinor: 0,
        }),
      closeSession: () => set({ open: false }),
      cashIn: (amountMinor) => set({ cashInMinor: get().cashInMinor + amountMinor }),
      cashOut: (amountMinor) => set({ cashOutMinor: get().cashOutMinor + amountMinor }),
    }),
    { name: "mms-register" },
  ),
);
