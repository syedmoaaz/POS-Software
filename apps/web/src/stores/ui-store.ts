import { create } from "zustand";

type UiState = {
  online: boolean;
  sidebarOpen: boolean;
  commandOpen: boolean;
  setOnline: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;
  setCommandOpen: (v: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  sidebarOpen: true,
  commandOpen: false,
  setOnline: (v) => set({ online: v }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setCommandOpen: (v) => set({ commandOpen: v }),
}));
