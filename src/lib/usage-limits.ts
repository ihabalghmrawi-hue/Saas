/**
 * Usage Limits — check current tenant usage against plan limits.
 *
 * Called from API routes BEFORE creating resources to enforce plan caps.
 * Returns structured results so callers can show helpful upgrade prompts.
 */

import { type SupabaseClient } from '@supabase/supabase-js'
import { PLAN_LIMITS, type Plan, type PlanLimits } from '@/lib/plans'

export type LimitKey = keyof PlanLimits

export interface UsageSnapshot {
  products:         number
  customers:        number
  salesThisMonth:   number
  bookingsThisMonth: number
  activeUsers:      number
  storageGB:        number   // approximate — based on file metadata
}

export interface LimitCheckResult {
  allowed:   boolean
  current:   number
  max:       number          // -1 = unlimited
  remaining: number          // -1 = unlimited
  pct:       number          // 0-100, percentage used
  limitKey:  LimitKey
  message:   string
}

// ── Count helpers ──────────────────────────────────────────────────────────────

async function countProducts(sb: SupabaseClient, companyId: string): Promise<number> {
  const { count } = await sb
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('is_deleted', false)
  return count ?? 0
}

async function countCustomers(sb: SupabaseClient, companyId: string): Promise<number> {
  const { count } = await sb
    .from('parties')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('type', 'customer')
    .eq('is_deleted', false)
  return count ?? 0
}

async function countSalesThisMonth(sb: SupabaseClient, companyId: string): Promise<number> {
  const start = new Date()
  start.setDate(1); start.setHours(0, 0, 0, 0)
  const { count } = await sb
    .from('sales')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', start.toISOString())
  return count ?? 0
}

async function countBookingsThisMonth(sb: SupabaseClient, companyId: string): Promise<number> {
  const start = new Date()
  start.setDate(1); start.setHours(0, 0, 0, 0)
  const { count } = await sb
    .from('rental_orders')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', start.toISOString())
  return count ?? 0
}

async function countActiveUsers(sb: SupabaseClient, companyId: string): Promise<number> {
  const { count } = await sb
    .from('memberships')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('is_active', true)
  return count ?? 0
}

// ── Full snapshot ─────────────────────────────────────────────────────────────

export async function getUsageSnapshot(
  sb:        SupabaseClient,
  companyId: string,
): Promise<UsageSnapshot> {
  const [products, customers, salesThisMonth, bookingsThisMonth, activeUsers] =
    await Promise.all([
      countProducts(sb, companyId),
      countCustomers(sb, companyId),
      countSalesThisMonth(sb, companyId),
      countBookingsThisMonth(sb, companyId),
      countActiveUsers(sb, companyId),
    ])

  return { products, customers, salesThisMonth, bookingsThisMonth, activeUsers, storageGB: 0 }
}

// ── Single-resource limit check (fast — one DB query) ─────────────────────────

export async function checkLimit(
  sb:        SupabaseClient,
  companyId: string,
  plan:      Plan,
  limitKey:  LimitKey,
): Promise<LimitCheckResult> {
  const max = PLAN_LIMITS[plan][limitKey]

  const countMap: Record<LimitKey, () => Promise<number>> = {
    products:         () => countProducts(sb, companyId),
    customers:        () => countCustomers(sb, companyId),
    salesPerMonth:    () => countSalesThisMonth(sb, companyId),
    bookingsPerMonth: () => countBookingsThisMonth(sb, companyId),
    users:            () => countActiveUsers(sb, companyId),
    storageGB:        async () => 0,
  }

  const current   = await countMap[limitKey]()
  const unlimited = max === -1
  const remaining = unlimited ? -1 : Math.max(0, max - current)
  const allowed   = unlimited || current < max
  const pct       = unlimited ? 0 : Math.round((current / max) * 100)

  return { allowed, current, max, remaining, pct, limitKey, message: limitMessages[limitKey] }
}

// ── Batch check (used in usage dashboard) ────────────────────────────────────

export async function checkAllLimits(
  sb:        SupabaseClient,
  companyId: string,
  plan:      Plan,
): Promise<Record<LimitKey, LimitCheckResult>> {
  const snapshot = await getUsageSnapshot(sb, companyId)
  const limits   = PLAN_LIMITS[plan]

  const make = (key: LimitKey, current: number): LimitCheckResult => {
    const max       = limits[key]
    const unlimited = max === -1
    const remaining = unlimited ? -1 : Math.max(0, max - current)
    const allowed   = unlimited || current < max
    const pct       = unlimited ? 0 : Math.round((current / max) * 100)
    return { allowed, current, max, remaining, pct, limitKey: key, message: limitMessages[key] }
  }

  return {
    products:         make('products',         snapshot.products),
    customers:        make('customers',         snapshot.customers),
    salesPerMonth:    make('salesPerMonth',     snapshot.salesThisMonth),
    bookingsPerMonth: make('bookingsPerMonth',  snapshot.bookingsThisMonth),
    users:            make('users',             snapshot.activeUsers),
    storageGB:        make('storageGB',         snapshot.storageGB),
  }
}

// ── Messages ──────────────────────────────────────────────────────────────────

const limitMessages: Record<LimitKey, string> = {
  products:         'وصلت لحد المنتجات في خطتك الحالية. قم بالترقية لإضافة المزيد.',
  customers:        'وصلت لحد العملاء في خطتك الحالية. قم بالترقية لإضافة المزيد.',
  salesPerMonth:    'وصلت لحد الفواتير الشهرية. يتجدد في أول الشهر القادم.',
  bookingsPerMonth: 'وصلت لحد الحجوزات الشهرية. يتجدد في أول الشهر القادم.',
  users:            'وصلت لحد المستخدمين في خطتك الحالية. قم بالترقية لإضافة مستخدمين.',
  storageGB:        'وصلت لحد مساحة التخزين. قم بالترقية لمزيد من المساحة.',
}

// ── HTTP response helpers ─────────────────────────────────────────────────────

export function limitExceededResponse(result: LimitCheckResult) {
  return {
    error:     result.message,
    limitKey:  result.limitKey,
    current:   result.current,
    max:       result.max,
    upgradeRequired: true,
  }
}
