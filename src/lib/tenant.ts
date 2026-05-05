// Resolves the current tenant_id from request headers set by middleware
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const FALLBACK_COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

export function getCompanyId(): string {
  try {
    const h = headers()
    return h.get('x-tenant-id') || FALLBACK_COMPANY_ID
  } catch {
    return FALLBACK_COMPANY_ID
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
