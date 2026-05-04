// ─── Plan definitions & feature gating ───────────────────────────────────────

export type Plan = 'free' | 'basic' | 'pro'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused'

// ── Plan limits ───────────────────────────────────────────────────────────────
export interface PlanLimits {
  products:        number   // -1 = unlimited
  customers:       number
  salesPerMonth:   number
  bookingsPerMonth: number
  users:           number
  storageGB:       number
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    products:        50,
    customers:       100,
    salesPerMonth:   200,
    bookingsPerMonth: 30,
    users:           1,
    storageGB:       0.5,
  },
  basic: {
    products:        500,
    customers:       1000,
    salesPerMonth:   -1,
    bookingsPerMonth: -1,
    users:           5,
    storageGB:       5,
  },
  pro: {
    products:        -1,
    customers:       -1,
    salesPerMonth:   -1,
    bookingsPerMonth: -1,
    users:           -1,
    storageGB:       50,
  },
}

// ── Plan features ─────────────────────────────────────────────────────────────
export interface PlanFeatures {
  reports:       boolean
  aiInsights:    boolean
  backups:       boolean
  customBranding: boolean
  apiAccess:     boolean
  prioritySupport: boolean
  advancedReports: boolean
  exportCSV:     boolean
  multiWarehouse: boolean
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  free: {
    reports:         false,
    aiInsights:      false,
    backups:         false,
    customBranding:  false,
    apiAccess:       false,
    prioritySupport: false,
    advancedReports: false,
    exportCSV:       false,
    multiWarehouse:  false,
  },
  basic: {
    reports:         true,
    aiInsights:      false,
    backups:         true,
    customBranding:  false,
    apiAccess:       false,
    prioritySupport: false,
    advancedReports: false,
    exportCSV:       true,
    multiWarehouse:  false,
  },
  pro: {
    reports:         true,
    aiInsights:      true,
    backups:         true,
    customBranding:  true,
    apiAccess:       true,
    prioritySupport: true,
    advancedReports: true,
    exportCSV:       true,
    multiWarehouse:  true,
  },
}

// ── Pricing ───────────────────────────────────────────────────────────────────
export interface PlanPricing {
  nameAr:       string
  monthly:      number   // USD
  stripePriceId: string  // set via env vars
  highlight?:   boolean
  badge?:       string
}

export const PLAN_PRICING: Record<Plan, PlanPricing> = {
  free: {
    nameAr:       'مجاني',
    monthly:      0,
    stripePriceId: '',
  },
  basic: {
    nameAr:       'أساسي',
    monthly:      19,
    stripePriceId: process.env.STRIPE_PRICE_BASIC || '',
    badge:        'الأكثر شيوعاً',
    highlight:    true,
  },
  pro: {
    nameAr:       'احترافي',
    monthly:      49,
    stripePriceId: process.env.STRIPE_PRICE_PRO || '',
  },
}

// ── Subscription context ──────────────────────────────────────────────────────
export interface SubscriptionContext {
  companyId:         string
  plan:              Plan
  status:            SubscriptionStatus
  trialEndsAt:       string | null
  currentPeriodEnd:  string | null
  cancelAtPeriodEnd: boolean
  stripeCustomerId:  string | null
  limits:            PlanLimits
  features:          PlanFeatures
  isActive:          boolean
  isTrialing:        boolean
  daysLeft:          number | null
}

export function buildSubscriptionContext(row: any): SubscriptionContext {
  const plan     = (row?.plan || 'free') as Plan
  const status   = (row?.status || 'active') as SubscriptionStatus
  const isActive = ['active', 'trialing'].includes(status)

  let daysLeft: number | null = null
  if (status === 'trialing' && row?.trial_ends_at) {
    daysLeft = Math.max(0, Math.ceil((new Date(row.trial_ends_at).getTime() - Date.now()) / 86400000))
  } else if (row?.current_period_end) {
    daysLeft = Math.max(0, Math.ceil((new Date(row.current_period_end).getTime() - Date.now()) / 86400000))
  }

  return {
    companyId:         row?.company_id || '',
    plan,
    status,
    trialEndsAt:       row?.trial_ends_at || null,
    currentPeriodEnd:  row?.current_period_end || null,
    cancelAtPeriodEnd: row?.cancel_at_period_end || false,
    stripeCustomerId:  row?.stripe_customer_id || null,
    limits:            PLAN_LIMITS[plan],
    features:          PLAN_FEATURES[plan],
    isActive,
    isTrialing:        status === 'trialing',
    daysLeft,
  }
}

// ── Feature gate helper ───────────────────────────────────────────────────────
export function canUseFeature(
  sub:     SubscriptionContext,
  feature: keyof PlanFeatures,
): boolean {
  if (!sub.isActive) return false
  return sub.features[feature]
}

export function withinLimit(
  sub:     SubscriptionContext,
  limit:   keyof PlanLimits,
  current: number,
): boolean {
  const max = sub.limits[limit]
  if (max === -1) return true
  return current < max
}

export function limitExceededMessage(limit: keyof PlanLimits): string {
  const msgs: Record<keyof PlanLimits, string> = {
    products:        'لقد وصلت إلى الحد الأقصى للمنتجات في خطتك',
    customers:       'لقد وصلت إلى الحد الأقصى للعملاء في خطتك',
    salesPerMonth:   'لقد وصلت إلى الحد الأقصى للمبيعات الشهرية',
    bookingsPerMonth:'لقد وصلت إلى الحد الأقصى للحجوزات الشهرية',
    users:           'لقد وصلت إلى الحد الأقصى للمستخدمين',
    storageGB:       'لقد وصلت إلى الحد الأقصى لمساحة التخزين',
  }
  return msgs[limit]
}
