import { createClient } from '@/lib/supabase/server'
import { SuppliersClient } from './suppliers-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function SuppliersPage() {
  const COMPANY_ID = getCompanyId()
  const supabase = createClient()
  const { data: suppliers } = await supabase.from('suppliers').select('*').eq('company_id', COMPANY_ID).order('created_at', { ascending: false })
  return <SuppliersClient suppliers={suppliers || []} companyId={COMPANY_ID} currency={getCurrency()} />
}
