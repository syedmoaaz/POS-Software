# Folder Structure

```
mega-modern-pos/
├── apps/
│   ├── web/                          # React + Vite + Tailwind + shadcn
│   │   ├── public/
│   │   │   ├── logo.svg              # Official logo (to be supplied)
│   │   │   └── icons/                # PWA icons
│   │   ├── src/
│   │   │   ├── app/                  # routes, providers, layouts
│   │   │   │   ├── routes/
│   │   │   │   │   ├── (auth)/
│   │   │   │   │   ├── (tenant)/     # business portal + POS
│   │   │   │   │   └── (super-admin)/
│   │   │   │   ├── layouts/
│   │   │   │   └── providers/
│   │   │   ├── features/             # domain feature modules
│   │   │   │   ├── auth/
│   │   │   │   ├── pos/
│   │   │   │   ├── products/
│   │   │   │   ├── inventory/
│   │   │   │   ├── customers/
│   │   │   │   ├── suppliers/
│   │   │   │   ├── purchasing/
│   │   │   │   ├── sales/
│   │   │   │   ├── returns/
│   │   │   │   ├── register/
│   │   │   │   ├── expenses/
│   │   │   │   ├── reports/
│   │   │   │   ├── settings/
│   │   │   │   ├── offline/
│   │   │   │   └── super-admin/
│   │   │   ├── components/           # shared UI (shadcn wrappers)
│   │   │   ├── hooks/
│   │   │   ├── lib/                  # api client, query keys, formatters
│   │   │   ├── stores/               # zustand: cart, register, ui
│   │   │   ├── mocks/                # prototype mock data + handlers
│   │   │   ├── styles/
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   ├── api/                          # Express + Mongoose
│   │   ├── src/
│   │   │   ├── config/               # env (zod), cors, db
│   │   │   ├── modules/              # feature modules
│   │   │   │   ├── auth/
│   │   │   │   ├── tenants/
│   │   │   │   ├── users/
│   │   │   │   ├── rbac/
│   │   │   │   ├── branches/
│   │   │   │   ├── products/
│   │   │   │   ├── inventory/
│   │   │   │   ├── sales/
│   │   │   │   ├── payments/
│   │   │   │   ├── returns/
│   │   │   │   ├── customers/
│   │   │   │   ├── suppliers/
│   │   │   │   ├── purchasing/
│   │   │   │   ├── register/
│   │   │   │   ├── expenses/
│   │   │   │   ├── reports/
│   │   │   │   ├── settings/
│   │   │   │   ├── sync/             # offline sync
│   │   │   │   ├── hardware/
│   │   │   │   └── super-admin/
│   │   │   ├── middleware/           # auth, tenant, rbac, rateLimit, error
│   │   │   ├── lib/                  # logger, money, ids, transactions
│   │   │   ├── db/                   # connection, seed
│   │   │   ├── types/
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   └── print-bridge/                 # Electron/local agent
│       ├── src/
│       │   ├── printer/
│       │   ├── drawer/
│       │   ├── server/               # localhost API
│       │   └── pairing/
│       └── package.json
│
├── packages/
│   ├── shared/
│   │   ├── src/
│   │   │   ├── permissions.ts
│   │   │   ├── money.ts
│   │   │   ├── schemas/              # zod DTOs shared FE/BE
│   │   │   ├── constants.ts
│   │   │   └── index.ts
│   │   └── package.json
│   ├── eslint-config/
│   └── tsconfig/
│
├── docs/
│   ├── architecture/
│   ├── phases/
│   ├── api/                          # OpenAPI later
│   ├── deployment.md
│   └── security-checklist.md
│
├── .env.example
├── .gitignore
├── package.json                      # pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── README.md
└── prettier.config.* 
```

## Module convention (API)

Each module:

```
modules/<name>/
  <name>.routes.ts
  <name>.controller.ts
  <name>.service.ts
  <name>.repository.ts
  <name>.model.ts
  <name>.schema.ts          # zod request/response
  <name>.types.ts
```

## Frontend feature convention

```
features/<name>/
  pages/
  components/
  hooks/
  api.ts                    # tanstack query fns (or mock)
  types.ts
```
