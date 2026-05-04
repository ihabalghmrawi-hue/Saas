'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Download, Upload, Trash2, RefreshCw, Shield, Clock,
  CheckCircle2, XCircle, Loader2, AlertTriangle, Database,
  FileJson, FileText, ChevronDown, ChevronUp, RotateCcw,
  HardDrive, Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Snapshot {
  id:            string
  label:         string
  type:          'manual' | 'auto'
  format:        'json' | 'csv'
  file_size:     number
  table_counts:  Record<string, number> | null
  status:        'pending' | 'ready' | 'failed' | 'restoring'
  error_message: string | null
  created_at:    string
  expires_at:    string
}

interface Props {
  initialSnapshots: Snapshot[]
  availableTables:  string[]
}

const TABLE_LABELS: Record<string, string> = {
  product_categories: 'فئات المنتجات',
  units:              'وحدات القياس',
  warehouses:         'المستودعات',
  expense_categories: 'فئات المصروفات',
  products:           'المنتجات',
  product_variants:   'متغيرات المنتجات',
  inventory:          'المخزون',
  customers:          'العملاء',
  suppliers:          'الموردين',
  sales:              'المبيعات',
  sale_items:         'بنود المبيعات',
  sale_payments:      'مدفوعات المبيعات',
  purchases:          'المشتريات',
  purchase_items:     'بنود المشتريات',
  purchase_payments:  'مدفوعات المشتريات',
  expenses:           'المصروفات',
  dresses:            'الفساتين',
  rental_orders:      'الحجوزات',
  rental_pricing_rules: 'قواعد التسعير',
}

