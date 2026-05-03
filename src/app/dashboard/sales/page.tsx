import { createClient } from '@/lib/supabase/server'
import { SalesClient } from './sales-client'

export const dynamic = 'force-dynamic'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'SAR'

export default async function SalesPage() {
  const supabase = createClient()

  const { data: sales } = await supabase
    .from('sales')
    .select('*, customers(name, phone), sale_items(id), sale_payments(method, amount)')
    .eq('company_id', COMPANY_ID)
    .order('sale_date', { ascending: false })
    .limit(100)

  return <SalesClient sales={sales || []} currency={CURRENCY} companyId={COMPANY_ID} />
}
