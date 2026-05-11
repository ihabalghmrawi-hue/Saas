# Multi-Tenant ERP SaaS — Production Architecture

## Overview

Two Next.js 14 apps sharing one Supabase (PostgreSQL) instance:

| App | URL | Purpose |
|-----|-----|---------|
| `financeapp-admin` | localhost:3001 / admin.yourdomain.com | Super Admin SaaS Control Panel |
| `financeapp` | Vercel / app.yourdomain.com | Tenant ERP Dashboard |

---

## 1. DATABASE SCHEMA — Full Entity Model

See: `supabase/schema-v2.sql`

### Entity Groups

```
SAAS LAYER
  plans → subscriptions → companies
  companies → memberships → auth.users

RBAC LAYER
  companies → roles → role_permissions → permissions
  memberships → role (direct assignment)

ACCOUNTING LAYER
  companies → fiscal_periods
  companies → chart_of_accounts
  fiscal_periods + chart_of_accounts → journal_entries → journal_entry_lines

TREASURY LAYER
  companies → treasury_accounts
  treasury_accounts → treasury_transactions

ERP CORE LAYER
  companies → customers / suppliers / warehouses
  companies → products → product_categories / product_variants
  products + warehouses → inventory / inventory_movements
  customers → sales → sale_items → products
  suppliers → purchases → purchase_items → products
  companies → expenses → expense_categories
  companies → wallets → wallet_transactions

BUSINESS MODULES (isolated per business_type)
  construction: con_projects, con_tasks, con_workers, con_expenses, con_materials, con_payments, con_files
  pharmacy: (uses core products with hasExpiry/hasBatch flags)
  clothing: (uses product_variants with size/color attributes)
  dress_rental: dresses, rental_orders, rental_returns
```

---

## 2. FOLDER STRUCTURE

