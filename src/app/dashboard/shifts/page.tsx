import { createClient } from '@/lib/supabase/server'
import { ShiftsClient } from './shifts-client'

export const dynamic = 'force-dynamic'
const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'SAR'

export default async function ShiftsPage() {
  const supabase = createClient()

  const [{ data: shifts }, { data: openShift }] = await Promise.all([
    supabase
      .from('shifts')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .order('opened_at', { ascending: false })
      .limit(30),
    supabase
      .from('shifts')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .eq('status', 'open')
      .single(),
  ])

  return (
    <ShiftsClient
      shifts={shifts || []}
      openShift={openShift || null}
      currency={CURRENCY}
      companyId={COMPANY_ID}
    />
  )
}
