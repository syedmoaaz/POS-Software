import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Permission, RoleKey } from "@mms/shared";
import { USERS, type DemoUser } from "@/mocks/data";

type AuthState = {
  user: DemoUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => { ok: boolean; message?: string };
  loginWithPin: (pin: string) => { ok: boolean; message?: string };
  logout: () => void;
  switchRole: (role: RoleKey) => void;
  hasPermission: (permission: Permission) => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      login: (email, password) => {
        const user = USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user || password.length < 4) {
          return { ok: false, message: "Invalid email or password" };
        }
        set({ user, isAuthenticated: true });
        return { ok: true };
      },
      loginWithPin: (pin) => {
        const user = USERS.find((u) => u.pin === pin);
        if (!user) return { ok: false, message: "Invalid PIN" };
        set({ user, isAuthenticated: true });
        return { ok: true };
      },
      logout: () => set({ user: null, isAuthenticated: false }),
      switchRole: (role) => {
        const user = USERS.find((u) => u.role === role);
        if (user) set({ user, isAuthenticated: true });
      },
      hasPermission: (permission) => {
        const user = get().user;
        if (!user) return false;
        return user.permissions.includes(permission);
      },
    }),
    { name: "mms-auth" },
  ),
);
