import { createClient }             from '@/lib/supabase/server'
import { getCompanyId, getCurrency } from '@/lib/tenant'
import { generateTrialBalance }      from '@/lib/accounting/index'
import { TrialBalanceClient }        from './trial-balance-client'

export const dynamic = 'force-dynamic'

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: { date_to?: string; date_from?: string }
}) {
  const supabase   = createClient()
  const company_id = getCompanyId()
  const currency   = getCurrency()

  const date_to   = searchParams.date_to   || new Date().toISOString().slice(0, 10)
  const date_from = searchParams.date_from || undefined

  const trialBalance = await generateTrialBalance(supabase, company_id, date_from, date_to)

  return (
    <TrialBalanceClient
      trialBalance={trialBalance}
      company_id={company_id}
      currency={currency}
      initialDateFrom={date_from || ''}
      initialDateTo={date_to}
    />
  )
}
