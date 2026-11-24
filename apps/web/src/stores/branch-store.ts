import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuthStore } from "@/stores/auth-store";

type BranchState = {
  branchId: string;
  registerId: string;
  setBranchId: (id: string) => void;
  setRegisterId: (id: string) => void;
  syncFromAuth: () => void;
};

export const useBranchStore = create<BranchState>()(
  persist(
    (set, get) => ({
      branchId: "",
      registerId: "",
      setBranchId: (id) => {
        const registers = useAuthStore.getState().registers;
        const reg = registers.find((r) => r.branchId === id) ?? registers[0];
        set({ branchId: id, registerId: reg?.id ?? "" });
      },
      setRegisterId: (id) => set({ registerId: id }),
      syncFromAuth: () => {
        const { branches, registers } = useAuthStore.getState();
        if (!branches.length) return;
        const current = get();
        const branchOk = branches.some((b) => b.id === current.branchId);
        const branchId = branchOk ? current.branchId : branches[0].id;
        const regsForBranch = registers.filter((r) => r.branchId === branchId);
        const registerOk = regsForBranch.some((r) => r.id === current.registerId);
        const registerId = registerOk
          ? current.registerId
          : regsForBranch[0]?.id ?? registers[0]?.id ?? "";
        set({ branchId, registerId });
      },
    }),
    { name: "mms-branch" },
  ),
);

export function useActiveBranch() {
  const branchId = useBranchStore((s) => s.branchId);
  const branches = useAuthStore((s) => s.branches);
  return branches.find((b) => b.id === branchId) ?? branches[0] ?? { id: "", name: "—", code: "—", address: "" };
}

export function useActiveRegister() {
  const registerId = useBranchStore((s) => s.registerId);
  const registers = useAuthStore((s) => s.registers);
  return registers.find((r) => r.id === registerId) ?? registers[0] ?? { id: "", branchId: "", name: "—", code: "REG" };
}
