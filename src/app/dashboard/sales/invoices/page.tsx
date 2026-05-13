import { createClient } from '@/lib/supabase/server'
import { InvoicesClient } from './invoices-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function InvoicesPage() {
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <InvoicesClient
      invoices={invoices || []}
      companyId={COMPANY_ID}
      currency={await getCurrency()}
    />
  )
}