```
financeapp/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── callback/route.ts
│   │   ├── blocked/page.tsx
│   │   ├── onboarding/
│   │   │   ├── page.tsx                    ← server component guard
│   │   │   └── onboarding-client.tsx
│   │   ├── pricing/page.tsx
│   │   ├── dashboard/
│   │   │   ├── layout.tsx                  ← sidebar, nav, subscription check
│   │   │   ├── page.tsx                    ← dynamic by business_type
│   │   │   ├── accounting/
│   │   │   │   ├── chart-of-accounts/
│   │   │   │   ├── journal/
│   │   │   │   ├── ledger/
│   │   │   │   ├── trial-balance/
│   │   │   │   └── periods/
│   │   │   ├── treasury/
│   │   │   │   ├── accounts/
│   │   │   │   └── transactions/
│   │   │   ├── sales/
│   │   │   ├── purchases/
│   │   │   ├── inventory/
│   │   │   ├── expenses/
│   │   │   ├── reports/
│   │   │   │   ├── profit-loss/
│   │   │   │   ├── balance-sheet/
│   │   │   │   ├── cash-flow/
│   │   │   │   └── sales/
│   │   │   ├── customers/
│   │   │   ├── suppliers/
│   │   │   ├── pos/
│   │   │   ├── returns/
│   │   │   ├── shifts/
│   │   │   ├── warehouses/
│   │   │   ├── construction/              ← business module (gated)
│   │   │   ├── rentals/                   ← business module (gated)
│   │   │   ├── settings/
│   │   │   │   ├── company/
│   │   │   │   ├── users/
│   │   │   │   ├── roles/
│   │   │   │   └── subscription/
│   │   │   └── admin/                     ← owner-only internal admin
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── session/route.ts
│   │       │   └── logout/route.ts
│   │       ├── accounting/
│   │       │   ├── accounts/route.ts
│   │       │   ├── journal/route.ts
│   │       │   ├── ledger/route.ts
│   │       │   └── trial-balance/route.ts
│   │       ├── treasury/
│   │       │   ├── accounts/route.ts
│   │       │   └── transactions/route.ts
│   │       ├── sales/route.ts
│   │       ├── purchases/route.ts
│   │       ├── inventory/route.ts
│   │       ├── expenses/route.ts
│   │       ├── reports/route.ts
│   │       ├── construction/
│   │       │   ├── projects/route.ts
│   │       │   ├── workers/route.ts
│   │       │   └── ...
│   │       ├── onboarding/route.ts
│   │       └── integrity/route.ts
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                  ← browser client
│   │   │   └── server.ts                  ← server client
│   │   ├── accounting/
│   │   │   ├── engine.ts                  ← core posting engine
│   │   │   ├── events.ts                  ← event type definitions
│   │   │   ├── account-map.ts             ← business-type account mappings
│   │   │   └── periods.ts                 ← fiscal period helpers
│   │   ├── treasury/
│   │   │   └── index.ts                   ← balance validation + posting
│   │   ├── rbac/
│   │   │   └── index.ts                   ← permission resolution
│   │   ├── subscription/
│   │   │   └── lifecycle.ts               ← trial/grace/expired logic
│   │   ├── features.ts                    ← business type feature flags
│   │   ├── tenant.ts                      ← getCompanyId / getCurrency
│   │   ├── permissions.ts                 ← canAccess helpers
│   │   ├── rate-limit.ts
│   │   ├── session.ts                     ← PIN session (legacy)
│   │   └── utils.ts
│   ├── services/
│   │   ├── base.service.ts                ← abstract base
│   │   ├── product.service.ts
│   │   ├── sales.service.ts
│   │   ├── subscription.service.ts
│   │   └── accounting.service.ts          ← accounting service
│   ├── repositories/
│   │   ├── base.repository.ts
│   │   ├── product.repository.ts
│   │   ├── customer.repository.ts
│   │   └── subscription.repository.ts
│   ├── modules/
│   │   ├── construction/                  ← module definition
│   │   │   ├── config.ts                  ← routes, permissions, nav
│   │   │   ├── types.ts
│   │   │   └── helpers.ts
│   │   ├── pharmacy/
│   │   │   ├── config.ts
│   │   │   └── types.ts
│   │   ├── clothing/
│   │   │   ├── config.ts
│   │   │   └── types.ts
│   │   └── rental/
│   │       ├── config.ts
│   │       └── types.ts
│   ├── types/
│   │   ├── database.ts                    ← Supabase generated types
│   │   ├── api.ts                         ← API request/response types
│   │   ├── accounting.ts
│   │   └── erp.ts
│   ├── components/
│   │   ├── ui/                            ← base design system
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── table.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── card.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── sidebar.tsx                ← dynamic by business_type
│   │   │   ├── topbar.tsx
│   │   │   ├── subscription-banner.tsx
│   │   │   └── breadcrumb.tsx
│   │   ├── dashboard/
│   │   │   ├── kpi-card.tsx
│   │   │   ├── chart-widget.tsx
│   │   │   └── activity-feed.tsx
│   │   └── modules/
│   │       ├── construction/
│   │       ├── pharmacy/
│   │       └── ...
│   ├── hooks/
│   │   ├── use-company.ts
│   │   ├── use-permissions.ts
│   │   ├── use-subscription.ts
│   │   └── use-realtime.ts
│   ├── providers/
│   │   ├── company-provider.tsx
│   │   ├── theme-provider.tsx
│   │   └── subscription-provider.tsx
│   ├── validators/
│   │   ├── common.ts
│   │   ├── accounting.ts
│   │   ├── sales.ts
│   │   └── tenant.ts
│   └── middleware.ts
├── supabase/
│   ├── schema-v2.sql
│   ├── rls-policies-v2.sql
│   └── migrations/
└── ...

financeapp-admin/
├── src/
│   ├── app/
│   │   ├── page.tsx → redirect to /dashboard
│   │   ├── dashboard/
│   │   │   ├── page.tsx                   ← overview KPIs
│   │   │   ├── companies/page.tsx
│   │   │   ├── subscriptions/page.tsx
│   │   │   ├── plans/page.tsx
│   │   │   ├── analytics/page.tsx
│   │   │   ├── support/page.tsx
│   │   │   └── audit/page.tsx
│   │   └── api/
│   │       └── admin/
│   │           ├── tenants/route.ts
│   │           ├── subscriptions/route.ts
│   │           ├── plans/route.ts
│   │           ├── users/route.ts
│   │           ├── analytics/route.ts
│   │           └── audit/route.ts
│   └── ...
```

