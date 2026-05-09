'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, TrendingDown, Scale, DollarSign,
  Printer, RefreshCw, CheckCircle, AlertTriangle,
  ChevronDown, ChevronUp,
} from 'lucide-react'

interface StatementLine {
  code:      string
  name:      string
  name_ar:   string
  amount:    number
  children?: StatementLine[]
}

interface IncomeStatement {
  period_from:        string
  period_to:          string
  revenue:            StatementLine[]
  cogs:               StatementLine[]
  gross_profit:       number
  operating_expenses: StatementLine[]
  operating_income:   number
  other_income:       StatementLine[]
  net_income:         number
}

interface BalanceSheet {
  as_of_date: string
  assets:     { current: StatementLine[]; fixed: StatementLine[]; total: number }
  liabilities: { current: StatementLine[]; long_term: StatementLine[]; total: number }
  equity:     { items: StatementLine[]; total: number }
  is_balanced: boolean
}

interface TrialBalanceLine {
  account_id:    string
  code:          string
  name:          string
  name_ar:       string
  type:          string
  closing_debit:  number
  closing_credit: number
  balance:       number
}

interface TrialBalance {
  as_of_date:   string
  lines:        TrialBalanceLine[]
  total_debit:  number
  total_credit: number
  is_balanced:  boolean
}

interface CashFlow {
  period_from:  string
  period_to:    string
  operating:    { items: StatementLine[]; total: number }
  investing:    { items: StatementLine[]; total: number }
  financing:    { items: StatementLine[]; total: number }
  net_change:   number
  opening_cash: number
  closing_cash: number
}

function fmt(n: number, currency = '') {
  const abs = Math.abs(n)
  const s   = abs.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `(${s})` : s
}

function AmountRow({ label, amount, indent = 0, bold = false, highlight = '' }: {
  label: string; amount: number; indent?: number; bold?: boolean; highlight?: string
}) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${highlight} ${indent ? `pr-${indent * 4}` : ''}`}
      style={{ paddingRight: indent ? `${indent * 16}px` : undefined }}>
      <span className={`text-sm ${bold ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{label}</span>
      <span className={`text-sm font-medium ${
        amount < 0 ? 'text-red-600' : bold ? 'text-gray-900 font-bold' : 'text-gray-700'
      }`}>
        {fmt(amount)}
      </span>
    </div>
  )
}

function SectionLines({ title, lines }: { title: string; lines: StatementLine[] }) {
  if (lines.length === 0) return null
  return (
    <div className="mb-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 border-b pb-1">{title}</p>
      {lines.map((l, i) => (
        <AmountRow key={i} label={l.name_ar} amount={l.amount} indent={1} />
      ))}
    </div>
  )
}

const QUICK_RANGES = [
  { label: 'هذا الشهر',     value: 'month' },
  { label: 'هذا الربع',     value: 'quarter' },
  { label: 'هذه السنة',     value: 'year' },
  { label: 'مخصص',          value: 'custom' },
]

