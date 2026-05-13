import { createClient } from '@/lib/supabase/server'
import { ShiftsClient } from './shifts-client'
import { getCompanyId, getCurrency } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

export default async function ShiftsPage() {
  const CURRENCY = await getCurrency()
  const COMPANY_ID = await getCompanyId()
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
