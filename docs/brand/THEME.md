# Brand & Theme — Master Solutions POS

## Logo

- Canonical source: [`brand/Master Solutions Pixel Monogram Logo.png`](../../brand/Master%20Solutions%20Pixel%20Monogram%20Logo.png)
- App asset: `apps/web/public/logo.png`
- Use throughout: login, sidebar, receipts preview, favicon/PWA, Super Admin header

## Theme direction (owner decision)

**White + Red** commercial POS — clean light UI, red for brand and primary actions. Not dark mode by default. Not purple/gradient “AI dashboard” styling.

## Color tokens (from logo sampling)

| Token | Hex | Usage |
|-------|-----|--------|
| `--brand-red` | `#E00818` | Primary buttons, active nav, focus rings, key CTAs |
| `--brand-red-hover` | `#C00714` | Hover/pressed primary |
| `--brand-red-muted` | `#FDECEC` | Soft selected rows, badges bg |
| `--ink` | `#1A1A1A` | Primary text |
| `--ink-muted` | `#5C5C5C` | Secondary text |
| `--border` | `#E5E5E5` | Dividers, inputs |
| `--surface` | `#FFFFFF` | App background, panels |
| `--surface-subtle` | `#F7F7F7` | Sidebar/table zebra/subtle sections |
| `--success` | `#15803D` | Success (not brand) |
| `--warning` | `#B45309` | Warnings |
| `--danger` | `#E00818` | Errors/destructive (aligned with brand red) |

## UI rules

- Dominant canvas: white / off-white
- Red used sparingly for hierarchy (primary actions, active states, critical alerts)
- Sharp, professional geometry (moderate radii, not pill-heavy)
- Dense POS screens; calmer spacing on reports/settings
- Logo always visible in app chrome and auth screens

## Typography direction

- Geometric sans for UI (complement logo; avoid Inter/Roboto/Arial defaults where practical)
- Proposed: **Plus Jakarta Sans** or **Manrope** for UI; monospace for SKUs/receipts numbers
