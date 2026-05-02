import { createClient } from '@/lib/supabase/server'
import { PartiesClient } from './parties-client'

export const dynamic = 'force-dynamic'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'SAR'

export default async function PartiesPage() {
  const supabase = createClient()

  const { data: parties } = await supabase
    .from('parties')
    .select('*')
    .eq('company_id', COMPANY_ID)
    .eq('is_active', true)
    .order('name')

  return <PartiesClient parties={parties || []} companyId={COMPANY_ID} currency={CURRENCY} />
}
