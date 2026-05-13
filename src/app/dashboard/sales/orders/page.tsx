import { createClient } from '@/lib/supabase/server'
import { OrdersClient } from './orders-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()

  const { data: orders } = await supabase
    .from('sales_orders')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <OrdersClient
      orders={orders || []}
      companyId={COMPANY_ID}
      currency={await getCurrency()}
    />
  )
}
