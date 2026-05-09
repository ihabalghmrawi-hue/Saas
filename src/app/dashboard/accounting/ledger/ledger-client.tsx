'use client'

import { useState, useCallback } from 'react'
import { Search, Printer, RefreshCw, BookMarked, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Account {
  id:              string
  code:            string
  name:            string
  name_ar:         string
  type:            string
  normal_balance:  string
  current_balance: number
}

interface Period {
  id:            string
  name:          string
  start_date:    string
  end_date:      string
  period_number: number
}

interface LedgerEntry {
  date:             string
  entry_number:     string
  description:      string
  debit:            number
  credit:           number
  balance:          number
  journal_entry_id: string
  source:           string
  source_document:  string | null
}

interface LedgerAccount {
  account_id:      string
  code:            string
  name:            string
  name_ar:         string
  type:            string
  normal_balance:  string
  opening_balance: number
  entries:         LedgerEntry[]
  closing_balance: number
  total_debit:     number
  total_credit:    number
}

function formatNum(n: number) {
  return Math.abs(n).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const TYPE_LABEL: Record<string, string> = {
  asset: 'أصول', liability: 'خصوم', equity: 'حقوق ملكية',
  revenue: 'إيرادات', cogs: 'تكلفة', expense: 'مصروفات',
}

export function LedgerClient({
  accounts, periods, company_id, currency,
}: {
  accounts:   Account[]
  periods:    Period[]
  company_id: string
  currency:   string
}) {
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [dateTo, setDateTo]     = useState(new Date().toISOString().slice(0, 10))
  const [periodId, setPeriodId] = useState('')
  const [loading, setLoading]   = useState(false)
  const [ledgerData, setLedgerData] = useState<LedgerAccount[] | null>(null)
  const [error, setError]       = useState<string | null>(null)

  const accountsByType = accounts.reduce((g, a) => {
    const label = TYPE_LABEL[a.type] || a.type
    if (!g[label]) g[label] = []
    g[label].push(a)
    return g
  }, {} as Record<string, Account[]>)

  const fetchLedger = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (selectedAccountId) params.set('account_id', selectedAccountId)
      if (dateFrom && !periodId)    params.set('date_from', dateFrom)
      if (dateTo   && !periodId)    params.set('date_to',   dateTo)
      if (periodId)                 params.set('period_id', periodId)

      const res = await fetch(`/api/accounting/ledger?${params}`, {
        headers: { 'x-tenant-id': company_id },
      })
      if (!res.ok) throw new Error((await res.json()).error || 'فشل تحميل البيانات')

      const data = await res.json()
      setLedgerData(Array.isArray(data) ? data : [data])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [selectedAccountId, dateFrom, dateTo, periodId, company_id])

  function printLedger() {
    window.print()
  }

  const selectedAccount = accounts.find(a => a.id === selectedAccountId)

  return (
    <div className="p-6 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">دفتر الأستاذ العام</h1>
          <p className="text-sm text-gray-500 mt-1">عرض حركات الحسابات والأرصدة</p>
        </div>
        <button
          onClick={printLedger}
          className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          <Printer className="h-4 w-4" />
          طباعة
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">الحساب</label>
            <select
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">كل الحسابات (له حركات)</option>
              {Object.entries(accountsByType).map(([type, accts]) => (
                <optgroup key={type} label={type}>
                  {accts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name_ar}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">الفترة</label>
            <select
              value={periodId}
              onChange={e => setPeriodId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">تحديد بالتاريخ</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {!periodId && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">من تاريخ</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">إلى تاريخ</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={fetchLedger}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : <Search className="h-4 w-4" />
            }
            عرض الأستاذ
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Ledger Data */}
      {ledgerData && ledgerData.map(account => (
        <div key={account.account_id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Account Header */}
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookMarked className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-bold text-gray-900">
                  <span className="font-mono text-blue-700 ml-2">{account.code}</span>
                  {account.name_ar}
                </h3>
                <p className="text-xs text-gray-500">
                  {TYPE_LABEL[account.type] || account.type} · {account.normal_balance === 'debit' ? 'مدين' : 'دائن'} طبيعياً
                </p>
              </div>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="text-xs text-gray-400">إجمالي مدين</p>
                <p className="font-bold text-blue-700">{formatNum(account.total_debit)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400">إجمالي دائن</p>
                <p className="font-bold text-red-600">{formatNum(account.total_credit)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400">الرصيد الختامي</p>
                <p className={`font-bold ${account.closing_balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                  {account.closing_balance < 0 ? '-' : ''}{formatNum(account.closing_balance)}
                </p>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
                  <th className="px-4 py-2 text-right font-medium">التاريخ</th>
                  <th className="px-4 py-2 text-right font-medium">رقم القيد</th>
                  <th className="px-4 py-2 text-right font-medium">الوصف</th>
                  <th className="px-4 py-2 text-right font-medium">المصدر</th>
                  <th className="px-4 py-2 text-left font-medium">مدين</th>
                  <th className="px-4 py-2 text-left font-medium">دائن</th>
                  <th className="px-4 py-2 text-left font-medium">الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {/* Opening Balance Row */}
                <tr className="bg-blue-50/50 font-medium text-xs">
                  <td className="px-4 py-2 text-gray-500" colSpan={4}>رصيد افتتاحي</td>
                  <td className="px-4 py-2 text-left text-gray-400">—</td>
                  <td className="px-4 py-2 text-left text-gray-400">—</td>
                  <td className={`px-4 py-2 text-left font-bold ${
                    account.opening_balance < 0 ? 'text-red-600' : 'text-gray-900'
                  }`}>
                    {account.opening_balance < 0 ? '-' : ''}{formatNum(account.opening_balance)}
                  </td>
                </tr>

                {account.entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-xs">
                      لا توجد حركات في هذه الفترة
                    </td>
                  </tr>
                ) : account.entries.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{entry.date}</td>
                    <td className="px-4 py-2 font-mono text-xs text-blue-700">{entry.entry_number}</td>
                    <td className="px-4 py-2 text-gray-900 max-w-xs">
                      <p className="truncate">{entry.description}</p>
                      {entry.source_document && (
                        <p className="text-xs text-gray-400">#{entry.source_document}</p>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-gray-500">{entry.source}</span>
                    </td>
                    <td className="px-4 py-2 text-left">
                      {entry.debit > 0
                        ? <span className="text-blue-700 font-medium flex items-center justify-end gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {formatNum(entry.debit)}
                          </span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-2 text-left">
                      {entry.credit > 0
                        ? <span className="text-red-600 font-medium flex items-center justify-end gap-1">
                            <TrendingDown className="h-3 w-3" />
                            {formatNum(entry.credit)}
                          </span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className={`px-4 py-2 text-left font-medium ${
                      entry.balance < 0 ? 'text-red-600' :
                      entry.balance === 0 ? 'text-gray-400' : 'text-gray-900'
                    }`}>
                      {entry.balance < 0 ? '-' : ''}{formatNum(entry.balance)}
                    </td>
                  </tr>
                ))}

                {/* Closing Balance Row */}
                <tr className="bg-gray-50 font-bold text-xs border-t-2 border-gray-200">
                  <td className="px-4 py-2 text-gray-700" colSpan={4}>الرصيد الختامي</td>
                  <td className="px-4 py-2 text-left text-blue-700">{formatNum(account.total_debit)}</td>
                  <td className="px-4 py-2 text-left text-red-600">{formatNum(account.total_credit)}</td>
                  <td className={`px-4 py-2 text-left font-bold text-base ${
                    account.closing_balance < 0 ? 'text-red-600' : 'text-gray-900'
                  }`}>
                    {account.closing_balance < 0 ? '-' : ''}{formatNum(account.closing_balance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {ledgerData && ledgerData.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <BookMarked className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p>لا توجد حركات في الفترة المحددة</p>
        </div>
      )}

      {!ledgerData && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Search className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">حدد حساباً وفترة ثم اضغط "عرض الأستاذ"</p>
        </div>
      )}
    </div>
  )
}
