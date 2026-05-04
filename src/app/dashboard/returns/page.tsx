import { createClient } from '@/lib/supabase/server'
import { ReturnsClient } from './returns-client'

export const dynamic = 'force-dynamic'
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'SAR'

export default async function ReturnsPage() {
  const supabase = createClient()

  const [{ data: returns }, { data: warehouses }] = await Promise.all([
    supabase
      .from('returns')
      .select('*, sales(invoice_number, total), customers(name)')
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('warehouses').select('*').eq('company_id', COMPANY_ID).eq('is_active', true),
  ])

  return (
    <ReturnsClient
      returns={returns || []}
      warehouses={warehouses || []}
      companyId={COMPANY_ID}
      currency={CURRENCY}
    />
  )
}
