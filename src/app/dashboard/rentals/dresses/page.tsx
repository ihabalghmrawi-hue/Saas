import { createClient } from '@/lib/supabase/server'
import { DressesClient } from './dresses-client'

export const dynamic = 'force-dynamic'
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'SAR'

export default async function DressesPage() {
  const supabase = createClient()
  const { data: dresses } = await supabase
    .from('dresses').select('*').eq('company_id', COMPANY_ID).neq('status', 'retired').order('created_at', { ascending: false })
  return <DressesClient dresses={dresses || []} currency={CURRENCY} />
}
