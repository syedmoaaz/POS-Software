# API Module List (`/api/v1`)

Conventions:
- REST, JSON, versioned prefix `/api/v1`
- Auth via HTTP-only cookies
- Pagination: `?page=&limit=&sort=&q=`
- Errors: `{ error: { code, message, details?, requestId } }`
- Idempotency: `Idempotency-Key` header on checkout, payments, sync

---

## Auth
| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/login` | email/password |
| POST | `/auth/login/pin` | terminal PIN |
| POST | `/auth/logout` | |
| POST | `/auth/refresh` | rotate refresh |
| POST | `/auth/forgot-password` | |
| POST | `/auth/reset-password` | |
| GET | `/auth/me` | user + permissions + tenant |
| GET | `/auth/sessions` | |
| DELETE | `/auth/sessions/:id` | |
| POST | `/auth/mfa/setup` | owner optional |
| POST | `/auth/mfa/verify` | |

## Onboarding (owner)
| POST | `/onboarding/business` |
| POST | `/onboarding/branch` |
| POST | `/onboarding/register` |
| PATCH | `/onboarding/settings` |
| POST | `/onboarding/invite` |

## Tenancy context
| GET | `/context` | tenant, branches, plan limits, feature flags |
| GET/PATCH | `/settings/business` |
| CRUD | `/branches` |
| CRUD | `/registers` |
| CRUD | `/users` |
| CRUD | `/roles` |
| GET | `/permissions` | catalog |

## Catalogue
| CRUD | `/categories`, `/brands`, `/units` |
| CRUD | `/products` |
| CRUD | `/products/:id/variants` |
| CRUD | `/barcodes` |
| POST | `/products/import` |
| GET | `/products/export` |
| POST | `/products/bulk-prices` |
| GET | `/products/:id/history` |
| GET | `/catalogue/search` | POS search name/sku/barcode |

## Inventory
| GET | `/inventory` | by branch |
| GET | `/inventory/:variantId` |
| GET | `/stock-movements` |
| POST | `/stock-adjustments` |
| CRUD | `/stock-counts` |
| POST | `/stock-counts/:id/complete` |
| CRUD | `/stock-transfers` |
| POST | `/stock-transfers/:id/approve\|dispatch\|receive` |
| GET | `/inventory/alerts/low-stock` |
| GET | `/inventory/reorder-suggestions` |

## Suppliers & purchasing
| CRUD | `/suppliers` |
| GET | `/suppliers/:id/ledger` |
| CRUD | `/purchase-orders` |
| POST | `/purchase-orders/:id/order\|cancel` |
| CRUD | `/purchases` |
| POST | `/purchases/:id/receive` |
| POST | `/supplier-payments` |
| POST | `/purchase-returns` |

## Customers
| CRUD | `/customers` |
| GET | `/customers/:id/ledger` |
| GET | `/customers/:id/statement` |
| POST | `/customers/:id/payments` | settle debt / advance |
| POST | `/loyalty/earn\|redeem` | if enabled |

## Sales / POS
| GET | `/sales` |
| GET | `/sales/:id` |
| GET | `/sales/by-receipt/:receiptNo` |
| POST | `/sales/checkout` | **transactional + idempotent** |
| POST | `/sales/held` | hold |
| GET | `/sales/held` |
| POST | `/sales/held/:id/resume` |
| DELETE | `/sales/held/:id` |
| POST | `/sales/:id/void` | permissioned |

## Returns
| POST | `/returns` |
| POST | `/returns/:id/approve` |
| GET | `/returns` |

## Register
| POST | `/registers/:id/sessions/open` |
| POST | `/register-sessions/:id/cash-in\|cash-out` |
| POST | `/register-sessions/:id/close` |
| GET | `/register-sessions/:id` |
| GET | `/register-sessions/:id/x-report` |
| GET | `/register-sessions/:id/z-report` |
| POST | `/registers/:id/open-drawer` | audited |

## Expenses
| CRUD | `/expenses` |
| POST | `/expenses/:id/approve` |
| GET | `/expense-categories` |

## Reports
| GET | `/reports/dashboard` |
| GET | `/reports/sales` |
| GET | `/reports/sales-by-*` |
| GET | `/reports/payments` |
| GET | `/reports/profit` | gated |
| GET | `/reports/inventory/*` |
| GET | `/reports/purchases` |
| GET | `/reports/payables` |
| GET | `/reports/receivables` |
| GET | `/reports/expenses` |
| GET | `/reports/tax` |
| GET | `/reports/returns` |
| GET | `/reports/employees` |
| GET | `/reports/export` | pdf/xlsx/csv |

## Offline sync
| POST | `/sync/sales` | batch idempotent |
| GET | `/sync/catalogue` | delta pull |
| GET | `/sync/status` |

## Hardware / print
| CRUD | `/hardware/devices` |
| POST | `/print-jobs` |
| GET | `/print-jobs/:id` |
| POST | `/print-jobs/:id/retry` |

## Super Admin
| GET | `/admin/metrics` |
| CRUD | `/admin/tenants` |
| POST | `/admin/tenants/:id/activate\|suspend\|cancel` |
| CRUD | `/admin/plans` |
| PATCH | `/admin/subscriptions/:id` |
| POST | `/admin/impersonate` | audited |
| GET | `/admin/audit-logs` |
| GET | `/admin/health` |

## Media
| POST | `/media/upload` | validated image → Cloudinary/S3 |

---

## Middleware stack (order)

1. requestId  
2. helmet / cors  
3. rateLimit  
4. cookieParser  
5. auth (optional → required)  
6. tenantContext  
7. permission  
8. validate(zod)  
9. controller  
10. errorHandler
