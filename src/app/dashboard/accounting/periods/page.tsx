'use client'

import { useState, useEffect } from 'react'
import { Calendar, Lock, Unlock, CheckCircle, Plus, Loader2, AlertCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function PeriodsPage() {
  const [fiscalYears, setFiscalYears] = useState<any[]>([])
  const [periods, setPeriods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch('/api/accounting/periods')
      if (res.ok) {
        const data = await res.json()
        setFiscalYears(data.fiscal_years || [])
        setPeriods(data.periods || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  async function handleAction(action: string, periodId?: string) {
    setActionLoading(action + (periodId || ''))
    setError(null)
    try {
      const res = await fetch('/api/accounting/periods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_id: periodId, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'فشل العملية')
      } else {
        setSuccess(action === 'lock' ? 'تم إغلاق الفترة' : action === 'unlock' ? 'تم فتح الفترة' : 'تم بنجاح')
        await fetchData()
        setTimeout(() => setSuccess(null), 3000)
      }
    } finally {
      setActionLoading(null)
    }
  }

  async function ensureFiscalYear() {
    setActionLoading('ensure')
    try {
      const res = await fetch('/api/accounting/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ensure_fiscal_year' }),
      })
      if (res.ok) {
        setSuccess('تم إنشاء السنة المالية')
        await fetchData()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const data = await res.json()
        setError(data.error || 'فشل إنشاء السنة المالية')
      }
    } finally {
      setActionLoading(null)
    }
  }

  const periodsByFY = periods.reduce((g: Record<string, any[]>, p: any) => {
    if (!g[p.fiscal_year_id]) g[p.fiscal_year_id] = []
    g[p.fiscal_year_id].push(p)
    return g
  }, {})

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الفترات المالية</h1>
          <p className="text-sm text-gray-500 mt-1">إدارة السنوات والفترات المحاسبية — الفترات المغلقة تمنع الترحيل</p>
        </div>
        <button onClick={ensureFiscalYear} disabled={actionLoading === 'ensure'}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {actionLoading === 'ensure' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          إنشاء السنة الحالية
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4" />{error}
          <button onClick={() => setError(null)} className="mr-auto"><span>&times;</span></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          <CheckCircle className="h-4 w-4" />{success}
        </div>
      )}

      {fiscalYears.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Calendar className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p>لا توجد سنوات مالية. اضغط "إنشاء السنة الحالية"</p>
        </div>
      ) : fiscalYears.map((fy: any) => (
        <div key={fy.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  {fy.name}
                  {fy.is_current && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                      <CheckCircle className="h-3 w-3" /> الحالية
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500">{fy.start_date} — {fy.end_date}</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {(periodsByFY[fy.id] || []).length} فترة
              <span className="mr-2 text-xs">
                ({periodsByFY[fy.id]?.filter((p: any) => p.status === 'closed').length || 0} مغلقة)
              </span>
            </div>
          </div>

          <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {(periodsByFY[fy.id] || [])
              .sort((a: any, b: any) => a.period_number - b.period_number)
              .map((period: any) => (
              <div key={period.id}
                className={`rounded-lg border p-3 transition-all ${
                  period.status === 'closed'
                    ? 'bg-gray-50 border-gray-200 opacity-70'
                    : 'bg-blue-50 border-blue-200 cursor-pointer hover:shadow-md'
                }`}
                onClick={() => {
                  if (period.status === 'open') {
                    if (confirm(`هل أنت متأكد من إغلاق "${period.name}"؟`)) {
                      handleAction('lock', period.id)
                    }
                  }
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-700">{period.period_number}</span>
                  {period.status === 'closed'
                    ? <Lock className="h-3 w-3 text-gray-400" />
                    : <Unlock className="h-3 w-3 text-blue-500" />
                  }
                </div>
                <p className="text-xs font-medium text-gray-800">{period.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {period.start_date.slice(5)} — {period.end_date.slice(5)}
                </p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    period.status === 'closed'
                      ? 'bg-gray-100 text-gray-500'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {period.status === 'closed' ? 'مغلقة' : 'مفتوحة'}
                  </span>
                  {period.status === 'closed' && (
                    <button onClick={(e) => {
                      e.stopPropagation()
                      handleAction('unlock', period.id)
                    }}
                      className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-0.5">
                      فتح
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