---

## 3. AUTHENTICATION & RBAC FLOW

```
User visits /dashboard
    │
    ▼
middleware.ts
    ├── Check Supabase JWT (getUser())
    │       └── No JWT → redirect /auth/login
    ├── Check app-session-active cookie
    │       └── Missing → redirect /auth/login (force re-login on browser close)
    ├── Resolve tenant via memberships table
    │       └── No membership → redirect /onboarding
    ├── Check subscription lifecycle
    │       └── isBlocked → redirect /blocked
    ├── Load role permissions
    ├── Inject headers:
    │       x-tenant-id, x-staff-id, x-staff-role
    │       x-staff-permissions, x-business-type
    │       x-company-name, x-company-currency
    │       x-sub-status, x-sub-plan, x-sub-grace
    └── NextResponse.next()

API routes:
    use requireAuth() → reads headers → validates permission
```

### Roles (per-company, not global)
```
owner     → all permissions, can't be restricted
admin     → all except delete company / manage billing
manager   → operational: sales, purchases, expenses, inventory
accountant → accounting, reports, read-only sales/purchases
cashier   → POS only, no reports, no admin
employee  → minimal: view own data, basic operations
```

### Permission Format
```
resource:action
Examples:
  sales:create
  sales:read
  sales:update
  sales:delete
  accounting:post
  accounting:read
  inventory:adjust
  reports:view
  treasury:transfer
  settings:manage
  users:manage
```

---

## 4. ACCOUNTING ENGINE DESIGN

See: `src/lib/accounting/engine.ts`

### Double-Entry Auto-Posting

Every ERP action triggers `postAccountingEvent()`:

```
Action              DR Account         CR Account
─────────────────────────────────────────────────
Sale (cash)         Cash/Treasury      Sales Revenue
Sale (credit)       Accounts Receivable Sales Revenue
Sale COGS           Cost of Goods Sold Inventory
Payment received    Cash/Treasury      Accounts Receivable
Purchase (cash)     Inventory          Cash/Treasury
Purchase (credit)   Inventory          Accounts Payable
Supplier payment    Accounts Payable   Cash/Treasury
Expense             Expense Account    Cash/Treasury
Salary expense      Salaries Expense   Cash/Treasury
Return (sale)       Sales Revenue      Cash/Treasury
Return COGS         Inventory          Cost of Goods Sold
```

### Chart of Accounts — Default Structure
```
1000  ASSETS
  1100  Current Assets
    1110  Cash & Treasury
    1120  Accounts Receivable
    1130  Inventory
    1140  Prepaid Expenses
  1200  Fixed Assets
    1210  Equipment
    1220  Accumulated Depreciation

2000  LIABILITIES
  2100  Current Liabilities
    2110  Accounts Payable
    2120  Short-term Debt
  2200  Long-term Liabilities

3000  EQUITY
  3100  Owner Capital
  3200  Retained Earnings
  3300  Net Income (current period)

4000  REVENUE
  4001  Sales Revenue
  4002  Service Revenue
  4003  Rental Revenue
  4004  Other Revenue

5000  COST OF GOODS SOLD
  5001  Cost of Sales
  5002  Freight & Import

6000  EXPENSES
  6001  Rent
  6002  Salaries & Wages
  6003  Utilities
  6004  Marketing
  6005  Maintenance
  6006  Supplies
  6007  Transportation
  6008  Miscellaneous
  6009  Construction Labor
  6010  Construction Materials
```

