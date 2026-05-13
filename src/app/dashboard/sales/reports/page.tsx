import { createClient } from '@/lib/supabase/server'
import { ReportsClient } from './reports-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_no, customer_id, customer_name, total, paid_amount, status, invoice_date')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })

  return (
    <ReportsClient
      invoices={invoices || []}
      companyId={COMPANY_ID}
      currency={await getCurrency()}
    />
  )
}
