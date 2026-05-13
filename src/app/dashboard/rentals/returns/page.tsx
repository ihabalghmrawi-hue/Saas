import { createClient } from '@/lib/supabase/server'
import { ReturnsClient } from './returns-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function ReturnsPage() {
  const CURRENCY = await getCurrency()
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()
  const { data: orders } = await supabase
    .from('rental_orders')
    .select('*, dresses(id, name, code)')
    .eq('company_id', COMPANY_ID)
    .in('status', ['booked', 'active', 'late'])
    .order('end_date', { ascending: true })
  return <ReturnsClient orders={orders || []} currency={CURRENCY} />
}