### Fiscal Period Management
```
Each company has fiscal_periods:
  - annual period (e.g. 2025-01-01 to 2025-12-31)
  - monthly sub-periods
  - status: open | closed | locked
  
Only open periods accept new journal entries.
Closed periods can be reopened by owner only.
Locked periods are permanently sealed.
```

---

## 5. TREASURY ENGINE DESIGN

See: `src/lib/treasury/index.ts`

```
Treasury Accounts (per company):
  type: cash | bank | credit
  balance: computed from transactions
  currency: inherited from company

Before ANY treasury debit:
  1. validateBalance(accountId, amount)
  2. If insufficient → throw InsufficientFundsError
  3. If valid → postTreasuryTransaction()
  4. → triggers accounting event

Treasury → Accounting auto-sync:
  Every treasury transaction creates a journal entry.
  cash accounts map to COA account 1110 (or custom mapping).
```

---

## 6. SUBSCRIPTION LIFECYCLE

```
States:     trial → active → grace → expired → suspended → cancelled
Middleware checks:
  isBlocked  = (status === 'suspended' || status === 'cancelled')
             || (status === 'expired' && grace period over)
  showGrace  = status === 'active' && daysLeft <= 7
  showTrial  = status === 'trial' && daysLeft <= 5
```

---

## 7. DYNAMIC DASHBOARD SYSTEM

Each business type returns different KPIs and widgets:

```typescript
// src/lib/features.ts — getDashboardConfig(businessType)

construction: {
  kpis: ['active_projects', 'total_budget', 'expenses_this_month', 'pending_tasks'],
  charts: ['project_budget_vs_actual', 'expense_by_category'],
  shortcuts: ['new_project', 'add_expense', 'add_worker', 'view_reports'],
}

pharmacy: {
  kpis: ['sales_today', 'low_stock', 'expiring_soon', 'monthly_revenue'],
  charts: ['sales_by_category', 'top_products'],
  shortcuts: ['new_sale', 'add_medicine', 'expiry_alert', 'purchases'],
}

retail: {
  kpis: ['sales_today', 'transactions_today', 'stock_value', 'low_stock'],
  charts: ['hourly_sales', 'top_products', 'payment_methods'],
  shortcuts: ['pos', 'new_sale', 'add_product', 'expenses'],
}
```

---

## 8. REPORTING ENGINE

Reports pull from journal_entry_lines, not raw tables.

### Profit & Loss
```sql
Revenue:    SUM(credit) WHERE account.type = 'revenue'
COGS:       SUM(debit)  WHERE account.type = 'cogs'
Expenses:   SUM(debit)  WHERE account.type = 'expense'
Net Profit: Revenue - COGS - Expenses
```

### Balance Sheet
```sql
Assets:      SUM(debit - credit) WHERE account.type = 'asset'
Liabilities: SUM(credit - debit) WHERE account.type = 'liability'
Equity:      SUM(credit - debit) WHERE account.type = 'equity'
```

### Cash Flow
```sql
Operating:  treasury_transactions WHERE category IN ('sale', 'expense', 'purchase')
Investing:  treasury_transactions WHERE category = 'asset_purchase'
Financing:  treasury_transactions WHERE category IN ('loan', 'owner_contribution')
```

---

## 9. MODULE SYSTEM

Each business module exports a config:

```typescript
// src/modules/construction/config.ts
export const constructionModule = {
  businessTypes: ['construction'],
  navItems: [...],
  permissions: ['construction:read', 'construction:write', 'construction:manage'],
  dashboardConfig: {...},
  accountMappings: {...},  // which COA accounts to use
}
```

Modules are loaded dynamically based on `features.hasConstruction`, etc.
Zero cross-contamination — construction nav never appears for pharmacy.

