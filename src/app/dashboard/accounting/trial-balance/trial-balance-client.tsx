'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Scale, Printer, RefreshCw, CheckCircle, AlertTriangle, Filter,
} from 'lucide-react'

interface TrialBalanceLine {
  account_id:     string
  code:           string
  name:           string
  name_ar:        string
  type:           string
  opening_debit:  number
  opening_credit: number
  period_debit:   number
  period_credit:  number
  closing_debit:  number
  closing_credit: number
  balance:        number
}

interface TrialBalance {
  as_of_date:   string
  lines:        TrialBalanceLine[]
  total_debit:  number
  total_credit: number
  is_balanced:  boolean
}

const TYPE_LABEL: Record<string, string> = {
  asset:     'الأصول',
  liability: 'الخصوم',
  equity:    'حقوق الملكية',
  revenue:   'الإيرادات',
  cogs:      'تكلفة المبيعات',
  expense:   'المصروفات',
}

const TYPE_ORDER = ['asset', 'liability', 'equity', 'revenue', 'cogs', 'expense']

function formatNum(n: number) {
  if (n === 0) return '—'
  return n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function TrialBalanceClient({
  trialBalance,
  company_id,
  currency,
  initialDateFrom,
  initialDateTo,
}: {
  trialBalance:   TrialBalance
  company_id:     string
  currency:       string
  initialDateFrom: string
  initialDateTo:   string
}) {
  const router                    = useRouter()
  const [dateFrom, setDateFrom]   = useState(initialDateFrom)
  const [dateTo, setDateTo]       = useState(initialDateTo)
  const [showZero, setShowZero]   = useState(false)
  const [loading, setLoading]     = useState(false)

  function handleFilter() {
    setLoading(true)
    const params = new URLSearchParams()
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo)   params.set('date_to', dateTo)
    router.push(`/dashboard/accounting/trial-balance?${params}`)
  }

  const filteredLines = useMemo(() => {
    if (showZero) return trialBalance.lines
    return trialBalance.lines.filter(l => l.closing_debit > 0 || l.closing_credit > 0)
  }, [trialBalance.lines, showZero])

  const grouped = useMemo(() => {
    const g: Record<string, TrialBalanceLine[]> = {}
    for (const line of filteredLines) {
      if (!g[line.type]) g[line.type] = []
      g[line.type].push(line)
    }
    return g
  }, [filteredLines])

  return (
    <div className="p-6 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ميزان المراجعة</h1>
          <p className="text-sm text-gray-500 mt-1">
            حتى تاريخ {trialBalance.as_of_date}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            trialBalance.is_balanced
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {trialBalance.is_balanced
              ? <CheckCircle className="h-4 w-4" />
              : <AlertTriangle className="h-4 w-4" />
            }
            {trialBalance.is_balanced ? 'الميزان متوازن' : 'الميزان غير متوازن'}
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">من تاريخ</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleFilter}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
            تحديث
          </button>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mr-auto">
            <input
              type="checkbox"
              checked={showZero}
              onChange={e => setShowZero(e.target.checked)}
              className="rounded border-gray-300"
            />
            إظهار الحسابات ذات الرصيد الصفري
          </label>
        </div>
      </div>

      {/* Trial Balance Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
              <th className="px-4 py-3 text-right font-medium">رمز</th>
              <th className="px-4 py-3 text-right font-medium">اسم الحساب</th>
              <th className="px-4 py-3 text-left font-medium">مدين</th>
              <th className="px-4 py-3 text-left font-medium">دائن</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {TYPE_ORDER.filter(t => grouped[t]).map(type => (
              <>
                {/* Group Header */}
                <tr key={`group-${type}`} className="bg-blue-50/60 border-t border-blue-100">
                  <td colSpan={4} className="px-4 py-2">
                    <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                      {TYPE_LABEL[type] || type}
                    </span>
                  </td>
                </tr>
                {grouped[type].map(line => (
                  <tr key={line.account_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs text-blue-700">{line.code}</td>
                    <td className="px-4 py-2 text-gray-900">{line.name_ar}</td>
                    <td className={`px-4 py-2 text-left font-medium ${
                      line.closing_debit > 0 ? 'text-blue-700' : 'text-gray-300'
                    }`}>
                      {formatNum(line.closing_debit)}
                    </td>
                    <td className={`px-4 py-2 text-left font-medium ${
                      line.closing_credit > 0 ? 'text-red-600' : 'text-gray-300'
                    }`}>
                      {formatNum(line.closing_credit)}
                    </td>
                  </tr>
                ))}
                {/* Group subtotal */}
                <tr key={`subtotal-${type}`} className="bg-gray-50 text-xs font-semibold">
                  <td colSpan={2} className="px-4 py-2 text-gray-600 text-left">
                    إجمالي {TYPE_LABEL[type]}
                  </td>
                  <td className="px-4 py-2 text-left text-blue-700">
                    {formatNum(grouped[type].reduce((s, l) => s + l.closing_debit, 0))}
                  </td>
                  <td className="px-4 py-2 text-left text-red-600">
                    {formatNum(grouped[type].reduce((s, l) => s + l.closing_credit, 0))}
                  </td>
                </tr>
              </>
            ))}

            {/* Grand Total */}
            <tr className={`border-t-2 font-bold ${
              trialBalance.is_balanced ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
            }`}>
              <td colSpan={2} className={`px-4 py-3 text-left text-base ${
                trialBalance.is_balanced ? 'text-green-800' : 'text-red-800'
              }`}>
                {trialBalance.is_balanced ? '✓ الإجمالي متوازن' : '✗ الإجمالي غير متوازن'}
              </td>
              <td className="px-4 py-3 text-left text-blue-800 text-base">
                {trialBalance.total_debit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-left text-red-700 text-base">
                {trialBalance.total_credit.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {filteredLines.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Scale className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p>لا توجد حسابات بأرصدة في هذه الفترة</p>
        </div>
      )}
    </div>
  )
}