export function StatementsClient({
  incomeStatement, balanceSheet, trialBalance, cashFlow,
  company_id, currency,
  initialTab, initialDateFrom, initialDateTo, initialAsOf,
}: {
  incomeStatement: IncomeStatement | null
  balanceSheet:    BalanceSheet | null
  trialBalance:    TrialBalance | null
  cashFlow:        CashFlow | null
  company_id:      string
  currency:        string
  initialTab:      string
  initialDateFrom: string
  initialDateTo:   string
  initialAsOf:     string
}) {
  const router              = useRouter()
  const [tab, setTab]       = useState(initialTab)
  const [dateFrom, setDateFrom] = useState(initialDateFrom)
  const [dateTo, setDateTo]     = useState(initialDateTo)
  const [asOf, setAsOf]         = useState(initialAsOf)
  const [range, setRange]       = useState('month')
  const [loading, setLoading]   = useState(false)

  function applyRange(r: string) {
    const now  = new Date()
    const year = now.getFullYear()
    const m    = now.getMonth()
    let from = '', to = now.toISOString().slice(0, 10)

    if (r === 'month') {
      from = `${year}-${String(m + 1).padStart(2, '0')}-01`
    } else if (r === 'quarter') {
      const q = Math.floor(m / 3)
      from = `${year}-${String(q * 3 + 1).padStart(2, '0')}-01`
    } else if (r === 'year') {
      from = `${year}-01-01`
    }
    setRange(r)
    if (r !== 'custom') {
      setDateFrom(from)
      setDateTo(to)
    }
  }

  function handleRefresh() {
    setLoading(true)
    const params = new URLSearchParams({ type: tab, date_from: dateFrom, date_to: dateTo, as_of: asOf })
    router.push(`/dashboard/accounting/statements?${params}`)
  }

  const is = incomeStatement
  const bs = balanceSheet
  const tb = trialBalance
  const cf = cashFlow

  const tabs = [
    { id: 'income',   label: 'قائمة الدخل',       icon: TrendingUp },
    { id: 'balance',  label: 'الميزانية العمومية', icon: Scale },
    { id: 'trial',    label: 'ميزان المراجعة',     icon: CheckCircle },
    { id: 'cashflow', label: 'التدفقات النقدية',   icon: DollarSign },
  ]

  return (
    <div className="p-6 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">القوائم المالية</h1>
          <p className="text-sm text-gray-500 mt-1">التقارير المالية الشاملة</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            <Printer className="h-4 w-4" />
            طباعة
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>
      </div>

      {/* Date Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          {/* Quick range */}
          <div className="flex gap-1">
            {QUICK_RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => applyRange(r.value)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  range === r.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Date inputs */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setRange('custom') }}
              className="px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400 text-xs">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setRange('custom') }}
              className="px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {tab === 'balance' && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">حتى تاريخ:</label>
              <input
                type="date"
                value={asOf}
                onChange={e => setAsOf(e.target.value)}
                className="px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ── INCOME STATEMENT ─────────────────────────────── */}
      {tab === 'income' && is && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-2xl">
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-gray-900">قائمة الدخل</h2>
            <p className="text-sm text-gray-500">من {is.period_from} إلى {is.period_to}</p>
          </div>

          <SectionLines title="الإيرادات" lines={is.revenue} />
          <AmountRow label="إجمالي الإيرادات" amount={is.revenue.reduce((s, l) => s + l.amount, 0)} bold />

          <div className="my-3 border-t" />

          <SectionLines title="تكلفة البضاعة المباعة" lines={is.cogs} />
          <AmountRow label="إجمالي التكلفة" amount={is.cogs.reduce((s, l) => s + l.amount, 0)} bold />

          <div className="my-3 border-t" />

          <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${
            is.gross_profit >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <span className="font-bold text-gray-900">مجمل الربح</span>
            <span className={`font-bold text-lg ${is.gross_profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {fmt(is.gross_profit)}
            </span>
          </div>

          <div className="my-3 border-t" />

          <SectionLines title="المصروفات التشغيلية" lines={is.operating_expenses} />
          <AmountRow label="إجمالي المصروفات التشغيلية" amount={is.operating_expenses.reduce((s, l) => s + l.amount, 0)} bold />

          <div className="my-3 border-t" />

          <AmountRow label="الربح التشغيلي" amount={is.operating_income} bold />

          {is.other_income.length > 0 && (
            <>
              <div className="my-3 border-t" />
              <SectionLines title="إيرادات أخرى" lines={is.other_income} />
            </>
          )}

          <div className="mt-4 border-t-2 border-gray-800">
            <div className={`flex items-center justify-between py-3 px-3 rounded-lg mt-2 ${
              is.net_income >= 0 ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <span className="font-bold text-lg text-gray-900">صافي الدخل</span>
              <span className={`font-bold text-2xl ${is.net_income >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {fmt(is.net_income)} {currency}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── BALANCE SHEET ────────────────────────────────── */}
      {tab === 'balance' && bs && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-gray-500">الميزانية العمومية حتى</span>
            <span className="font-medium text-gray-900">{bs.as_of_date}</span>
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              bs.is_balanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {bs.is_balanced ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {bs.is_balanced ? 'متوازنة' : 'غير متوازنة'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Assets */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-bold text-blue-800 mb-4 text-base border-b pb-2">الأصول</h3>

              <p className="text-xs font-bold text-gray-500 mb-2">الأصول المتداولة</p>
              {bs.assets.current.map((l, i) => (
                <AmountRow key={i} label={l.name_ar} amount={l.amount} indent={1} />
              ))}
              <AmountRow label="إجمالي الأصول المتداولة"
                amount={bs.assets.current.reduce((s, l) => s + l.amount, 0)} bold />

              <div className="my-2 border-t border-dashed" />

              <p className="text-xs font-bold text-gray-500 mb-2">الأصول الثابتة</p>
              {bs.assets.fixed.map((l, i) => (
                <AmountRow key={i} label={l.name_ar} amount={l.amount} indent={1} />
              ))}
              <AmountRow label="إجمالي الأصول الثابتة"
                amount={bs.assets.fixed.reduce((s, l) => s + l.amount, 0)} bold />

              <div className="mt-3 border-t-2 border-blue-300">
                <div className="flex items-center justify-between py-2 bg-blue-50 px-2 rounded mt-1">
                  <span className="font-bold text-blue-900">إجمالي الأصول</span>
                  <span className="font-bold text-blue-900 text-lg">{fmt(bs.assets.total)}</span>
                </div>
              </div>
            </div>

            {/* Liabilities + Equity */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-bold text-orange-800 mb-4 text-base border-b pb-2">الخصوم وحقوق الملكية</h3>

              <p className="text-xs font-bold text-gray-500 mb-2">الخصوم المتداولة</p>
              {bs.liabilities.current.map((l, i) => (
                <AmountRow key={i} label={l.name_ar} amount={l.amount} indent={1} />
              ))}
              <AmountRow label="إجمالي الخصوم المتداولة"
                amount={bs.liabilities.current.reduce((s, l) => s + l.amount, 0)} bold />

              {bs.liabilities.long_term.length > 0 && (
                <>
                  <div className="my-2 border-t border-dashed" />
                  <p className="text-xs font-bold text-gray-500 mb-2">الخصوم طويلة الأجل</p>
                  {bs.liabilities.long_term.map((l, i) => (
                    <AmountRow key={i} label={l.name_ar} amount={l.amount} indent={1} />
                  ))}
                  <AmountRow label="إجمالي الخصوم طويلة الأجل"
                    amount={bs.liabilities.long_term.reduce((s, l) => s + l.amount, 0)} bold />
                </>
              )}

              <AmountRow label="إجمالي الخصوم" amount={bs.liabilities.total} bold />

              <div className="my-2 border-t border-dashed" />

              <p className="text-xs font-bold text-gray-500 mb-2">حقوق الملكية</p>
              {bs.equity.items.map((l, i) => (
                <AmountRow key={i} label={l.name_ar} amount={l.amount} indent={1} />
              ))}
              <AmountRow label="إجمالي حقوق الملكية" amount={bs.equity.total} bold />

              <div className="mt-3 border-t-2 border-orange-300">
                <div className="flex items-center justify-between py-2 bg-orange-50 px-2 rounded mt-1">
                  <span className="font-bold text-orange-900">إجمالي الخصوم وحقوق الملكية</span>
                  <span className="font-bold text-orange-900 text-lg">
                    {fmt(bs.liabilities.total + bs.equity.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TRIAL BALANCE ────────────────────────────────── */}
      {tab === 'trial' && tb && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-900">ميزان المراجعة — حتى {tb.as_of_date}</span>
            <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              tb.is_balanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {tb.is_balanced ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {tb.is_balanced ? 'متوازن' : 'غير متوازن'}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
                <th className="px-4 py-2 text-right font-medium">رمز</th>
                <th className="px-4 py-2 text-right font-medium">اسم الحساب</th>
                <th className="px-4 py-2 text-right font-medium">النوع</th>
                <th className="px-4 py-2 text-left font-medium">مدين</th>
                <th className="px-4 py-2 text-left font-medium">دائن</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tb.lines.map(line => (
                <tr key={line.account_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs text-blue-700">{line.code}</td>
                  <td className="px-4 py-2 text-gray-900">{line.name_ar}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{line.type}</td>
                  <td className={`px-4 py-2 text-left font-medium ${line.closing_debit > 0 ? 'text-blue-700' : 'text-gray-300'}`}>
                    {line.closing_debit > 0 ? fmt(line.closing_debit) : '—'}
                  </td>
                  <td className={`px-4 py-2 text-left font-medium ${line.closing_credit > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                    {line.closing_credit > 0 ? fmt(line.closing_credit) : '—'}
                  </td>
                </tr>
              ))}
              <tr className={`border-t-2 font-bold ${tb.is_balanced ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                <td colSpan={3} className="px-4 py-2 text-right">الإجمالي</td>
                <td className="px-4 py-2 text-left text-blue-800">{fmt(tb.total_debit)}</td>
                <td className="px-4 py-2 text-left text-red-700">{fmt(tb.total_credit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── CASH FLOW ────────────────────────────────────── */}
      {tab === 'cashflow' && cf && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-2xl">
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-gray-900">قائمة التدفقات النقدية</h2>
            <p className="text-sm text-gray-500">من {cf.period_from} إلى {cf.period_to}</p>
          </div>

          {/* Opening */}
          <AmountRow label="الرصيد النقدي الافتتاحي" amount={cf.opening_cash} bold />
          <div className="my-3 border-t" />

          {/* Operating */}
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">التدفقات من الأنشطة التشغيلية</p>
          {cf.operating.items.map((l, i) => (
            <AmountRow key={i} label={l.name_ar} amount={l.amount} indent={1} />
          ))}
          <AmountRow label="صافي التدفقات التشغيلية" amount={cf.operating.total} bold
            highlight={cf.operating.total >= 0 ? 'bg-green-50 rounded px-2' : 'bg-red-50 rounded px-2'} />

          {cf.investing.items.length > 0 && (
            <>
              <div className="my-3 border-t" />
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">التدفقات من الأنشطة الاستثمارية</p>
              {cf.investing.items.map((l, i) => (
                <AmountRow key={i} label={l.name_ar} amount={l.amount} indent={1} />
              ))}
              <AmountRow label="صافي التدفقات الاستثمارية" amount={cf.investing.total} bold />
            </>
          )}

          {cf.financing.items.length > 0 && (
            <>
              <div className="my-3 border-t" />
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">التدفقات من الأنشطة التمويلية</p>
              {cf.financing.items.map((l, i) => (
                <AmountRow key={i} label={l.name_ar} amount={l.amount} indent={1} />
              ))}
              <AmountRow label="صافي التدفقات التمويلية" amount={cf.financing.total} bold />
            </>
          )}

          <div className="mt-4 border-t-2 border-gray-800 space-y-2 pt-3">
            <AmountRow label="صافي التغير في النقد" amount={cf.net_change} bold />
            <div className={`flex items-center justify-between py-3 px-3 rounded-lg ${
              cf.closing_cash >= 0 ? 'bg-blue-100' : 'bg-red-100'
            }`}>
              <span className="font-bold text-lg text-gray-900">الرصيد النقدي الختامي</span>
              <span className={`font-bold text-2xl ${cf.closing_cash >= 0 ? 'text-blue-800' : 'text-red-700'}`}>
                {fmt(cf.closing_cash)} {currency}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Empty States */}
      {tab === 'income'    && !is && <EmptyState />}
      {tab === 'balance'   && !bs && <EmptyState />}
      {tab === 'trial'     && !tb && <EmptyState />}
      {tab === 'cashflow'  && !cf && <EmptyState />}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
      <TrendingUp className="h-10 w-10 mx-auto mb-3 text-gray-300" />
      <p className="text-sm">لا توجد بيانات كافية لإنشاء هذه القائمة</p>
      <p className="text-xs mt-1">تأكد من وجود قيود مرحّلة في الفترة المحددة</p>
    </div>
  )
}