---

## 10. SECURITY ARCHITECTURE

### RLS (Row Level Security)
Every table has:
```sql
-- Read policy
CREATE POLICY "tenant_read" ON table_name
  FOR SELECT USING (company_id = get_company_id());

-- Write policy  
CREATE POLICY "tenant_write" ON table_name
  FOR INSERT WITH CHECK (company_id = get_company_id());

-- Update policy
CREATE POLICY "tenant_update" ON table_name
  FOR UPDATE USING (company_id = get_company_id());
```

`get_company_id()` is a Postgres function that reads from JWT claims.

### Middleware Guards
```
1. JWT validation (Supabase)
2. Session marker cookie
3. Tenant resolution
4. Subscription check
5. Permission check per route
6. Rate limiting
7. Audit log injection
```

### Super Admin Isolation
```
financeapp-admin uses service role key (bypasses RLS).
No financeapp-admin code ever runs in tenant context.
Super admin emails defined in env var SUPER_ADMIN_EMAILS.
```

---

## 11. MIGRATION STRATEGY

### Phase 1 — Schema (Week 1)
- Run `supabase/schema-v2.sql` in Supabase SQL editor
- This uses `CREATE TABLE IF NOT EXISTS` — safe on existing data
- Add missing columns with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- Enable RLS on all tables
- Apply `supabase/rls-policies-v2.sql`

### Phase 2 — Accounting Engine (Week 1-2)
- Deploy `src/lib/accounting/engine.ts`
- Wire into existing sales API (add `postAccountingEvent` call after each sale)
- Wire into expenses API
- Wire into purchases API
- Run integrity check to find historical gaps

### Phase 3 — Treasury (Week 2)
- Deploy `src/lib/treasury/index.ts`
- Migrate existing `wallets` → `treasury_accounts`
- Add balance validation to expense/purchase routes

### Phase 4 — RBAC (Week 2-3)
- Deploy `src/lib/rbac/index.ts`  
- Migrate `staff_users` permissions to new role system
- Update middleware to use new permission format

### Phase 5 — Dashboard & Reports (Week 3-4)
- Rebuild dashboard with dynamic config per business type
- Rebuild reports to pull from journal_entry_lines
- Add export (Excel/PDF)

### Phase 6 — Admin Panel (Week 4)
- Add plans management
- Add analytics dashboard
- Add support tickets
- Add activity monitoring

---

## 12. PRODUCTION DEPLOYMENT

```
financeapp (tenant ERP):
  Platform: Vercel (auto-deploy from main branch)
  Region: closest to users
  Environment: .env.production
  Edge: middleware runs on Edge runtime
  
financeapp-admin (SaaS admin):
  Platform: Vercel (separate project)
  Domain: admin.yourdomain.com  
  Protection: SUPER_ADMIN_EMAILS env var + Vercel password protection
  
Supabase:
  Plan: Pro (required for production)
  Region: match Vercel region
  Connection pooling: PgBouncer enabled
  Point-in-time recovery: enabled
  
CI/CD:
  GitHub Actions → runs type check + lint
  Vercel preview deployments on PRs
  Production only deploys from main
```

---

## 13. OPTIMIZATION STRATEGY

```
Database:
  - Index all company_id + common filter columns
  - Index: (company_id, created_at) on all transaction tables
  - Index: (company_id, status) on sales, purchases
  - Partial index: active subscriptions only
  - Materialized views for dashboard KPIs (refresh hourly)

Application:
  - Server Components for all data-heavy pages
  - Client Components only for interactive UI
  - Supabase realtime only where necessary (POS, notifications)
  - Next.js ISR for pricing/public pages
  - Streaming for large report pages

Caching:
  - next/cache for COA (changes rarely)
  - SWR with 30s revalidation for dashboard KPIs
  - Report caching in reports_cache table (invalidate on new journal entry)
```
