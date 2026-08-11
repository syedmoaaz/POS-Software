# Permission Matrix

Permissions are string keys. Roles are sets of keys. Tenant owners can clone system roles and customize (within plan).

Legend: **F** = full, **Y** = yes, **C** = conditional/assigned branches, **—** = no, **S** = super-admin only

---

## Permission catalog (initial)

### Platform
- `platform.tenants.manage`
- `platform.plans.manage`
- `platform.metrics.view`
- `platform.impersonate`
- `platform.logs.view`
- `platform.health.view`

### Org / settings
- `settings.view` / `settings.manage`
- `branches.view` / `branches.manage`
- `registers.view` / `registers.manage`
- `users.view` / `users.manage`
- `roles.manage`

### Catalogue
- `products.view` / `products.create` / `products.update` / `products.delete`
- `products.import` / `products.export`
- `products.cost.view`           # cost visibility
- `products.price.override`      # sell below list / custom price

### Inventory
- `inventory.view`
- `inventory.receive`
- `inventory.adjust`
- `inventory.count`
- `inventory.transfer`
- `inventory.transfer.approve`

### Sales / POS
- `pos.access`
- `sales.create`
- `sales.view`
- `sales.discount`
- `sales.void_item`
- `sales.hold`
- `sales.price_override`
- `sales.open_drawer`
- `payments.adjust`

### Returns
- `returns.create`
- `returns.approve`
- `returns.refund`

### Customers
- `customers.view` / `customers.manage`
- `customers.credit.manage`
- `customers.loyalty.manage`

### Suppliers / purchasing
- `suppliers.view` / `suppliers.manage`
- `purchases.view` / `purchases.create` / `purchases.receive` / `purchases.approve`
- `purchases.pay`

### Register / cash
- `register.open`
- `register.close`
- `register.cash_in_out`
- `register.blind_close`
- `register.x_report`
- `register.z_report`

### Expenses
- `expenses.view` / `expenses.create` / `expenses.approve`

### Reports
- `reports.sales`
- `reports.inventory`
- `reports.purchases`
- `reports.customers`
- `reports.expenses`
- `reports.tax`
- `reports.profit`              # COGS / profit (sensitive)
- `reports.employees`
- `reports.export`

### Hardware
- `hardware.manage`
- `hardware.print_test`

---

## Default roles

| Permission | Super Admin | Owner | Manager | Cashier | Inventory |
|------------|:-----------:|:-----:|:-------:|:-------:|:---------:|
| platform.* | S | — | — | — | — |
| settings.manage | — | F | C limited | — | — |
| branches/registers/users/roles | — | F | C view/staff | — | — |
| products.* (no cost) | — | F | Y | view | view |
| products.cost.view | — | Y | C | — | C |
| products.price.override | — | Y | C | C | — |
| inventory.view | — | Y | Y | limited | Y |
| inventory.receive/adjust/count/transfer | — | Y | Y | — | Y |
| inventory.transfer.approve | — | Y | Y | — | — |
| pos.access / sales.create | — | Y | Y | Y | — |
| sales.discount | — | Y | Y | C | — |
| sales.void_item | — | Y | Y | C | — |
| sales.hold | — | Y | Y | Y | — |
| sales.open_drawer | — | Y | Y | C | — |
| returns.* | — | Y | Y | C create | — |
| customers.* | — | Y | Y | view+select | — |
| customers.credit.manage | — | Y | C | — | — |
| suppliers/purchases | — | Y | Y | — | receive C |
| register.open/close | — | Y | Y | Y | — |
| register.cash_in_out | — | Y | Y | C | — |
| expenses | — | Y | Y | C create | — |
| reports.sales/inventory… | — | Y | Y | limited | inventory |
| reports.profit | — | Y | C | — | — |
| reports.export | — | Y | C | — | C |

Cashier must **not** see profit or cost unless explicitly granted `products.cost.view` / `reports.profit`.

---

## Enforcement layers

1. **UI** — hide/disable controls (UX only).  
2. **API middleware** — `requirePermission('sales.discount')`.  
3. **Service** — re-check for sensitive money operations.  
4. **Field projection** — strip `costMinor` from responses without `products.cost.view`.

---

## Branch scoping

- Managers/Cashiers: `user.branchIds` intersection with requested `branchId`.
- Owners: all tenant branches.
- Global branch selector in shell sets active `branchId` for operational screens; reports may allow multi-branch if permitted.
