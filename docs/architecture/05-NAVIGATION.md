# Page & Navigation Map

Two shells share the design system but remain route-isolated:

1. **Tenant App** — `/` business operations  
2. **Super Admin** — `/admin` platform operations  

Auth screens are shared layout, separate from app chrome.

---

## Auth & onboarding

| Route | Page | Notes |
|-------|------|-------|
| `/login` | Login | email/password |
| `/login/pin` | PIN login | terminal mode |
| `/forgot-password` | Forgot | |
| `/reset-password` | Reset | token |
| `/onboarding` | Wizard | business → branch → register → tax/receipt → invite |

---

## Tenant shell

**Chrome:** responsive sidebar, top bar (branch selector, global search/command palette, online status, notifications, user menu).

### Dashboard
| `/dashboard` | KPIs, charts, quick actions |

### POS
| `/pos` | Full POS sales screen |
| `/pos/checkout` | Full-screen checkout (optional mode) |
| `/pos/held` | Held sales list |
| `/pos/offline-queue` | Failed/pending sync |

### Sales
| `/sales` | Sales history table |
| `/sales/:id` | Sale detail + reprint/return |

### Returns
| `/returns` | Returns list |
| `/returns/new` | Find sale → return wizard |

### Products
| `/products` | Catalogue |
| `/products/new` | Create |
| `/products/:id` | Detail/edit |
| `/products/import` | CSV/Excel |
| `/categories` | Categories |
| `/brands` | Brands |
| `/labels` | Barcode label print |

### Inventory
| `/inventory` | Branch stock |
| `/inventory/movements` | Ledger |
| `/inventory/counts` | Stock counts |
| `/inventory/transfers` | Transfers |
| `/inventory/alerts` | Low/OOS |

### Suppliers & purchasing
| `/suppliers` | List |
| `/suppliers/:id` | Profile + ledger |
| `/purchase-orders` | POs |
| `/purchase-orders/:id` | PO detail |
| `/purchases` | Purchases/receiving |
| `/purchases/:id` | Detail |
| `/supplier-payments` | Payments |

### Customers
| `/customers` | List |
| `/customers/:id` | Profile, history, credit |
| `/customers/:id/statement` | Statement |

### Register
| `/register` | Session status / open-close |
| `/register/sessions` | History |
| `/register/sessions/:id` | X/Z detail |

### Expenses
| `/expenses` | List + create |
| `/expenses/categories` | Categories |

### Reports
| `/reports` | Hub |
| `/reports/sales` | |
| `/reports/profit` | permission gated |
| `/reports/inventory` | |
| `/reports/purchases` | |
| `/reports/payables` | |
| `/reports/receivables` | |
| `/reports/expenses` | |
| `/reports/tax` | |
| `/reports/returns` | |
| `/reports/employees` | |
| `/reports/registers` | |

### Settings
| `/settings` | Hub |
| `/settings/business` | Profile + logo |
| `/settings/branches` | |
| `/settings/registers` | |
| `/settings/users` | |
| `/settings/roles` | |
| `/settings/taxes` | |
| `/settings/receipts` | |
| `/settings/printers` | hardware |
| `/settings/sales-rules` | returns, stock, negatives |
| `/settings/credit-loyalty` | feature toggles |
| `/settings/notifications` | |
| `/settings/import-export` | |
| `/settings/audit` | |

---

## Super Admin shell

| `/admin/login` | Separate login if needed (same auth, role gate) |
| `/admin` | Metrics dashboard |
| `/admin/tenants` | Tenant list |
| `/admin/tenants/new` | Create |
| `/admin/tenants/:id` | Detail, subscription, notes, actions |
| `/admin/plans` | Plans |
| `/admin/subscriptions` | |
| `/admin/audit-logs` | |
| `/admin/health` | |

---

## Sidebar IA (tenant)

```
Dashboard
POS
Sales
Returns
Catalogue ▸ Products, Categories, Brands, Labels
Inventory ▸ Stock, Movements, Counts, Transfers, Alerts
Purchasing ▸ Suppliers, POs, Purchases, Payments
Customers
Register
Expenses
Reports
Settings
```

Items filtered by permissions. Compact density for POS; default density elsewhere.

---

## Prototype navigation completeness rule

Every nav item opens a real screen with realistic mock data and working local interactions (filters, drawers, dialogs, toasts). No “Coming soon” stubs in the prototype review build.