function fmtBytes(b: number) {
  if (b < 1024)        return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function totalRows(counts: Record<string, number> | null) {
  if (!counts) return 0
  return Object.values(counts).reduce((s, n) => s + n, 0)
}

const STATUS_BADGE: Record<Snapshot['status'], { label: string; class: string; icon: React.ElementType }> = {
  ready:     { label: 'جاهزة',       class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',  icon: CheckCircle2 },
  pending:   { label: 'جاري...',      class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',      icon: Loader2 },
  restoring: { label: 'استعادة...',   class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',  icon: Loader2 },
  failed:    { label: 'فشل',          class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',          icon: XCircle },
}

export function BackupClient({ initialSnapshots, availableTables }: Props) {
  const [snapshots, setSnapshots]   = useState<Snapshot[]>(initialSnapshots)
  const [creating, setCreating]     = useState(false)
  const [restoring, setRestoring]   = useState<string | null>(null)
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [csvTable, setCsvTable]     = useState(availableTables[0] || '')
  const [showRestore, setShowRestore] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const reload = useCallback(async () => {
    const res = await fetch('/api/backup/list')
    if (res.ok) setSnapshots(await res.json())
  }, [])

  // ── Create backup ─────────────────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/backup/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'manual' }) })
      const json = await res.json()
      if (!res.ok) { notify(json.error || 'فشل إنشاء النسخة', 'error'); return }
      notify(`✅ تم إنشاء النسخة — ${totalRows(json.counts).toLocaleString('ar')} صف`)
      await reload()
    } finally { setCreating(false) }
  }, [notify, reload])

  // ── Download backup ───────────────────────────────────────────────────────
  const handleDownload = useCallback(async (snap: Snapshot) => {
    const res  = await fetch(`/api/backup/download/${snap.id}`)
    const json = await res.json()
    if (!res.ok) { notify(json.error || 'فشل التحميل', 'error'); return }
    const a = document.createElement('a')
    a.href = json.url
    a.download = json.filename
    a.click()
  }, [notify])

  // ── Restore from snapshot ─────────────────────────────────────────────────
  const handleRestore = useCallback(async (snap: Snapshot) => {
    if (!confirm(`هل أنت متأكد من استعادة البيانات من "${snap.label}"؟\nسيتم الكتابة فوق البيانات الحالية.`)) return
    setRestoring(snap.id)
    try {
      const res  = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot_id: snap.id }),
      })
      const json = await res.json()
      if (res.status === 422) { notify(`خطأ في التحقق: ${json.details?.join(' — ')}`, 'error'); return }
      if (res.status === 500) { notify(json.error || 'فشل الاستعادة', 'error'); return }
      if (res.status === 207) { notify(`اكتملت مع أخطاء: ${json.errors?.join(' | ')}`, 'error'); return }
      const total = Object.values(json.restored as Record<string, number>).reduce((s, n) => s + n, 0)
      notify(`✅ تمت الاستعادة — ${total.toLocaleString('ar')} صف`)
    } finally { setRestoring(null); await reload() }
  }, [notify, reload])

  // ── Restore from uploaded file ────────────────────────────────────────────
  const handleFileRestore = useCallback(async (file: File) => {
    const text = await file.text()
    setRestoring('file')
    try {
      const res  = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json_text: text }),
      })
      const json = await res.json()
      if (!res.ok && res.status !== 207) { notify(json.error || json.details?.join(' — ') || 'فشل الاستعادة', 'error'); return }
      const total = Object.values((json.restored || {}) as Record<string, number>).reduce((s, n) => s + n, 0)
      notify(`✅ تمت الاستعادة من الملف — ${total.toLocaleString('ar')} صف`)
    } finally { setRestoring(null); setShowRestore(false) }
  }, [notify])

  // ── Delete backup ─────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (snap: Snapshot) => {
    if (!confirm(`حذف النسخة "${snap.label}"؟`)) return
    setDeleting(snap.id)
    const res = await fetch(`/api/backup/${snap.id}`, { method: 'DELETE' })
    if (res.ok) { setSnapshots(prev => prev.filter(s => s.id !== snap.id)); notify('تم الحذف') }
    else { notify('فشل الحذف', 'error') }
    setDeleting(null)
  }, [notify])

  // ── CSV export ────────────────────────────────────────────────────────────
  const handleCSV = () => {
    window.open(`/api/backup/export-csv?table=${csvTable}`, '_blank')
  }

  const manualSnaps = snapshots.filter(s => s.type === 'manual')
  const autoSnaps   = snapshots.filter(s => s.type === 'auto')

  return (
    <div className="space-y-6 max-w-4xl" dir="rtl">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all',
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white',
        )}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          النسخ الاحتياطية
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          حفظ واستعادة بيانات شركتك بأمان — كل النسخ مشفرة ومخزنة في Supabase Storage
        </p>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Create backup */}
        <div className="bg-card border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Database className="w-4 h-4 text-primary" />
            نسخة احتياطية جديدة
          </div>
          <p className="text-xs text-muted-foreground">تصدير كامل لبيانات النظام بصيغة JSON</p>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-all"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {creating ? 'جاري الإنشاء...' : 'إنشاء نسخة'}
          </button>
        </div>

        {/* CSV export */}
        <div className="bg-card border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="w-4 h-4 text-green-600" />
            تصدير CSV
          </div>
          <select
            value={csvTable}
            onChange={e => setCsvTable(e.target.value)}
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-background"
          >
            {availableTables.map(t => (
              <option key={t} value={t}>{TABLE_LABELS[t] || t}</option>
            ))}
          </select>
          <button
            onClick={handleCSV}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-all"
          >
            <FileText className="w-4 h-4" />
            تحميل CSV
          </button>
        </div>

        {/* Restore from file */}
        <div className="bg-card border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Upload className="w-4 h-4 text-amber-600" />
            استعادة من ملف
          </div>
          <p className="text-xs text-muted-foreground">رفع ملف JSON لاستعادة البيانات</p>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileRestore(f) }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={restoring === 'file'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 disabled:opacity-60 transition-all"
          >
            {restoring === 'file' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {restoring === 'file' ? 'جاري الاستعادة...' : 'رفع ملف JSON'}
          </button>
        </div>
      </div>

      {/* Auto-backup info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl text-sm">
        <Calendar className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-blue-700 dark:text-blue-400">النسخ الاحتياطية التلقائية</p>
          <p className="text-blue-600 dark:text-blue-500 text-xs mt-0.5">
            يتم إنشاء نسخة تلقائية كل يوم عبر Vercel Cron ← <code className="font-mono">/api/backup/auto</code>.
            يتم الاحتفاظ بآخر 30 نسخة تلقائية تلقائياً.
          </p>
        </div>
      </div>

      {/* Manual snapshots list */}
      <SnapshotList
        title="النسخ اليدوية"
        icon={<HardDrive className="w-4 h-4" />}
        snapshots={manualSnaps}
        expandedId={expandedId}
        restoring={restoring}
        deleting={deleting}
        onToggle={id => setExpandedId(prev => prev === id ? null : id)}
        onDownload={handleDownload}
        onRestore={handleRestore}
        onDelete={handleDelete}
        onReload={reload}
      />

      {/* Auto snapshots list */}
      <SnapshotList
        title="النسخ التلقائية"
        icon={<Clock className="w-4 h-4" />}
        snapshots={autoSnaps}
        expandedId={expandedId}
        restoring={restoring}
        deleting={deleting}
        onToggle={id => setExpandedId(prev => prev === id ? null : id)}
        onDownload={handleDownload}
        onRestore={handleRestore}
        onDelete={handleDelete}
        onReload={reload}
      />
    </div>
  )
}

