import { createClient } from '@/lib/supabase/server'
import { ReturnsClient } from './returns-client'

export const dynamic = 'force-dynamic'
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'SAR'

export default async function ReturnsPage() {
  const supabase = createClient()
  const { data: orders } = await supabase
    .from('rental_orders')
    .select('*, dresses(id, name, code)')
    .eq('company_id', COMPANY_ID)
    .in('status', ['booked', 'active', 'late'])
    .order('end_date', { ascending: true })
  return <ReturnsClient orders={orders || []} currency={CURRENCY} />
}
