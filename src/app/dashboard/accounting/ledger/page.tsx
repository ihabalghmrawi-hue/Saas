import { createClient } from '@/lib/supabase/server'
import { getCompanyId, getCurrency } from '@/lib/tenant'
import { LedgerClient } from './ledger-client'

export const dynamic = 'force-dynamic'

export default async function LedgerPage() {
  const supabase   = createClient()
  const company_id = getCompanyId()
  const currency   = getCurrency()

  // Fetch all postable accounts for selector
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, code, name, name_ar, type, normal_balance, current_balance')
    .eq('company_id', company_id)
    .eq('is_active', true)
    .eq('is_postable', true)
    .order('code', { ascending: true })

  // Fetch periods for filter
  const { data: periods } = await supabase
    .from('accounting_periods')
    .select('id, name, start_date, end_date, period_number')
    .eq('company_id', company_id)
    .order('start_date', { ascending: false })
    .limit(24)

  return (
    <LedgerClient
      accounts={accounts || []}
      periods={periods || []}
      company_id={company_id}
      currency={currency}
    />
  )
}
