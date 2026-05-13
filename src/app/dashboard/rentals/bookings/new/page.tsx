import { createClient } from '@/lib/supabase/server'
import { FastBookingClient } from './fast-booking-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function NewBookingPage() {
  const CURRENCY = await getCurrency()
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()
  const { data: dresses } = await supabase
    .from('dresses')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .neq('status', 'retired')
    .order('name')
  return <FastBookingClient dresses={dresses || []} currency={CURRENCY} />
}
