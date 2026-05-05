'use client'

import { useState } from 'react'
import { ShieldCheck, AlertTriangle, XCircle, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react'

interface IntegrityIssue {
  type:        string
  severity:    'warning' | 'critical'
  description: string
  entity_id?:  string
  expected?:   number
  actual?:     number
  diff?:       number
}

interface CheckResult {
  ok:           boolean
  checked_at:   string
  total_issues: number
  critical:     number
  warnings:     number
  issues:       IntegrityIssue[]
  summary:      string
}

export default function IntegrityPage() {
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<CheckResult | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  const runCheck = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/integrity', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'فشل الفحص'); return }
      setResult(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            فحص سلامة البيانات المالية
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            يتحقق من توازن الصندوق، القيود المحاسبية، وتطابق التقارير مع البيانات الخام
          </p>
        </div>
        <button
          onClick={runCheck}
          disabled={loading}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-all"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? 'جاري الفحص...' : 'تشغيل الفحص'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-2xl text-red-700 dark:text-red-400 text-sm">
          <XCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      {/* Result summary */}
      {result && (
        <>
          <div className={`flex items-center gap-3 p-5 rounded-2xl border ${
            result.ok
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : result.critical > 0
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
          }`}>
            {result.ok
              ? <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
              : result.critical > 0
                ? <XCircle className="w-6 h-6 text-red-600 shrink-0" />
                : <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            }
            <div className="flex-1">
              <p className="font-semibold text-foreground">{result.summary}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                آخر فحص: {new Date(result.checked_at).toLocaleString('ar-SA')}
              </p>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <p className="font-bold text-red-600">{result.critical}</p>
                <p className="text-xs text-muted-foreground">حرجة</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-amber-600">{result.warnings}</p>
                <p className="text-xs text-muted-foreground">تحذيرات</p>
              </div>
            </div>
          </div>

          {/* Issues list */}
          {result.issues.length > 0 ? (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">المشاكل المكتشفة</h3>
              {result.issues.map((issue, i) => (
                <div key={i} className={`p-4 rounded-xl border ${
                  issue.severity === 'critical'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                }`}>
                  <div className="flex items-start gap-3">
                    {issue.severity === 'critical'
                      ? <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{issue.description}</p>
                      {(issue.expected !== undefined || issue.actual !== undefined) && (
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          {issue.expected !== undefined && (
                            <span>المتوقع: <span className="font-mono font-medium text-foreground">{issue.expected?.toFixed(2)}</span></span>
                          )}
                          {issue.actual !== undefined && (
                            <span>الفعلي: <span className="font-mono font-medium text-foreground">{issue.actual?.toFixed(2)}</span></span>
                          )}
                          {issue.diff !== undefined && (
                            <span className="text-red-600 font-medium">الفرق: {issue.diff.toFixed(2)}</span>
                          )}
                        </div>
                      )}
                      {issue.entity_id && (
                        <p className="text-xs text-muted-foreground/60 mt-1 font-mono">{issue.entity_id}</p>
                      )}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      issue.severity === 'critical'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40'
                    }`}>
                      {issue.severity === 'critical' ? 'حرج' : 'تحذير'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
              لا توجد مشاكل — البيانات المالية متسقة
            </div>
          )}
        </>
      )}

      {/* Info card when no check ran yet */}
      {!result && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: '💰', title: 'رصيد الصندوق', desc: 'يتحقق أن رصيد الصندوق = مجموع الحركات' },
            { icon: '📊', title: 'القيود المحاسبية', desc: 'كل بيع وشراء له قيد مزدوج متوازن' },
            { icon: '📋', title: 'تطابق التقارير', desc: 'إيرادات التقارير = إيرادات دفتر الأستاذ' },
            { icon: '⚖️', title: 'توازن القيود', desc: 'مجموع المدين = مجموع الدائن لكل قيد' },
          ].map(card => (
            <div key={card.title} className="bg-card border rounded-xl p-4 flex items-start gap-3">
              <span className="text-2xl">{card.icon}</span>
              <div>
                <p className="font-semibold text-sm">{card.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        يتم تشغيل فحص تلقائي يومياً في الساعة 3:00 صباحاً · النتائج تُسجَّل في سجل الأحداث
      </p>
    </div>
  )
}
