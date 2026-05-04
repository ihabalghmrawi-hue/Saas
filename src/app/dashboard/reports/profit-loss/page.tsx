import { createClient } from '@/lib/supabase/server'
import { ProfitLossClient } from './profit-loss-client'

export const dynamic = 'force-dynamic'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'SAR'

export default async function ProfitLossPage() {
  const supabase = createClient()

  const now = new Date()
  const year = now.getFullYear()

  // جلب بيانات كل شهر في السنة الحالية
  const months = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(year, i, 1).toISOString().split('T')[0]
    const end = new Date(year, i + 1, 0).toISOString().split('T')[0]
    const label = new Date(year, i).toLocaleString('ar-SA', { month: 'long' })
    return { start, end, label, month: i + 1 }
  })

  const [
    { data: sales },
    { data: purchases },
    { data: expenses },
  ] = await Promise.all([
    supabase.from('sales').select('total, sale_date, subtotal, discount_amount').eq('company_id', COMPANY_ID).eq('status', 'completed').gte('sale_date', `${year}-01-01`).lte('sale_date', `${year}-12-31`),
    supabase.from('purchases').select('total, purchase_date').eq('company_id', COMPANY_ID).eq('status', 'received').gte('purchase_date', `${year}-01-01`).lte('purchase_date', `${year}-12-31`),
    supabase.from('expenses').select('amount, expense_date, expense_categories(name, name_ar, color)').eq('company_id', COMPANY_ID).gte('expense_date', `${year}-01-01`).lte('expense_date', `${year}-12-31`),
  ])

  // احتساب بيانات كل شهر
  const monthlyData = months.map(m => {
    const monthSales = sales?.filter(s => s.sale_date.startsWith(`${year}-${String(m.month).padStart(2, '0')}`)) || []
    const monthPurchases = purchases?.filter(p => p.purchase_date.startsWith(`${year}-${String(m.month).padStart(2, '0')}`)) || []
    const monthExpenses = expenses?.filter(e => e.expense_date.startsWith(`${year}-${String(m.month).padStart(2, '0')}`)) || []

    const revenue = monthSales.reduce((s, sale) => s + sale.total, 0)
    const cogs = monthPurchases.reduce((s, p) => s + p.total, 0)
    const expTotal = monthExpenses.reduce((s, e) => s + e.amount, 0)
    const grossProfit = revenue - cogs
    const netProfit = grossProfit - expTotal

    return { ...m, revenue, cogs, expenses: expTotal, grossProfit, netProfit }
  })

  // ملخص الفئات للمصروفات
  const expenseByCategory: Record<string, { name: string; color: string; amount: number }> = {}
  expenses?.forEach(e => {
    const cat = e.expense_categories as any
    const key = cat?.name || 'أخرى'
    expenseByCategory[key] = expenseByCategory[key] || { name: cat?.name_ar || key, color: cat?.color || '#6B7280', amount: 0 }
    expenseByCategory[key].amount += e.amount
  })

  const revenue = sales?.reduce((s, sale) => s + sale.total, 0) || 0
  const cogs = purchases?.reduce((s, p) => s + p.total, 0) || 0
  const expensesTotal = expenses?.reduce((s, e) => s + e.amount, 0) || 0
  const totals = {
    revenue,
    cogs,
    expenses: expensesTotal,
    grossProfit: revenue - cogs,
    netProfit: revenue - cogs - expensesTotal,
  }

  return (
    <ProfitLossClient
      monthlyData={monthlyData}
      expenseBreakdown={Object.values(expenseByCategory)}
      totals={totals as any}
      currency={CURRENCY}
      year={year}
    />
  )
}
