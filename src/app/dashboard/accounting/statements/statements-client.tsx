'use client'

import { useState, useMemo } from 'react'
import {
  BarChart3, Wallet, Scale, DollarSign,
  ChevronDown, ChevronUp, Download, RefreshCw,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'

interface StatementLine { code: string; name: string; name_ar: string; amount: number; children?: StatementLine[] }

interface IncomeStatement {
  period_from: string; period_to: string
  revenue: StatementLine[]; cogs: StatementLine[]
  gross_profit: number; operating_expenses: StatementLine[]
  operating_income: number; other_income: StatementLine[]
  net_income: number
}

interface BalanceSheet {
  as_of_date: string
  assets: { current: StatementLine[]; fixed: StatementLine[]; total: number }
  liabilities: { current: StatementLine[]; long_term: StatementLine[]; total: number }
  equity: { items: StatementLine[]; total: number }
  is_balanced: boolean
}

interface TrialBalanceLine {
  code: string; name: string; name_ar: string; type: string
  opening_debit: number; opening_credit: number
  period_debit: number; period_credit: number
  closing_debit: number; closing_credit: number
  balance: number
}

interface TrialBalance { as_of_date: string; lines: TrialBalanceLine[]; total_debit: number; total_credit: number; is_balanced: boolean }

interface CashFlow { period_from: string; period_to: string; operating: { items: StatementLine[]; total: number }; investing: { items: StatementLine[]; total: number }; financing: { items: StatementLine[]; total: number }; net_change: number; opening_cash: number; closing_cash: number }

function formatNumber(n: number) {
  return n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function StatementLineRow({ line, depth = 0 }: { line: StatementLine; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const hasChildren = line.children && line.children.length > 0

  return (
    <div>
      <div className={`flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 rounded ${
        depth === 0 ? 'text-sm font-bold text-gray-900' : depth === 1 ? 'text-sm font-semibold text-gray-800' : 'text-xs text-gray-700'
      }`}
        style={{ paddingRight: `${12 + depth * 16}px` }}
      >
        {hasChildren && (
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400">
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        )}
        {!hasChildren && <span className="w-3" />}
        <span className="font-mono text-xs text-blue-700 ml-2">{line.code}</span>
        <span className="flex-1">{line.name_ar}</span>
        <span className={`text-left w-28 ${line.amount < 0 ? 'text-red-600' : ''}`}>
          {formatNumber(Math.abs(line.amount))}
        </span>
      </div>
      {hasChildren && expanded && line.children?.map((child, i) => (
        <StatementLineRow key={i} line={child} depth={depth + 1} />
      ))}
    </div>
  )
}

export function StatementsClient({
  incomeStatement, balanceSheet, trialBalance, cashFlow,
  company_id, currency,
  initialTab, initialDateFrom, initialDateTo, initialAsOf,
}: {
  incomeStatement: IncomeStatement | null
  balanceSheet: BalanceSheet | null
  trialBalance: TrialBalance | null
  cashFlow: CashFlow | null
  company_id: string
  currency: string
  initialTab?: string
  initialDateFrom: string
  initialDateTo: string
  initialAsOf: string
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'income')
  const [dateFrom, setDateFrom] = useState(initialDateFrom)
  const [dateTo, setDateTo] = useState(initialDateTo)
  const [asOf, setAsOf] = useState(initialAsOf)
  const [loading, setLoading] = useState(false)
  const [statements, setStatements] = useState({
    income: incomeStatement,
    balance: balanceSheet,
    trial: trialBalance,
    cashflow: cashFlow,
  })

  const tabs = [
    { id: 'income', label: 'قائمة الدخل', icon: BarChart3, badge: `${formatNumber(statements.income?.net_income || 0)}` },
    { id: 'balance', label: 'الميزانية', icon: Wallet, badge: statements.balance?.is_balanced ? 'متوازنة' : 'غير متوازنة' },
    { id: 'trial', label: 'ميزان المراجعة', icon: Scale, badge: statements.trial?.is_balanced ? 'متوازن' : 'غير متوازن' },
    { id: 'cashflow', label: 'التدفقات النقدية', icon: DollarSign, badge: `${formatNumber(statements.cashflow?.closing_cash || 0)}` },
  ]

  async function refresh() {
    setLoading(true)
    const params = new URLSearchParams()
    if (activeTab === 'income' || activeTab === 'cashflow') {
      params.set('date_from', dateFrom); params.set('date_to', dateTo)
    } else {
      params.set('as_of', asOf)
    }

    try {
      const res = await fetch(`/api/accounting/statements?type=${activeTab}&${params.toString()}`, {
        headers: { 'x-tenant-id': company_id },
      })
      if (res.ok) {
        const data = await res.json()
        setStatements(prev => ({
          ...prev,
          [activeTab === 'income' ? 'income' : activeTab === 'balance' ? 'balance' : activeTab === 'trial' ? 'trial' : 'cashflow']: data.data,
        }))
      }
    } finally {
      setLoading(false)
    }
  }

  function exportCSV() {
    const lines = activeTab === 'income'
      ? [
        ...(statements.income?.revenue || []).map(l => ({ code: l.code, name: l.name_ar, amount: l.amount })),
        ...(statements.income?.operating_expenses || []).map(l => ({ code: l.code, name: l.name_ar, amount: l.amount })),
      ]
      : activeTab === 'trial'
        ? (statements.trial?.lines || []).map(l => ({ code: l.code, name: l.name_ar, debit: l.period_debit, credit: l.period_credit }))
        : []

    if (lines.length === 0) return

    const headers = Object.keys(lines[0]).join(',')
    const csv = [headers, ...lines.map(l => Object.values(l).join(','))].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${activeTab}-${dateTo}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">القوائم المالية</h1>
          <p className="text-sm text-gray-500 mt-1">التقارير المالية للشركة</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
            <Download className="h-4 w-4" /> تصدير CSV
          </button>
          <button onClick={refresh} disabled={loading} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> تحديث
          </button>
        </div>
      </div>

      {/* Date Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex gap-3 items-end">
        {(activeTab === 'income' || activeTab === 'cashflow') ? (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1">من تاريخ</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">إلى تاريخ</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-xs text-gray-500 mb-1">في تاريخ</label>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              <Icon className="h-4 w-4" />
              {tab.label}
              <span className="text-xs opacity-75">({tab.badge})</span>
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-3" />
          <p className="text-gray-500">جاري تحديث البيانات...</p>
        </div>
      )}

      {/* Income Statement */}
      {activeTab === 'income' && statements.income && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-l from-blue-50 to-white">
            <h2 className="text-lg font-bold text-gray-900">قائمة الدخل</h2>
            <p className="text-xs text-gray-500">{statements.income.period_from} — {statements.income.period_to}</p>
          </div>
          <div className="p-4 space-y-6">
            <section>
              <h3 className="text-sm font-bold text-green-700 mb-2">الإيرادات</h3>
              {statements.income.revenue.map((l, i) => <StatementLineRow key={i} line={l} />)}
              <div className="flex items-center gap-2 px-3 py-2 mt-2 bg-green-50 rounded-lg border border-green-100">
                <span className="flex-1 text-sm font-bold text-green-800">إجمالي الإيرادات</span>
                <span className="text-sm font-bold text-green-700">{formatNumber(statements.income.revenue.reduce((s, l) => s + l.amount, 0))}</span>
              </div>
            </section>
            <section>
              <h3 className="text-sm font-bold text-orange-700 mb-2">تكلفة المبيعات</h3>
              {statements.income.cogs.map((l, i) => <StatementLineRow key={i} line={l} />)}
              <div className="flex items-center gap-2 px-3 py-2 mt-2 bg-orange-50 rounded-lg border border-orange-100">
                <span className="flex-1 text-sm font-bold text-orange-800">إجمالي التكلفة</span>
                <span className="text-sm font-bold text-orange-700">{formatNumber(statements.income.cogs.reduce((s, l) => s + l.amount, 0))}</span>
              </div>
            </section>
            <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${
              statements.income.gross_profit >= 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <span className="flex-1 font-bold">إجمالي الربح</span>
              <span className="font-bold">{formatNumber(statements.income.gross_profit)}</span>
            </div>
            <section>
              <h3 className="text-sm font-bold text-red-700 mb-2">المصروفات التشغيلية</h3>
              {statements.income.operating_expenses.map((l, i) => <StatementLineRow key={i} line={l} />)}
              <div className="flex items-center gap-2 px-3 py-2 mt-2 bg-red-50 rounded-lg border border-red-100">
                <span className="flex-1 text-sm font-bold text-red-800">إجمالي المصروفات</span>
                <span className="text-sm font-bold text-red-700">{formatNumber(statements.income.operating_expenses.reduce((s, l) => s + l.amount, 0))}</span>
              </div>
            </section>
            <div className={`flex items-center gap-2 px-4 py-4 rounded-lg border-2 ${
              statements.income.net_income >= 0 ? 'bg-green-50 border-green-300 text-green-900' : 'bg-red-50 border-red-300 text-red-900'
            }`}>
              <span className="flex-1 text-lg font-bold">صافي الدخل</span>
              <span className="text-lg font-bold">{formatNumber(statements.income.net_income)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Balance Sheet */}
      {activeTab === 'balance' && statements.balance && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-l from-blue-50 to-white">
            <h2 className="text-lg font-bold text-gray-900">الميزانية العمومية</h2>
            <p className="text-xs text-gray-500">في تاريخ: {statements.balance.as_of_date}</p>
            {statements.balance.is_balanced && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 bg-green-100 text-green-700 rounded-full text-xs">
                ✓ متوازنة
              </span>
            )}
          </div>
          <div className="p-4 space-y-6">
            <section>
              <h3 className="text-sm font-bold text-blue-700 mb-2">الأصول المتداولة</h3>
              {statements.balance.assets.current.map((l, i) => <StatementLineRow key={i} line={l} />)}
            </section>
            <section>
              <h3 className="text-sm font-bold text-blue-700 mb-2">الأصول الثابتة</h3>
              {statements.balance.assets.fixed.map((l, i) => <StatementLineRow key={i} line={l} />)}
            </section>
            <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="flex-1 font-bold text-blue-800">إجمالي الأصول</span>
              <span className="font-bold text-blue-700">{formatNumber(statements.balance.assets.total)}</span>
            </div>
            <section>
              <h3 className="text-sm font-bold text-orange-700 mb-2">الخصوم المتداولة</h3>
              {statements.balance.liabilities.current.map((l, i) => <StatementLineRow key={i} line={l} />)}
            </section>
            <section>
              <h3 className="text-sm font-bold text-orange-700 mb-2">الخصوم طويلة الأجل</h3>
              {statements.balance.liabilities.long_term.map((l, i) => <StatementLineRow key={i} line={l} />)}
            </section>
            <div className="flex items-center gap-2 px-4 py-3 bg-orange-50 rounded-lg border border-orange-200">
              <span className="flex-1 font-bold text-orange-800">إجمالي الخصوم</span>
              <span className="font-bold text-orange-700">{formatNumber(statements.balance.liabilities.total)}</span>
            </div>
            <section>
              <h3 className="text-sm font-bold text-purple-700 mb-2">حقوق الملكية</h3>
              {statements.balance.equity.items.map((l, i) => <StatementLineRow key={i} line={l} />)}
              <div className="flex items-center gap-2 px-3 py-2 mt-2 bg-purple-50 rounded-lg border border-purple-100">
                <span className="flex-1 text-sm font-bold text-purple-800">إجمالي حقوق الملكية</span>
                <span className="text-sm font-bold text-purple-700">{formatNumber(statements.balance.equity.total)}</span>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Trial Balance */}
      {activeTab === 'trial' && statements.trial && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-l from-blue-50 to-white">
            <h2 className="text-lg font-bold text-gray-900">ميزان المراجعة</h2>
            <p className="text-xs text-gray-500">في تاريخ: {statements.trial.as_of_date}</p>
            <div className={`text-xs mt-1 ${statements.trial.is_balanced ? 'text-green-600' : 'text-red-600'}`}>
              {statements.trial.is_balanced ? '✓ متوازن' : '✗ غير متوازن'}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
                  <th className="px-4 py-2 text-right font-medium">رمز</th>
                  <th className="px-4 py-2 text-right font-medium">الحساب</th>
                  <th className="px-4 py-2 text-right font-medium">النوع</th>
                  <th className="px-4 py-2 text-left font-medium">حركة مدين</th>
                  <th className="px-4 py-2 text-left font-medium">حركة دائن</th>
                  <th className="px-4 py-2 text-left font-medium">الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {statements.trial.lines.map((line, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-blue-700">{line.code}</td>
                    <td className="px-4 py-2">{line.name_ar}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border ${
                        line.type === 'asset' ? 'text-blue-700 bg-blue-50 border-blue-200' :
                        line.type === 'liability' ? 'text-orange-700 bg-orange-50 border-orange-200' :
                        line.type === 'revenue' ? 'text-green-700 bg-green-50 border-green-200' :
                        line.type === 'expense' ? 'text-red-700 bg-red-50 border-red-200' :
                        'text-gray-600 bg-gray-50 border-gray-200'
                      }`}>
                        {line.type === 'asset' ? 'أصول' : line.type === 'liability' ? 'خصوم' :
                         line.type === 'equity' ? 'حقوق ملكية' : line.type === 'revenue' ? 'إيرادات' :
                         line.type === 'cogs' ? 'تكلفة' : line.type === 'expense' ? 'مصروفات' : line.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-left font-medium text-blue-700">{formatNumber(line.period_debit)}</td>
                    <td className="px-4 py-2 text-left font-medium text-red-600">{formatNumber(line.period_credit)}</td>
                    <td className={`px-4 py-2 text-left font-medium ${line.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatNumber(line.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                  <td colSpan={3} className="px-4 py-3 text-right text-gray-700">الإجمالي</td>
                  <td className="px-4 py-3 text-left text-blue-700">{formatNumber(statements.trial.total_debit)}</td>
                  <td className="px-4 py-3 text-left text-red-600">{formatNumber(statements.trial.total_credit)}</td>
                  <td className="px-4 py-3 text-left"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Cash Flow */}
      {activeTab === 'cashflow' && statements.cashflow && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-l from-blue-50 to-white">
            <h2 className="text-lg font-bold text-gray-900">قائمة التدفقات النقدية</h2>
            <p className="text-xs text-gray-500">{statements.cashflow.period_from} — {statements.cashflow.period_to}</p>
          </div>
          <div className="p-4 space-y-6">
            <section>
              <h3 className="text-sm font-bold text-green-700 mb-2">التدفقات التشغيلية</h3>
              {statements.cashflow.operating.items.map((l, i) => <StatementLineRow key={i} line={l} />)}
              <div className="flex items-center gap-2 px-3 py-2 mt-2 bg-green-50 rounded-lg border border-green-100">
                <span className="flex-1 text-sm font-bold text-green-800">صافي التدفقات التشغيلية</span>
                <span className="text-sm font-bold text-green-700">{formatNumber(statements.cashflow.operating.total)}</span>
              </div>
            </section>
            <section>
              <h3 className="text-sm font-bold text-blue-700 mb-2">التدفقات الاستثمارية</h3>
              {statements.cashflow.investing.items.map((l, i) => <StatementLineRow key={i} line={l} />)}
              <div className="flex items-center gap-2 px-3 py-2 mt-2 bg-blue-50 rounded-lg border border-blue-100">
                <span className="flex-1 text-sm font-bold text-blue-800">صافي التدفقات الاستثمارية</span>
                <span className="text-sm font-bold text-blue-700">{formatNumber(statements.cashflow.investing.total)}</span>
              </div>
            </section>
            <section>
              <h3 className="text-sm font-bold text-purple-700 mb-2">التدفقات التمويلية</h3>
              {statements.cashflow.financing.items.map((l, i) => <StatementLineRow key={i} line={l} />)}
              <div className="flex items-center gap-2 px-3 py-2 mt-2 bg-purple-50 rounded-lg border border-purple-100">
                <span className="flex-1 text-sm font-bold text-purple-800">صافي التدفقات التمويلية</span>
                <span className="text-sm font-bold text-purple-700">{formatNumber(statements.cashflow.financing.total)}</span>
              </div>
            </section>
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex items-center gap-2 px-4 py-2">
                <span className="flex-1 text-sm text-gray-600">الرصيد الافتتاحي</span>
                <span className="text-sm font-medium">{formatNumber(statements.cashflow.opening_cash)}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2">
                <span className="flex-1 text-sm text-gray-600">صافي التغير</span>
                <span className={`text-sm font-medium ${statements.cashflow.net_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatNumber(statements.cashflow.net_change)}
                </span>
              </div>
              <div className={`flex items-center gap-2 px-4 py-4 rounded-lg border-2 ${
                statements.cashflow.closing_cash >= 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
              }`}>
                <span className="flex-1 text-lg font-bold text-gray-900">الرصيد الختامي</span>
                <span className="text-lg font-bold">{formatNumber(statements.cashflow.closing_cash)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}
