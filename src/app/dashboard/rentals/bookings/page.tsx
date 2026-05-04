import { createClient } from '@/lib/supabase/server'
import { BookingsClient } from './bookings-client'

export const dynamic = 'force-dynamic'
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'SAR'

export default async function BookingsPage() {
  const supabase = createClient()
  const [{ data: orders }, { data: dresses }] = await Promise.all([
    supabase.from('rental_orders')
      .select('*, dresses(id, name, code, status, rental_price, deposit)')
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false }),
    supabase.from('dresses')
      .select('id, name, code, status, rental_price, deposit')
      .eq('company_id', COMPANY_ID)
      .neq('status', 'retired')
      .order('name'),
  ])
  return <BookingsClient orders={orders || []} dresses={dresses || []} currency={CURRENCY} />
}
