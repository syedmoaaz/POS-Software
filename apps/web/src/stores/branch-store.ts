import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BRANCHES, REGISTERS } from "@/mocks/data";

type BranchState = {
  branchId: string;
  registerId: string;
  setBranchId: (id: string) => void;
  setRegisterId: (id: string) => void;
};

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      branchId: BRANCHES[0].id,
      registerId: REGISTERS[0].id,
      setBranchId: (id) => {
        const reg = REGISTERS.find((r) => r.branchId === id) ?? REGISTERS[0];
        set({ branchId: id, registerId: reg.id });
      },
      setRegisterId: (id) => set({ registerId: id }),
    }),
    { name: "mms-branch" },
  ),
);

export function useActiveBranch() {
  const branchId = useBranchStore((s) => s.branchId);
  return BRANCHES.find((b) => b.id === branchId) ?? BRANCHES[0];
}

export function useActiveRegister() {
  const registerId = useBranchStore((s) => s.registerId);
  return REGISTERS.find((r) => r.id === registerId) ?? REGISTERS[0];
}
