import { createClient } from '@/lib/supabase/server'
import { getMonthRange, getLastNMonths } from '@/lib/utils'
import { DashboardStats } from '@/components/dashboard/stats-cards'
import { FinancialChart } from '@/components/dashboard/financial-chart'
import { RecentTransactions } from '@/components/dashboard/recent-transactions'
import { WalletSummary } from '@/components/dashboard/wallet-summary'
import { QuickActions } from '@/components/dashboard/quick-actions'

export const dynamic = 'force-dynamic'

const COMPANY_ID = process.env.NEXT_PUBLIC_COMPANY_ID || 'default'
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || 'SAR'

async function getDashboardData(companyId: string) {
  const supabase = createClient()
  const { start, end } = getMonthRange()
  const prevMonthRange = getMonthRange(new Date(new Date().setMonth(new Date().getMonth() - 1)))

  const [
    { data: currentTransactions },
    { data: prevTransactions },
    { data: recentTransactions },
    { data: wallets },
  ] = await Promise.all([
    supabase.from('transactions').select('type, amount').eq('company_id', companyId).eq('status', 'completed').gte('transaction_date', start).lte('transaction_date', end),
    supabase.from('transactions').select('type, amount').eq('company_id', companyId).eq('status', 'completed').gte('transaction_date', prevMonthRange.start).lte('transaction_date', prevMonthRange.end),
    supabase.from('transactions').select('*, categories(name, name_ar, color, icon), parties(name)').eq('company_id', companyId).order('created_at', { ascending: false }).limit(8),
    supabase.from('wallets').select('*').eq('company_id', companyId).eq('is_active', true),
  ])

  const calcStats = (txns: any[]) => ({
    income: txns?.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) || 0,
    expenses: txns?.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0) || 0,
  })

  const current = calcStats(currentTransactions || [])
  const prev = calcStats(prevTransactions || [])
  const totalBalance = wallets?.reduce((s, w) => s + Number(w.current_balance), 0) || 0

  const last6Months = getLastNMonths(6)
  const monthlyDataResults = await Promise.all(
    last6Months.map(async ({ start, end, label }) => {
      const { data } = await supabase.from('transactions').select('type, amount').eq('company_id', companyId).eq('status', 'completed').gte('transaction_date', start).lte('transaction_date', end)
      const income = data?.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0) || 0
      const expenses = data?.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0) || 0
      return { month: label, income, expenses, profit: income - expenses }
    })
  )

  return {
    stats: {
      totalBalance,
      totalIncome: current.income,
      totalExpenses: current.expenses,
      netProfit: current.income - current.expenses,
      incomeChange: prev.income ? ((current.income - prev.income) / prev.income) * 100 : 0,
      expenseChange: prev.expenses ? ((current.expenses - prev.expenses) / prev.expenses) * 100 : 0,
      profitChange: 0,
    },
    recentTransactions: recentTransactions || [],
    wallets: wallets || [],
    monthlyData: monthlyDataResults,
  }
}

export default async function DashboardPage() {
  const { stats, recentTransactions, wallets, monthlyData } = await getDashboardData(COMPANY_ID)

  return (
    <div className="space-y-6 animate-fade-in">
      <QuickActions companyId={COMPANY_ID} />
      <DashboardStats stats={stats} currency={CURRENCY} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <FinancialChart data={monthlyData} currency={CURRENCY} />
        </div>
        <div>
          <WalletSummary wallets={wallets} currency={CURRENCY} />
        </div>
      </div>
      <RecentTransactions transactions={recentTransactions} currency={CURRENCY} />
    </div>
  )
}
