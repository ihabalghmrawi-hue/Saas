import { createClient } from '@/lib/supabase/server'
import { getCompanyId, getCurrency } from '@/lib/tenant'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, DollarSign,
  Users, ShoppingCart, BookOpen, ArrowUpRight,
  CheckCircle, AlertCircle, Clock,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

function KpiCard({
  title, value, icon: Icon, color, trend, trendLabel, href,
}: {
  title:       string
  value:       string
  icon:        any
  color:       string
  trend?:      'up' | 'down' | 'neutral'
  trendLabel?: string
  href?:       string
}) {
  const card = (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow ${href ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trendLabel && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${
              trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400'
            }`}>
              {trend === 'up' && <TrendingUp className="h-3 w-3" />}
              {trend === 'down' && <TrendingDown className="h-3 w-3" />}
              {trendLabel}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  )

  return href ? <Link href={href}>{card}</Link> : card
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:    { label: 'مسودة',   cls: 'bg-gray-100 text-gray-600' },
    pending:  { label: 'معلق',    cls: 'bg-yellow-100 text-yellow-700' },
    approved: { label: 'معتمد',   cls: 'bg-blue-100 text-blue-700' },
    posted:   { label: 'مرحّل',   cls: 'bg-green-100 text-green-700' },
    reversed: { label: 'معكوس',   cls: 'bg-red-100 text-red-600' },
    void:     { label: 'ملغي',    cls: 'bg-gray-100 text-gray-400 line-through' },
  }
  const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}

export default async function AccountingDashboardPage() {
  const supabase   = createClient()
  const company_id = await getCompanyId()
  const currency   = await getCurrency()

  const now        = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today      = now.toISOString().slice(0, 10)

  // Fetch account balances for key accounts
  const { data: accounts } = await supabase
    .from('accounts')
    .select('code, name_ar, current_balance, type, normal_balance')
    .eq('company_id', company_id)
    .in('code', ['1101', '1102', '1110', '2101', '4001', '5001'])
    .eq('is_active', true)

  const accountMap: Record<string, number> = {}
  for (const a of accounts || []) {
    accountMap[a.code] = Number(a.current_balance || 0)
  }

  // Revenue this month from journal entries
  const { data: revenueLines } = await supabase
    .from('journal_entry_lines')
    .select(`
      credit, debit,
      journal_entries!inner(date, status, company_id),
      accounts!inner(code, type, normal_balance)
    `)
    .eq('journal_entries.company_id', company_id)
    .eq('journal_entries.status', 'posted')
    .eq('accounts.type', 'revenue')
    .gte('journal_entries.date', monthStart)
    .lte('journal_entries.date', today)

  const monthlyRevenue = (revenueLines || []).reduce((s: number, r: any) => {
    return s + (Number(r.credit || 0) - Number(r.debit || 0))
  }, 0)

  // Expenses this month
  const { data: expenseLines } = await supabase
    .from('journal_entry_lines')
    .select(`
      debit, credit,
      journal_entries!inner(date, status, company_id),
      accounts!inner(code, type)
    `)
    .eq('journal_entries.company_id', company_id)
    .eq('journal_entries.status', 'posted')
    .in('accounts.type', ['expense', 'cogs'])
    .gte('journal_entries.date', monthStart)
    .lte('journal_entries.date', today)

  const monthlyExpenses = (expenseLines || []).reduce((s: number, r: any) => {
    return s + (Number(r.debit || 0) - Number(r.credit || 0))
  }, 0)

  const netProfit   = monthlyRevenue - monthlyExpenses
  const cashBalance = (accountMap['1101'] || 0) + (accountMap['1102'] || 0)
  const arBalance   = accountMap['1110'] || 0
  const apBalance   = accountMap['2101'] || 0

  // Recent journal entries
  const { data: recentEntries } = await supabase
    .from('journal_entries')
    .select('id, entry_number, date, description, status, total_debit, auto_generated, source')
    .eq('company_id', company_id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Counts by status
  const { data: statusCounts } = await supabase
    .from('journal_entries')
    .select('status')
    .eq('company_id', company_id)

  const counts = { draft: 0, pending: 0, posted: 0, reversed: 0 }
  for (const r of statusCounts || []) {
    if (r.status in counts) counts[r.status as keyof typeof counts]++
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">لوحة تحكم المحاسبة</h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link
          href="/dashboard/accounting/journal"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <BookOpen className="h-4 w-4" />
          قيود جديدة
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          title="إيرادات الشهر"
          value={formatCurrency(monthlyRevenue, currency)}
          icon={TrendingUp}
          color="bg-green-500"
          trend={monthlyRevenue > 0 ? 'up' : 'neutral'}
          href="/dashboard/accounting/statements?type=income"
        />
        <KpiCard
          title="مصروفات الشهر"
          value={formatCurrency(monthlyExpenses, currency)}
          icon={TrendingDown}
          color="bg-red-500"
          trend={monthlyExpenses > 0 ? 'down' : 'neutral'}
          href="/dashboard/accounting/statements?type=income"
        />
        <KpiCard
          title="صافي الربح"
          value={formatCurrency(netProfit, currency)}
          icon={DollarSign}
          color={netProfit >= 0 ? 'bg-blue-500' : 'bg-orange-500'}
          trendLabel={netProfit >= 0 ? 'ربح' : 'خسارة'}
          trend={netProfit >= 0 ? 'up' : 'down'}
        />
        <KpiCard
          title="ذمم مدينة"
          value={formatCurrency(arBalance, currency)}
          icon={Users}
          color="bg-purple-500"
          trendLabel="إجمالي المستحق"
          href="/dashboard/accounting/ledger?account_code=1110"
        />
        <KpiCard
          title="النقد والبنك"
          value={formatCurrency(cashBalance, currency)}
          icon={DollarSign}
          color="bg-teal-500"
          trendLabel="رصيد الخزينة"
          href="/dashboard/accounting/ledger?account_code=1101"
        />
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'مسودة', count: counts.draft, color: 'border-gray-200 bg-gray-50', icon: Clock, textColor: 'text-gray-600' },
          { label: 'معلقة', count: counts.pending, color: 'border-yellow-200 bg-yellow-50', icon: AlertCircle, textColor: 'text-yellow-700' },
          { label: 'مرحّلة', count: counts.posted, color: 'border-green-200 bg-green-50', icon: CheckCircle, textColor: 'text-green-700' },
          { label: 'معكوسة', count: counts.reversed, color: 'border-red-200 bg-red-50', icon: ArrowUpRight, textColor: 'text-red-600' },
        ].map(({ label, count, color, icon: Icon, textColor }) => (
          <div key={label} className={`rounded-lg border p-4 flex items-center gap-3 ${color}`}>
            <Icon className={`h-5 w-5 ${textColor}`} />
            <div>
              <p className={`text-xl font-bold ${textColor}`}>{count}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Entries */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-600" />
            آخر القيود المحاسبية
          </h3>
          <Link
            href="/dashboard/accounting/journal"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            عرض الكل
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                <th className="px-4 py-2 text-right font-medium">رقم القيد</th>
                <th className="px-4 py-2 text-right font-medium">التاريخ</th>
                <th className="px-4 py-2 text-right font-medium">الوصف</th>
                <th className="px-4 py-2 text-right font-medium">المصدر</th>
                <th className="px-4 py-2 text-right font-medium">المبلغ (مدين)</th>
                <th className="px-4 py-2 text-right font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(recentEntries || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    لا توجد قيود محاسبية بعد
                  </td>
                </tr>
              ) : (recentEntries || []).map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-blue-700">{entry.entry_number}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.date}</td>
                  <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{entry.description}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      entry.auto_generated ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {entry.auto_generated ? 'تلقائي' : 'يدوي'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {formatCurrency(entry.total_debit, currency)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={entry.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/dashboard/accounting/statements?type=income',  label: 'قائمة الدخل',       color: 'bg-green-50 border-green-200 text-green-700' },
          { href: '/dashboard/accounting/statements?type=balance', label: 'الميزانية العمومية', color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { href: '/dashboard/accounting/trial-balance',           label: 'ميزان المراجعة',     color: 'bg-purple-50 border-purple-200 text-purple-700' },
          { href: '/dashboard/accounting/coa',                     label: 'شجرة الحسابات',     color: 'bg-orange-50 border-orange-200 text-orange-700' },
        ].map(({ href, label, color }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center justify-center gap-2 p-4 rounded-xl border text-sm font-medium transition-all hover:shadow-sm ${color}`}
          >
            <ArrowUpRight className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
