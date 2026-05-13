'use client'

import { useState, useMemo } from 'react'
import {
  AlertTriangle, AlertCircle, Info, Lightbulb,
  Loader2, RefreshCw, Search, ArrowUpRight,
} from 'lucide-react'
import Link from 'next/link'

export function AnomaliesClient({
  company_id, currency,
}: {
  company_id: string
  currency: string
}) {
  const [anomalies, setAnomalies] = useState<any[]>([])
  const [insights, setInsights] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/accounting/anomalies', {
        headers: { 'x-tenant-id': company_id },
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'فشل التحميل')
      } else {
        setAnomalies(data.data?.anomalies || [])
        setInsights(data.data?.insights || [])
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'medium': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default: return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  return (
    <div className="p-6 space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الذكاء المحاسبي</h1>
          <p className="text-sm text-gray-500 mt-1">كشف الحالات الشاذة والرؤى المالية</p>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          تحليل
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4" />{error}
        </div>
      )}

      {!loading && anomalies.length === 0 && insights.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Lightbulb className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p>اضغط "تحليل" لكشف الحالات الشاذة والرؤى المالية</p>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-3" />
          <p className="text-gray-500">جاري التحليل...</p>
        </div>
      )}

      {anomalies.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            الحالات الشاذة ({anomalies.length})
          </h2>
          <div className="space-y-2">
            {anomalies.map((a, i) => (
              <div key={i} className={`bg-white rounded-xl border p-4 shadow-sm ${
                a.severity === 'high' ? 'border-red-200' : a.severity === 'medium' ? 'border-yellow-200' : 'border-blue-200'
              }`}>
                <div className="flex items-start gap-3">
                  {severityIcon(a.severity)}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{a.message}</p>
                    {a.suggestion && (
                      <p className="text-xs text-gray-500 mt-1">اقتراح: {a.suggestion}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    a.severity === 'high' ? 'bg-red-100 text-red-700' :
                    a.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {a.severity === 'high' ? 'عالية' : a.severity === 'medium' ? 'متوسطة' : 'منخفضة'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {insights.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-blue-500" />
            الرؤى المالية ({insights.length})
          </h2>
          <div className="grid gap-2">
            {insights.map((ins, i) => (
              <div key={i} className={`bg-white rounded-xl border p-4 shadow-sm ${
                ins.severity === 'positive' ? 'border-green-200 bg-green-50/30' :
                ins.severity === 'warning' ? 'border-yellow-200' :
                'border-gray-200'
              }`}>
                <div className="flex items-start gap-3">
                  {severityIcon(ins.severity)}
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{ins.message}</p>
                  </div>
                  {ins.action_url && (
                    <Link href={ins.action_url}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                      عرض <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
