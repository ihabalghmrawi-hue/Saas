import { createClient } from '@/lib/supabase/server'
import { PricingClient } from './pricing-client'
import type { PricingRule } from '@/lib/rental-pricing'

export const dynamic = 'force-dynamic'
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY   = process.env.NEXT_PUBLIC_CURRENCY   || 'SAR'

export default async function PricingPage() {
  const supabase = createClient()
  const [{ data: rules }, { data: dresses }] = await Promise.all([
    supabase.from('rental_pricing_rules').select('*').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }),
    supabase.from('dresses').select('id, name, code').eq('company_id', COMPANY_ID).neq('status', 'retired').order('name'),
  ])
  return <PricingClient rules={(rules || []) as PricingRule[]} dresses={dresses || []} currency={CURRENCY} />
}
