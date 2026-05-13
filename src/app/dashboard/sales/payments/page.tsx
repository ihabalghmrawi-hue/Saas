import { createClient } from '@/lib/supabase/server'
import { PaymentsClient } from './payments-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function PaymentsPage() {
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()

  const { data: payments } = await supabase
    .from('customer_payments')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <PaymentsClient
      payments={payments || []}
      companyId={COMPANY_ID}
      currency={await getCurrency()}
    />
  )
}
