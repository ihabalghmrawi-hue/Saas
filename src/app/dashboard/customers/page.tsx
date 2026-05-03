import { createClient } from '@/lib/supabase/server'
import { CustomersClient } from './customers-client'

export const dynamic = 'force-dynamic'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

export default async function CustomersPage() {
  const supabase = createClient()
  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })

  return <CustomersClient customers={customers || []} companyId={COMPANY_ID} currency={process.env.NEXT_PUBLIC_CURRENCY || 'SAR'} />
}