// ── Snapshot list sub-component ───────────────────────────────────────────────
interface ListProps {
  title:      string
  icon:       React.ReactNode
  snapshots:  Snapshot[]
  expandedId: string | null
  restoring:  string | null
  deleting:   string | null
  onToggle:   (id: string) => void
  onDownload: (s: Snapshot) => void
  onRestore:  (s: Snapshot) => void
  onDelete:   (s: Snapshot) => void
  onReload:   () => void
}

function SnapshotList({
  title, icon, snapshots,
  expandedId, restoring, deleting,
  onToggle, onDownload, onRestore, onDelete, onReload,
}: ListProps) {
  return (
    <div className="bg-card border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          {icon}
          {title}
          <span className="text-xs text-muted-foreground font-normal">({snapshots.length})</span>
        </h2>
        <button onClick={onReload} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {snapshots.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-sm">لا توجد نسخ احتياطية بعد</div>
      ) : (
        <div className="divide-y divide-border">
          {snapshots.map(snap => {
            const badge   = STATUS_BADGE[snap.status]
            const BadgeIcon = badge.icon
            const isExp   = expandedId === snap.id
            const counts  = snap.table_counts || {}
            const rows    = totalRows(snap.table_counts)

            return (
              <div key={snap.id}>
                {/* Row */}
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20">
                  <FileJson className="w-4 h-4 text-muted-foreground shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{snap.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(snap.created_at)} · {rows.toLocaleString('ar')} صف · {fmtBytes(snap.file_size || 0)}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span className={cn('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium shrink-0', badge.class)}>
                    <BadgeIcon className={cn('w-3 h-3', snap.status !== 'ready' && 'animate-spin')} />
                    {badge.label}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {snap.status === 'ready' && (
                      <>
                        <button
                          onClick={() => onDownload(snap)}
                          title="تحميل"
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onRestore(snap)}
                          disabled={restoring === snap.id}
                          title="استعادة"
                          className="p-1.5 rounded-lg hover:bg-amber-100 text-muted-foreground hover:text-amber-700 disabled:opacity-40"
                        >
                          {restoring === snap.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <RotateCcw className="w-3.5 h-3.5" />
                          }
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => onDelete(snap)}
                      disabled={deleting === snap.id}
                      title="حذف"
                      className="p-1.5 rounded-lg hover:bg-red-100 text-muted-foreground hover:text-red-600 disabled:opacity-40"
                    >
                      {deleting === snap.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>
                    <button
                      onClick={() => onToggle(snap.id)}
                      className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
                    >
                      {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isExp && (
                  <div className="bg-muted/30 px-4 py-3 border-t">
                    {snap.error_message && (
                      <div className="flex items-start gap-2 mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-700">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        {snap.error_message}
                      </div>
                    )}
                    <p className="text-xs font-medium text-muted-foreground mb-2">تفاصيل الجداول</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {Object.entries(counts)
                        .filter(([, n]) => (n as number) > 0)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .map(([tbl, n]) => (
                          <div key={tbl} className="flex items-center justify-between bg-background rounded-lg px-3 py-1.5">
                            <span className="text-xs text-muted-foreground truncate">{TABLE_LABELS[tbl] || tbl}</span>
                            <span className="text-xs font-bold tabular-nums ml-2">{(n as number).toLocaleString('ar')}</span>
                          </div>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      تنتهي في: {fmtDate(snap.expires_at)}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
