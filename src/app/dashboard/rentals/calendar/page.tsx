import { createClient } from '@/lib/supabase/server'
import { RentalCalendarClient } from './rental-calendar-client'

export const dynamic = 'force-dynamic'
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'SAR'

export default async function RentalCalendarPage() {
  const supabase = createClient()
  const [{ data: dresses }, { data: orders }] = await Promise.all([
    supabase.from('dresses')
      .select('id, name, code, category, size, color, status, rental_price, deposit')
      .eq('company_id', COMPANY_ID)
      .neq('status', 'retired')
      .order('name'),
    supabase.from('rental_orders')
      .select('id, dress_id, order_number, customer_name, customer_phone, start_date, end_date, days, total_price, amount_paid, deposit, deposit_paid, status, notes')
      .eq('company_id', COMPANY_ID)
      .not('status', 'in', '("cancelled","returned")')
      .order('start_date'),
  ])
  return <RentalCalendarClient dresses={dresses || []} orders={orders || []} currency={CURRENCY} />
}
