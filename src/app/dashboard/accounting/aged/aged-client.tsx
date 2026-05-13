'use client'

import { useState } from 'react'
import {
  Users, Building2, Loader2, AlertCircle, Download,
} from 'lucide-react'

function formatNumber(n: number) {
  return n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface AgedItem {
  account_id: string
  entry_number: string
  account_name: string
  invoice_date: string
  amount: number
  days_overdue: number
}

interface AgedReport {
  as_of_date: string
  total_0_30: number
  total_31_60: number
  total_61_90: number
  total_90_plus: number
  grand_total: number
  buckets: {
    '0-30': AgedItem[]
    '31-60': AgedItem[]
    '61-90': AgedItem[]
    '90+': AgedItem[]
  }
}

export function AgedClient({
  company_id, currency,
}: {
  company_id: string
  currency: string
}) {
  const [type, setType] = useState<'receivables' | 'payables'>('receivables')
  const [report, setReport] = useState<AgedReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchReport() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/accounting/aged?type=${type}`, {
        headers: { 'x-tenant-id': company_id },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'فشل تحميل التقرير')
      } else {
        setReport(data.data)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const bucketConfig = [
    { key: '0-30' as const, label: 'من 0 إلى 30 يوم', color: 'bg-green-50 border-green-200 text-green-700' },
    { key: '31-60' as const, label: 'من 31 إلى 60 يوم', color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
    { key: '61-90' as const, label: 'من 61 إلى 90 يوم', color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { key: '90+' as const, label: 'أكثر من 90 يوم', color: 'bg-red-50 border-red-200 text-red-700' },
  ]

  return (
    <div className="p-6 space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">التقارير العمرية</h1>
          <p className="text-sm text-gray-500 mt-1">تحليل الذمم المدينة والدائنة حسب الفترات العمرية</p>
        </div>
        <button onClick={fetchReport} disabled={loading}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          تحميل التقرير
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4" />{error}
        </div>
      )}

      {/* Type Toggle */}
      <div className="flex gap-2">
        <button onClick={() => { setType('receivables'); setReport(null) }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
            type === 'receivables'
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}>
          <Users className="h-4 w-4" />
          ذمم مدينة (عملاء)
        </button>
        <button onClick={() => { setType('payables'); setReport(null) }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
            type === 'payables'
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}>
          <Building2 className="h-4 w-4" />
          ذمم دائنة (موردين)
        </button>
      </div>

      {!report && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <p>اضغط "تحميل التقرير" لعرض البيانات</p>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-3" />
          <p className="text-gray-500">جاري تحميل التقرير...</p>
        </div>
      )}

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-500">الإجمالي</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(report.grand_total)}</p>
            </div>
            {bucketConfig.map(({ key, label, color }) => (
              <div key={key} className={`rounded-xl border p-4 shadow-sm ${color}`}>
                <p className="text-xs mb-1">{label}</p>
                <p className="text-lg font-bold">{formatNumber(report.buckets[key].length)}</p>
                <p className="text-xs mt-0.5">{formatNumber(report[`total_${key.replace('-', '_')}` as keyof AgedReport] as number)}</p>
              </div>
            ))}
          </div>

          {/* Bucket Tables */}
          {bucketConfig.map(({ key, label, color }) => (
            <div key={key} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className={`px-5 py-3 border-b ${color}`}>
                <h3 className="font-semibold">{label}</h3>
              </div>
              {report.buckets[key].length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">لا توجد عناصر</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs">
                        <th className="px-4 py-2 text-right font-medium">رقم القيد</th>
                        <th className="px-4 py-2 text-right font-medium">الحساب</th>
                        <th className="px-4 py-2 text-right font-medium">تاريخ الفاتورة</th>
                        <th className="px-4 py-2 text-left font-medium">المبلغ</th>
                        <th className="px-4 py-2 text-left font-medium">الأيام</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {report.buckets[key].map((item, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-mono text-xs text-blue-700">{item.entry_number}</td>
                          <td className="px-4 py-2">{item.account_name}</td>
                          <td className="px-4 py-2 text-gray-600">{item.invoice_date}</td>
                          <td className="px-4 py-2 text-left font-medium">{formatNumber(item.amount)}</td>
                          <td className="px-4 py-2 text-left">{item.days_overdue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
