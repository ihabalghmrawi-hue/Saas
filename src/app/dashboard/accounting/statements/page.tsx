import { createClient }             from '@/lib/supabase/server'
import { getCompanyId, getCurrency } from '@/lib/tenant'
import {
  generateIncomeStatement,
  generateBalanceSheet,
  generateTrialBalance,
  generateCashFlow,
} from '@/lib/accounting/index'
import { StatementsClient } from './statements-client'

export const dynamic = 'force-dynamic'

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: {
    type?:      string
    date_from?: string
    date_to?:   string
    as_of?:     string
  }
}) {
  const supabase   = createClient()
  const company_id = getCompanyId()
  const currency   = getCurrency()

  const now        = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today      = now.toISOString().slice(0, 10)
  const yearStart  = `${now.getFullYear()}-01-01`

  const dateFrom = searchParams.date_from || monthStart
  const dateTo   = searchParams.date_to   || today
  const asOf     = searchParams.as_of     || today

  // Prefetch all statements in parallel
  const [incomeStatement, balanceSheet, trialBalance, cashFlow] = await Promise.all([
    generateIncomeStatement(supabase, company_id, dateFrom, dateTo).catch(() => null),
    generateBalanceSheet(supabase, company_id, asOf).catch(() => null),
    generateTrialBalance(supabase, company_id, dateFrom, dateTo).catch(() => null),
    generateCashFlow(supabase, company_id, dateFrom, dateTo).catch(() => null),
  ])

  return (
    <StatementsClient
      incomeStatement={incomeStatement}
      balanceSheet={balanceSheet}
      trialBalance={trialBalance}
      cashFlow={cashFlow}
      company_id={company_id}
      currency={currency}
      initialTab={searchParams.type || 'income'}
      initialDateFrom={dateFrom}
      initialDateTo={dateTo}
      initialAsOf={asOf}
    />
  )
}
