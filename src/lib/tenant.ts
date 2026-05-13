// Resolves the current tenant_id and currency from request headers set by middleware
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const FALLBACK_COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const FALLBACK_CURRENCY   = process.env.NEXT_PUBLIC_CURRENCY_DEFAULT || process.env.NEXT_PUBLIC_CURRENCY || 'SAR'

const dec = (v: string | null, fb = '') => { try { return decodeURIComponent(v || fb) } catch { return v || fb } }

export async function getCompanyId(): Promise<string> {
  try {
    const h = await headers()
    return dec(h.get('x-tenant-id'), FALLBACK_COMPANY_ID)
  } catch {
    return FALLBACK_COMPANY_ID
  }
}

export async function getCurrency(): Promise<string> {
  try {
    const h = await headers()
    return dec(h.get('x-company-currency'), FALLBACK_CURRENCY) || FALLBACK_CURRENCY
  } catch {
    return FALLBACK_CURRENCY
  }
}

export async function getTenantProfile(companyId?: string) {
  const cid      = companyId || getCompanyId()
  const supabase = createClient()
  const { data } = await supabase
    .from('companies')
    .select('id, name, name_ar, slug, currency, language, settings')
    .eq('id', cid)
    .maybeSingle()
  return data
}
