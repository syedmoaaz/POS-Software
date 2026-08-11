/** Detect platform Super Admin portal host (e.g. superadmin.example.com). */
export function isSuperAdminHost(hostname = typeof window !== "undefined" ? window.location.hostname : "") {
  const h = hostname.toLowerCase();
  if (import.meta.env.VITE_PORTAL === "superadmin") return true;
  if (h === "superadmin.localhost" || h === "superadmin.local") return true;
  return h.startsWith("superadmin.");
}

export function portalHomePath() {
  return isSuperAdminHost() ? "/admin" : "/dashboard";
}
