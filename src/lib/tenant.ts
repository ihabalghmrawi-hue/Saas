// ─── Tenant context ────────────────────────────────────────────────────────────
// Resolves the current tenant_id (company_id) from:
//   1. x-tenant-id header (injected by middleware for Supabase Auth users)
//   2. x-staff-company-id header (injected by middleware for PIN-auth staff)
//   3. NEXT_PUBLIC_COMPANY_ID env var (single-tenant fallback)
//
// This allows ALL existing API routes to work unchanged in single-tenant mode
// while seamlessly supporting multi-tenant SaaS when auth headers are present.

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { buildSubscriptionContext } from '@/lib/plans'
import type { SubscriptionContext } from '@/lib/plans'

const FALLBACK_COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

// ── Get company_id for the current request ────────────────────────────────────
export function getCompanyId(): string {
  try {
    const h = headers()
    return (
      h.get('x-tenant-id') ||
      h.get('x-staff-company-id') ||
      FALLBACK_COMPANY_ID
    )
  } catch {
    return FALLBACK_COMPANY_ID
  }
}

// ── Get full subscription context ─────────────────────────────────────────────
export async function getSubscription(companyId?: string): Promise<SubscriptionContext> {
  const cid      = companyId || getCompanyId()
  const supabase = createClient()

  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('company_id', cid)
    .maybeSingle()

  return buildSubscriptionContext(data ?? { company_id: cid, plan: 'free', status: 'active' })
}

// ── Get tenant profile (company row) ─────────────────────────────────────────
export async function getTenantProfile(companyId?: string) {
  const cid      = companyId || getCompanyId()
  const supabase = createClient()

  const { data } = await supabase
    .from('companies')
    .select('id, name, name_ar, slug, currency, language, settings')
    .eq('id', cid)
    .single()

  return data
}

// ── Check feature access (server-side guard) ──────────────────────────────────
export async function requireFeature(feature: string): Promise<SubscriptionContext> {
  const sub = await getSubscription()
  if (!sub.isActive) {
    throw new Error('اشتراكك غير نشط — يرجى تجديد الاشتراك')
  }
  const featMap = sub.features as unknown as Record<string, boolean>
  if (feature in featMap && !featMap[feature]) {
    throw new Error(`هذه الميزة غير متاحة في خطة "${sub.plan}" — يرجى الترقية`)
  }
  return sub
}
