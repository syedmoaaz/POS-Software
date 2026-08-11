# Mega Modern Solutions POS — Development Plan (Phase 0)

**Repository status:** Empty greenfield. No existing code to migrate.  
**Current gate:** Frontend prototype (Phases 1–4) ready for review. Backend paused until approval.

## Document index

| Doc | Path |
|-----|------|
| Overview | [docs/architecture/00-OVERVIEW.md](docs/architecture/00-OVERVIEW.md) |
| Database | [docs/architecture/01-DATABASE.md](docs/architecture/01-DATABASE.md) |
| Folders | [docs/architecture/02-FOLDER-STRUCTURE.md](docs/architecture/02-FOLDER-STRUCTURE.md) |
| Permissions | [docs/architecture/03-PERMISSIONS.md](docs/architecture/03-PERMISSIONS.md) |
| API modules | [docs/architecture/04-API-MODULES.md](docs/architecture/04-API-MODULES.md) |
| Navigation | [docs/architecture/05-NAVIGATION.md](docs/architecture/05-NAVIGATION.md) |
| Phases | [docs/architecture/06-PHASES.md](docs/architecture/06-PHASES.md) |

---

## Recommended defaults (confirm or change)

| Topic | Proposed default |
|-------|------------------|
| Monorepo | pnpm + Turborepo |
| Client state | Zustand for POS/cart; TanStack Query for server/mock server state |
| Money | Integer minor units (paisa); PKR default |
| Auth | JWT in HTTP-only cookies; Argon2id |
| Media | Cloudinary first (S3-compatible adapter later) |
| UI | shadcn/ui + Tailwind; **white + red** theme from logo (`#E00818`) |
| Logo | `brand/mega-modern-solutions-logo.jpeg` (see `docs/brand/THEME.md`) |
| App hosting | Web on Vercel; API on Railway |
| Super Admin | Same `apps/web`, route prefix `/admin`, hard role separation |
| Prototype data | MSW or in-app mock repositories with a demo role switcher |
| Print bridge | Separate `apps/print-bridge` (Electron), not in Phase 1–4 UI beyond settings mock |

---

## Locked decisions

- Logo received and stored at `brand/mega-modern-solutions-logo.jpeg`
- Theme: **white + red** (brand red `#E00818`) — details in [`docs/brand/THEME.md`](docs/brand/THEME.md)

## Decisions still needing your approval

1. **Confirm remaining stack defaults** above (or list changes).
2. **Demo tenant market** — assume Pakistan retail (PKR, `Asia/Karachi`, English UI first)?
3. **Weighted products** — enable in prototype mock (yes recommended)?
4. **Loyalty / store credit / customer credit** — toggleable in Settings (on for demo tenant)?
5. **Impersonation** — include Super Admin “Login as tenant” in Phase 4 UI, or defer until backend?
6. **Package manager** — pnpm OK?
7. **Proceed to Phase 1–4 frontend prototype** — say **“Approve plan — start frontend prototype”** when ready.

---

## What will be built next (after approval)

Phases 1→4 only: complete navigable frontend with realistic mock data, including POS checkout, all major modules, and Super Admin portal. Then **stop** for your UI review before any production API/database work.

---

## How to review this phase

1. Read the docs under `docs/architecture/`.
2. Reply with approvals / changes on the decision table.
3. Drop the logo into the project (or attach it in chat).
4. Explicitly say **“Approve plan — start frontend prototype”** when ready.
