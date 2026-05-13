'use client'

import { useState, useEffect } from 'react'
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2,
  RefreshCw, FileWarning, Search, ArrowUpRight,
} from 'lucide-react'
import Link from 'next/link'

interface IntegrityResult {
  check: string
  status: 'passed' | 'failed' | 'warning'
  details: Record<string, any>
}

const CHECK_LABELS: Record<string, { title: string; description: string }> = {
  unbalanced_entries: { title: 'قيد غير متوازن', description: 'التأكد من أن جميع القيود المرحلة متوازنة (مجموع المدين = مجموع الدائن)' },
  orphaned_lines: { title: 'بنود يتيمة', description: 'التأكد من عدم وجود بنود قيد بدون قيد رئيسي' },
  draft_entries: { title: 'قيود مسودة', description: 'عدد القيود غير المرحلة (مسودة)' },
  missing_periods: { title: 'فترة مالية ناقصة', description: 'التأكد من أن جميع القيود مرتبطة بفترة مالية' },
}

export function IntegrityClient({
  companyId, currency,
}: {
  companyId: string
  currency: string
}) {
  const [results, setResults] = useState<IntegrityResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runCount, setRunCount] = useState(0)

  async function runChecks() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/accounting/integrity', {
        headers: { 'x-tenant-id': companyId },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'فشل تشغيل الفحوصات')
      } else {
        setResults(data.data || data)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRunCount(r => r + 1)
    }
  }

  useEffect(() => { runChecks() }, [])

  const statusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'failed': return <XCircle className="h-5 w-5 text-red-500" />
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      default: return <Loader2 className="h-5 w-5 text-gray-400" />
    }
  }

  const passedCount = results.filter(r => r.status === 'passed').length
  const failedCount = results.filter(r => r.status === 'failed').length
  const warningCount = results.filter(r => r.status === 'warning').length

  return (
    <div className="p-6 space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">فحوصات النزاهة</h1>
          <p className="text-sm text-gray-500 mt-1">التحقق من سلامة البيانات المالية والنزاهة المحاسبية</p>
        </div>
        <button onClick={runChecks} disabled={loading}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          تشغيل الفحوصات
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <XCircle className="h-4 w-4" />{error}
        </div>
      )}

      {runCount === 0 && loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-3" />
          <p className="text-gray-500">جاري تشغيل فحوصات النزاهة...</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{passedCount}</p>
            <p className="text-sm text-gray-500">ناجح</p>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{failedCount}</p>
            <p className="text-sm text-gray-500">فاشل</p>
          </div>
          <div className="bg-white rounded-xl border border-yellow-200 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{warningCount}</p>
            <p className="text-sm text-gray-500">تحذير</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {results.map((result) => {
          const label = CHECK_LABELS[result.check] || { title: result.check, description: '' }
          return (
            <div key={result.check}
              className={`bg-white rounded-xl border p-4 ${
                result.status === 'failed' ? 'border-red-200' :
                result.status === 'warning' ? 'border-yellow-200' :
                'border-green-200'
              }`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{statusIcon(result.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900">{label.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      result.status === 'passed' ? 'bg-green-100 text-green-700' :
                      result.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {result.status === 'passed' ? 'ناجح' : result.status === 'failed' ? 'فاشل' : 'تحذير'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{label.description}</p>

                  {result.details && (
                    <div className="mt-2 text-sm text-gray-600">
                      {result.details.count !== undefined && (
                        <p>العدد: <span className="font-medium">{result.details.count}</span></p>
                      )}
                      {result.details.entries && result.details.entries.length > 0 && (
                        <Link href={`/dashboard/accounting/ledger`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 mt-1">
                          عرض التفاصيل <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
