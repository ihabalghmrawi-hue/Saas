import { createClient } from '@/lib/supabase/server'
import { CustomersClient } from './customers-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  const COMPANY_ID = await getCompanyId()
  const supabase = createClient()
  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })

  return <CustomersClient customers={customers || []} companyId={COMPANY_ID} currency={await getCurrency()} />
}
