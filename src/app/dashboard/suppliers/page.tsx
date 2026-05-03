import { createClient } from '@/lib/supabase/server'
import { SuppliersClient } from './suppliers-client'

export const dynamic = 'force-dynamic'
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'

export default async function SuppliersPage() {
  const supabase = createClient()
  const { data: suppliers } = await supabase.from('suppliers').select('*').eq('company_id', COMPANY_ID).order('created_at', { ascending: false })
  return <SuppliersClient suppliers={suppliers || []} companyId={COMPANY_ID} currency={process.env.NEXT_PUBLIC_CURRENCY || 'SAR'} />
}
