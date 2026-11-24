import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Permission, RoleKey } from "@mms/shared";
import type { AuthBranch, AuthRegister, AuthTenant, AuthUser } from "@/lib/catalog-types";
import {
  fetchMe,
  loginPassword,
  loginPin,
  logoutApi,
  mapMe,
} from "@/lib/domain-api";
import { ApiError } from "@/lib/api";

type AuthState = {
  user: AuthUser | null;
  tenant: AuthTenant | null;
  branches: AuthBranch[];
  registers: AuthRegister[];
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  loginWithPin: (pin: string, tenantSlug?: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  hydrateFromSession: () => Promise<void>;
  switchRole: (role: RoleKey) => void;
  hasPermission: (permission: Permission) => boolean;
};

function applyMapped(
  set: (partial: Partial<AuthState>) => void,
  mapped: ReturnType<typeof mapMe>,
) {
  set({
    user: mapped.user,
    tenant: mapped.tenant,
    branches: mapped.branches,
    registers: mapped.registers,
    isAuthenticated: true,
  });
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tenant: null,
      branches: [],
      registers: [],
      isAuthenticated: false,
      login: async (email, password) => {
        try {
          const res = await loginPassword(email, password);
          applyMapped(set, mapMe(res.data));
          return { ok: true };
        } catch (err) {
          const message =
            err instanceof ApiError ? err.message : "Invalid email or password";
          return { ok: false, message };
        }
      },
      loginWithPin: async (pin, tenantSlug) => {
        try {
          const res = await loginPin(pin, tenantSlug);
          applyMapped(set, mapMe(res.data));
          return { ok: true };
        } catch (err) {
          const message = err instanceof ApiError ? err.message : "Invalid PIN";
          return { ok: false, message };
        }
      },
      logout: async () => {
        try {
          await logoutApi();
        } catch {
          // clear local session anyway
        }
        set({
          user: null,
          tenant: null,
          branches: [],
          registers: [],
          isAuthenticated: false,
        });
      },
      hydrateFromSession: async () => {
        if (!get().isAuthenticated) return;
        try {
          // apiJson auto-refreshes expired access cookies once via /auth/refresh
          const res = await fetchMe();
          applyMapped(set, mapMe(res.data));
        } catch {
          // Session truly gone — force login again
          set({
            user: null,
            tenant: null,
            branches: [],
            registers: [],
            isAuthenticated: false,
          });
        }
      },
      switchRole: () => {
        // Role switching is demo-only; live API uses real RBAC.
      },
      hasPermission: (permission) => {
        const user = get().user;
        if (!user) return false;
        return user.permissions.includes(permission);
      },
    }),
    {
      name: "mms-auth",
      partialize: (s) => ({
        user: s.user,
        tenant: s.tenant,
        branches: s.branches,
        registers: s.registers,
        isAuthenticated: s.isAuthenticated,
      }),
    },
  ),
);
