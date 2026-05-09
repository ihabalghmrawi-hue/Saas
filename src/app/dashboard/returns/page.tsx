import { createClient } from '@/lib/supabase/server'
import { ReturnsClient } from './returns-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function ReturnsPage() {
  const CURRENCY = getCurrency()
  const COMPANY_ID = getCompanyId()
  const supabase = createClient()

  const [{ data: returns }, { data: warehouses }] = await Promise.all([
    supabase
      .from('returns')
      .select('*, sales(invoice_number, total), customers(name)')
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('warehouses').select('*').eq('company_id', COMPANY_ID).eq('is_active', true),
  ])

  return (
    <ReturnsClient
      returns={returns || []}
      warehouses={warehouses || []}
      companyId={COMPANY_ID}
      currency={CURRENCY}
    />
  )
}
