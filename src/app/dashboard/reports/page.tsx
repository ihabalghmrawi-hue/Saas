import { createClient } from '@/lib/supabase/server'
import { ReportsClient } from './reports-client'
import { getLastNMonths } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('memberships')
    .select('company_id, companies(currency, name, name_ar)')
    .eq('user_id', user!.id)
    .single()

  const companyId = membership?.company_id as string
  const currency = (membership?.companies as any)?.currency || 'USD'
  const companyName = (membership?.companies as any)?.name_ar || (membership?.companies as any)?.name

  // Get 6 months data
  const months = getLastNMonths(6)
  const allMonthlyData = await Promise.all(
    months.map(async ({ start, end, label }) => {
      const { data } = await supabase
        .from('transactions')
        .select('type, amount, category_id, categories(name, name_ar, color)')
        .eq('company_id', companyId)
        .eq('status', 'completed')
        .gte('transaction_date', start)
        .lte('transaction_date', end)

      const income = data?.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) || 0
      const expenses = data?.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0) || 0
      return { month: label, income, expenses, profit: income - expenses, transactions: data || [] }
    })
  )

  // Category breakdown (current month)
  const currentMonth = months[months.length - 1]
  const { data: currentTxns } = await supabase
    .from('transactions')
    .select('type, amount, categories(id, name, name_ar, color, icon)')
    .eq('company_id', companyId)
    .eq('status', 'completed')
    .gte('transaction_date', currentMonth.start)
    .lte('transaction_date', currentMonth.end)

  // Build category breakdown
  const expenseByCategory: Record<string, any> = {}
  const incomeByCategory: Record<string, any> = {}

  currentTxns?.forEach(txn => {
    const cat = txn.categories as any
    const key = cat?.id || 'uncategorized'
    const name = cat?.name_ar || cat?.name || 'غير مصنف'
    const color = cat?.color || '#6B7280'

    if (txn.type === 'expense') {
      expenseByCategory[key] = expenseByCategory[key] || { name, color, amount: 0 }
      expenseByCategory[key].amount += Number(txn.amount)
    } else if (txn.type === 'income') {
      incomeByCategory[key] = incomeByCategory[key] || { name, color, amount: 0 }
      incomeByCategory[key].amount += Number(txn.amount)
    }
  })

  const totalExpenses = Object.values(expenseByCategory).reduce((s: number, c: any) => s + c.amount, 0)
  const totalIncome = Object.values(incomeByCategory).reduce((s: number, c: any) => s + c.amount, 0)

  const expenseBreakdown = Object.values(expenseByCategory)
    .map((c: any) => ({ ...c, percentage: totalExpenses > 0 ? (c.amount / totalExpenses) * 100 : 0 }))
    .sort((a: any, b: any) => b.amount - a.amount)

  const incomeBreakdown = Object.values(incomeByCategory)
    .map((c: any) => ({ ...c, percentage: totalIncome > 0 ? (c.amount / totalIncome) * 100 : 0 }))
    .sort((a: any, b: any) => b.amount - a.amount)

  const totals = allMonthlyData.reduce((acc, m) => ({
    income: acc.income + m.income,
    expenses: acc.expenses + m.expenses,
    profit: acc.profit + m.profit,
  }), { income: 0, expenses: 0, profit: 0 })

  return (
    <ReportsClient
      monthlyData={allMonthlyData}
      expenseBreakdown={expenseBreakdown}
      incomeBreakdown={incomeBreakdown}
      totals={totals}
      currency={currency}
      companyName={companyName}
      currentMonth={currentMonth.label}
    />
  )
}
