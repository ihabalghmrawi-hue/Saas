'use client'

import { useState } from 'react'
import {
  AlertTriangle, ShieldAlert, Trash2, RotateCcw,
  Eye, EyeOff, Loader2, CheckCircle2, XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const CONFIRM_PHRASE = 'DELETE MY BUSINESS DATA'

const TABLE_LABELS: Record<string, string> = {
  customers:     'العملاء',
  suppliers:     'الموردون',
  products:      'المنتجات',
  sales:         'المبيعات',
  purchases:     'المشتريات',
  expenses:      'المصروفات',
  dresses:       'الفساتين',
  rental_orders: 'الحجوزات',
}

interface Props {
  counts:       Record<string, number>
  resetHistory: Array<{
    confirmed_at:   string
    initiated_by:   string
    tables_cleared: Record<string, number> | null
    backup_id:      string | null
  }>
}

export function DangerZoneClient({ counts, resetHistory }: Props) {
  const [phrase, setPhrase]   = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<{ ok: boolean; msg: string; backupId?: string } | null>(null)
  const [step, setStep]       = useState<1 | 2>(1)

  const totalRows = Object.values(counts).reduce((s, n) => s + n, 0)
  const phraseOk  = phrase === CONFIRM_PHRASE

  const handleReset = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res  = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm_phrase: phrase, password }),
      })
      const json = await res.json()
      if (res.ok) {
        setResult({ ok: true, msg: json.message || 'تمت إعادة الضبط بنجاح', backupId: json.backupId })
        setPhrase('')
        setPassword('')
        setStep(1)
      } else {
        setResult({ ok: false, msg: json.error || 'فشل' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2 text-red-600">
          <ShieldAlert className="w-5 h-5" />
          منطقة الخطر
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          عمليات لا يمكن التراجع عنها — تأكد من عمل نسخة احتياطية أولاً
        </p>
      </div>

      {/* Result banner */}
      {result && (
        <div className={cn(
          'flex items-start gap-3 p-4 rounded-2xl border',
          result.ok
            ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
            : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300',
        )}>
          {result.ok ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 shrink-0 mt-0.5" />}
          <div>
            <p className="font-medium">{result.msg}</p>
            {result.backupId && (
              <p className="text-sm mt-1 opacity-80">
                تم حفظ نسخة احتياطية تلقائية قبل الحذف.{' '}
                <a href="/dashboard/settings/backup" className="underline font-medium">عرض النسخ الاحتياطية</a>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Data overview */}
      <div className="bg-card border rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-red-500" />
          البيانات الحالية التي ستُحذف
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(counts).map(([tbl, cnt]) => (
            <div key={tbl} className={cn(
              'rounded-xl p-3 text-center',
              cnt > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-muted/50',
            )}>
              <p className={cn('text-xl font-bold tabular-nums', cnt > 0 ? 'text-red-600' : 'text-muted-foreground')}>
                {cnt.toLocaleString('ar')}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{TABLE_LABELS[tbl] || tbl}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          إجمالي: <span className="font-bold text-red-600">{totalRows.toLocaleString('ar')} سجل</span> سيتم حذفها
        </p>
      </div>

      {/* Reset form */}
      <div className="bg-card border-2 border-red-200 dark:border-red-900 rounded-2xl p-5 space-y-5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <h2 className="font-bold text-red-700 dark:text-red-400">إعادة ضبط المصنع</h2>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          ستُحذف جميع بيانات الشركة: المبيعات، المنتجات، العملاء، الموردين، المصروفات، الفساتين، الحجوزات.
          <strong className="text-foreground"> يُحتفظ بحسابات المستخدمين وإعدادات الشركة.</strong>
          <br />
          سيتم إنشاء نسخة احتياطية تلقائية قبل الحذف.
        </p>

        {/* Step 1: review */}
        {step === 1 && (
          <button
            onClick={() => setStep(2)}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700"
          >
            <AlertTriangle className="w-4 h-4" />
            متابعة لتأكيد الحذف
          </button>
        )}

        {/* Step 2: confirm */}
        {step === 2 && (
          <div className="space-y-4 border-t pt-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-sm text-amber-800 dark:text-amber-400">
              اكتب العبارة التالية بالضبط للتأكيد:
              <code className="block mt-1 font-mono font-bold text-red-700 dark:text-red-400 text-base">
                {CONFIRM_PHRASE}
              </code>
            </div>

            <div className="space-y-3">
              <input
                value={phrase}
                onChange={e => setPhrase(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                className={cn(
                  'w-full border rounded-xl px-4 py-2.5 font-mono text-sm bg-background transition-colors',
                  phrase && !phraseOk && 'border-red-400 bg-red-50 dark:bg-red-900/10',
                  phraseOk && 'border-green-500 bg-green-50 dark:bg-green-900/10',
                )}
                dir="ltr"
              />

              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="كلمة المرور"
                  className="w-full border rounded-xl px-4 py-2.5 text-sm bg-background pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute top-1/2 -translate-y-1/2 left-3 text-muted-foreground"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                disabled={!phraseOk || !password || loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {loading ? 'جاري الحذف...' : 'تأكيد إعادة الضبط'}
              </button>
              <button
                onClick={() => { setStep(1); setPhrase(''); setPassword('') }}
                className="px-4 py-2.5 border rounded-xl text-sm hover:bg-accent"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reset history */}
      {resetHistory.length > 0 && (
        <div className="bg-card border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b bg-muted/30">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
              سجل إعادة الضبط السابقة
            </h3>
          </div>
          <div className="divide-y divide-border">
            {resetHistory.map((r, i) => {
              const total = Object.values(r.tables_cleared || {}).reduce((s, n) => s + (n as number), 0)
              return (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(r.confirmed_at).toLocaleString('ar-SA')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      بواسطة {r.initiated_by || '—'} · {total.toLocaleString('ar')} سجل محذوف
                    </p>
                  </div>
                  {r.backup_id && (
                    <a href="/dashboard/settings/backup"
                      className="text-xs text-primary hover:underline flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" />
                      نسخة احتياطية
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
