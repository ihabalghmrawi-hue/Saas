'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Plus, Search, Filter, ChevronDown, ChevronUp,
  RefreshCw, CheckCircle, RotateCcw, X, Save, Send,
  Loader2, AlertCircle,
} from 'lucide-react'

interface Account {
  id:             string
  code:           string
  name:           string
  name_ar:        string
  type:           string
  normal_balance: string
  is_postable:    boolean
}

interface JournalLine {
  id:          string
  account_id:  string
  debit:       number
  credit:      number
  description: string
  line_number: number
  accounts?:   Account
}

interface JournalEntry {
  id:                 string
  entry_number:       string
  date:               string
  description:        string
  description_ar?:    string
  reference?:         string
  status:             string
  total_debit:        number
  total_credit:       number
  is_balanced:        boolean
  source:             string
  source_document?:   string
  auto_generated:     boolean
  posted_at?:         string
  approved_by?:       string
  reversal_of?:       string
  reversal_entry_id?: string
  created_at:         string
  journal_entry_lines: JournalLine[]
}

interface FormLine {
  account_code: string
  debit:        string
  credit:       string
  description:  string
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:    { label: 'مسودة',  cls: 'bg-gray-100 text-gray-600' },
  pending:  { label: 'معلق',   cls: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'معتمد',  cls: 'bg-blue-100 text-blue-700' },
  posted:   { label: 'مرحّل',  cls: 'bg-green-100 text-green-700' },
  reversed: { label: 'معكوس',  cls: 'bg-red-100 text-red-600' },
  void:     { label: 'ملغي',   cls: 'bg-gray-100 text-gray-400' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] || { label: status, cls: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}

function SourceBadge({ auto_generated, source }: { auto_generated: boolean; source: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      auto_generated ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
    }`}>
      {auto_generated ? `تلقائي (${source})` : 'يدوي'}
    </span>
  )
}

function formatNumber(n: number) {
  return n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function JournalClient({
  initialEntries,
  accounts,
  company_id,
  currency,
}: {
  initialEntries: JournalEntry[]
  accounts:       Account[]
  company_id:     string
  currency:       string
}) {
  const [entries, setEntries]           = useState<JournalEntry[]>(initialEntries)
  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const [showModal, setShowModal]       = useState(false)
  const [loading, setLoading]           = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const [success, setSuccess]           = useState<string | null>(null)

  // Filters
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo]     = useState('')
  const [filterSearch, setFilterSearch]     = useState('')

  // New entry form
  const emptyLine = (): FormLine => ({ account_code: '', debit: '', credit: '', description: '' })
  const [form, setForm] = useState({
    description:    '',
    description_ar: '',
    reference:      '',
    date:           new Date().toISOString().slice(0, 10),
    lines:          [emptyLine(), emptyLine(), emptyLine()] as FormLine[],
  })

  // Account map for quick lookup
  const accountByCode = useMemo(() => {
    const m: Record<string, Account> = {}
    for (const a of accounts) m[a.code] = a
    return m
  }, [accounts])

  // Group accounts by type for select
  const accountsByType = useMemo(() => {
    const g: Record<string, Account[]> = {}
    for (const a of accounts) {
      const typeLabel = {
        asset: 'أصول', liability: 'خصوم', equity: 'حقوق ملكية',
        revenue: 'إيرادات', cogs: 'تكلفة المبيعات', expense: 'مصروفات',
      }[a.type] || a.type
      if (!g[typeLabel]) g[typeLabel] = []
      g[typeLabel].push(a)
    }
    return g
  }, [accounts])

  // Computed totals for form
  const formTotals = useMemo(() => {
    let debit  = 0
    let credit = 0
    for (const line of form.lines) {
      debit  += parseFloat(line.debit  || '0') || 0
      credit += parseFloat(line.credit || '0') || 0
    }
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.005 }
  }, [form.lines])

  // Filtered entries
  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filterStatus && e.status !== filterStatus) return false
      if (filterSource === 'auto'   && !e.auto_generated) return false
      if (filterSource === 'manual' && e.auto_generated)  return false
      if (filterDateFrom && e.date < filterDateFrom) return false
      if (filterDateTo   && e.date > filterDateTo)   return false
      if (filterSearch) {
        const q = filterSearch.toLowerCase()
        if (
          !e.entry_number.toLowerCase().includes(q) &&
          !e.description.toLowerCase().includes(q) &&
          !(e.reference || '').toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [entries, filterStatus, filterSource, filterDateFrom, filterDateTo, filterSearch])

  function updateLine(index: number, field: keyof FormLine, value: string) {
    setForm(prev => {
      const lines = [...prev.lines]
      lines[index] = { ...lines[index], [field]: value }
      // Clear opposite amount
      if (field === 'debit' && value) {
        lines[index].credit = ''
      } else if (field === 'credit' && value) {
        lines[index].debit = ''
      }
      return { ...prev, lines }
    })
  }

  function addLine() {
    setForm(prev => ({ ...prev, lines: [...prev.lines, emptyLine()] }))
  }

  function removeLine(index: number) {
    if (form.lines.length <= 2) return
    setForm(prev => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }))
  }

  async function fetchEntries() {
    setLoading(true)
    try {
      const res = await fetch(`/api/accounting/journal?limit=50`, {
        headers: { 'x-tenant-id': company_id },
      })
      if (res.ok) {
        const data = await res.json()
        setEntries(data.data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(submitStatus: 'draft' | 'pending') {
    setError(null)
    if (!form.description.trim()) {
      setError('وصف القيد مطلوب')
      return
    }
    if (!formTotals.balanced) {
      setError('القيد غير متوازن')
      return
    }

    const lines = form.lines
      .filter(l => l.account_code && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
      .map(l => ({
        account_code: l.account_code,
        debit:        parseFloat(l.debit)  || 0,
        credit:       parseFloat(l.credit) || 0,
        description:  l.description || undefined,
      }))

    if (lines.length < 2) {
      setError('القيد يجب أن يحتوي على سطرين على الأقل')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/accounting/journal', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': company_id },
        body:    JSON.stringify({
          description:    form.description,
          description_ar: form.description_ar || form.description,
          reference:      form.reference || undefined,
          date:           form.date,
          lines,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'فشل إنشاء القيد')
      } else {
        setSuccess('تم إنشاء القيد بنجاح')
        setShowModal(false)
        setForm({
          description: '', description_ar: '', reference: '',
          date: new Date().toISOString().slice(0, 10),
          lines: [emptyLine(), emptyLine(), emptyLine()],
        })
        await fetchEntries()
        setTimeout(() => setSuccess(null), 3000)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(id: string, action: 'post' | 'void' | 'reverse') {
    setActionLoading(id + action)
    setError(null)
    try {
      const res = await fetch(`/api/accounting/journal/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': company_id },
        body:    JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'فشل تنفيذ الإجراء')
      } else {
        setSuccess(
          action === 'post'    ? 'تم ترحيل القيد بنجاح'  :
          action === 'reverse' ? 'تم عكس القيد بنجاح'    :
                                 'تم إلغاء القيد بنجاح'
        )
        await fetchEntries()
        setTimeout(() => setSuccess(null), 3000)
      }
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="p-6 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">القيود المحاسبية</h1>
          <p className="text-sm text-gray-500 mt-1">إدارة وعرض كافة القيود</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchEntries}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            قيد جديد
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="mr-auto"><X className="h-4 w-4" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="بحث..."
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              className="w-full pr-9 pl-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">كل الحالات</option>
            <option value="draft">مسودة</option>
            <option value="pending">معلق</option>
            <option value="approved">معتمد</option>
            <option value="posted">مرحّل</option>
            <option value="reversed">معكوس</option>
            <option value="void">ملغي</option>
          </select>
          <select
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">كل المصادر</option>
            <option value="auto">تلقائي</option>
            <option value="manual">يدوي</option>
          </select>
          <input
            type="date"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="من تاريخ"
          />
          <input
            type="date"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="إلى تاريخ"
          />
        </div>
      </div>

      {/* Entries Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {filtered.length} قيد من أصل {entries.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
                <th className="w-6 px-4 py-2"></th>
                <th className="px-4 py-2 text-right font-medium">رقم القيد</th>
                <th className="px-4 py-2 text-right font-medium">التاريخ</th>
                <th className="px-4 py-2 text-right font-medium">الوصف</th>
                <th className="px-4 py-2 text-right font-medium">المصدر</th>
                <th className="px-4 py-2 text-right font-medium">الحالة</th>
                <th className="px-4 py-2 text-left font-medium">مدين</th>
                <th className="px-4 py-2 text-left font-medium">دائن</th>
                <th className="px-4 py-2 text-right font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                    لا توجد قيود مطابقة للبحث
                  </td>
                </tr>
              ) : filtered.map(entry => (
                <>
                  <tr
                    key={entry.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <td className="px-3 py-3 text-gray-400">
                      {expandedId === entry.id
                        ? <ChevronUp className="h-4 w-4" />
                        : <ChevronDown className="h-4 w-4" />
                      }
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-700 font-medium">
                      {entry.entry_number}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{entry.date}</td>
                    <td className="px-4 py-3 text-gray-900 max-w-xs">
                      <p className="truncate">{entry.description}</p>
                      {entry.reference && (
                        <p className="text-xs text-gray-400 truncate">#{entry.reference}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <SourceBadge auto_generated={entry.auto_generated} source={entry.source} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="px-4 py-3 text-left font-medium text-blue-700">
                      {formatNumber(entry.total_debit)}
                    </td>
                    <td className="px-4 py-3 text-left font-medium text-red-600">
                      {formatNumber(entry.total_credit)}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        {['draft', 'pending', 'approved'].includes(entry.status) && (
                          <button
                            onClick={() => handleAction(entry.id, 'post')}
                            disabled={!!actionLoading}
                            className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs hover:bg-green-100 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === entry.id + 'post'
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <CheckCircle className="h-3 w-3" />
                            }
                            ترحيل
                          </button>
                        )}
                        {entry.status === 'posted' && !entry.reversal_entry_id && (
                          <button
                            onClick={() => handleAction(entry.id, 'reverse')}
                            disabled={!!actionLoading}
                            className="flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded text-xs hover:bg-orange-100 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === entry.id + 'reverse'
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <RotateCcw className="h-3 w-3" />
                            }
                            عكس
                          </button>
                        )}
                        {['draft', 'pending'].includes(entry.status) && (
                          <button
                            onClick={() => handleAction(entry.id, 'void')}
                            disabled={!!actionLoading}
                            className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded text-xs hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === entry.id + 'void'
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <X className="h-3 w-3" />
                            }
                            إلغاء
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr key={entry.id + '-lines'} className="bg-blue-50/30">
                      <td colSpan={9} className="px-6 py-3">
                        <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                          <thead>
                            <tr className="bg-gray-100 text-gray-500">
                              <th className="px-3 py-2 text-right font-medium">#</th>
                              <th className="px-3 py-2 text-right font-medium">رمز الحساب</th>
                              <th className="px-3 py-2 text-right font-medium">اسم الحساب</th>
                              <th className="px-3 py-2 text-right font-medium">الوصف</th>
                              <th className="px-3 py-2 text-left font-medium">مدين</th>
                              <th className="px-3 py-2 text-left font-medium">دائن</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {entry.journal_entry_lines
                              .sort((a, b) => a.line_number - b.line_number)
                              .map(line => (
                              <tr key={line.id}>
                                <td className="px-3 py-2 text-gray-400">{line.line_number}</td>
                                <td className="px-3 py-2 font-mono text-blue-700">
                                  {line.accounts?.code || '—'}
                                </td>
                                <td className="px-3 py-2 text-gray-900">
                                  {line.accounts?.name_ar || line.accounts?.name || '—'}
                                </td>
                                <td className="px-3 py-2 text-gray-500">{line.description || '—'}</td>
                                <td className="px-3 py-2 text-left text-blue-700 font-medium">
                                  {line.debit  > 0 ? formatNumber(line.debit)  : '—'}
                                </td>
                                <td className="px-3 py-2 text-left text-red-600 font-medium">
                                  {line.credit > 0 ? formatNumber(line.credit) : '—'}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-gray-50 font-bold">
                              <td colSpan={4} className="px-3 py-2 text-gray-700 text-right">الإجمالي</td>
                              <td className="px-3 py-2 text-left text-blue-700">
                                {formatNumber(entry.total_debit)}
                              </td>
                              <td className="px-3 py-2 text-left text-red-600">
                                {formatNumber(entry.total_credit)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900">قيد محاسبي جديد</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {/* Header Fields */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">التاريخ *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">المرجع</label>
                  <input
                    type="text"
                    value={form.reference}
                    onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
                    placeholder="رقم مرجعي"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-full md:col-span-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">الوصف (عربي) *</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="وصف القيد المحاسبي"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Balance Indicator */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                formTotals.balanced
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {formTotals.balanced
                  ? <CheckCircle className="h-4 w-4" />
                  : <AlertCircle className="h-4 w-4" />
                }
                <span className="text-sm font-medium">
                  {formTotals.balanced
                    ? 'القيد متوازن'
                    : `القيد غير متوازن — مدين: ${formatNumber(formTotals.debit)} | دائن: ${formatNumber(formTotals.credit)} | الفرق: ${formatNumber(Math.abs(formTotals.debit - formTotals.credit))}`
                  }
                </span>
                <div className="mr-auto flex gap-4 text-sm">
                  <span>مدين: <strong>{formatNumber(formTotals.debit)}</strong></span>
                  <span>دائن: <strong>{formatNumber(formTotals.credit)}</strong></span>
                </div>
              </div>

              {/* Lines Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-200">
                      <th className="px-3 py-2 text-right font-medium w-64">الحساب</th>
                      <th className="px-3 py-2 text-right font-medium">الوصف</th>
                      <th className="px-3 py-2 text-left font-medium w-32">مدين</th>
                      <th className="px-3 py-2 text-left font-medium w-32">دائن</th>
                      <th className="w-8 px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {form.lines.map((line, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <select
                            value={line.account_code}
                            onChange={e => updateLine(i, 'account_code', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">اختر حساباً...</option>
                            {Object.entries(accountsByType).map(([type, accts]) => (
                              <optgroup key={type} label={type}>
                                {accts.map(a => (
                                  <option key={a.id} value={a.code}>
                                    {a.code} - {a.name_ar}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={line.description}
                            onChange={e => updateLine(i, 'description', e.target.value)}
                            placeholder="وصف اختياري"
                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={line.debit}
                            onChange={e => updateLine(i, 'debit', e.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-left focus:outline-none focus:ring-1 focus:ring-blue-500 text-blue-700"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={line.credit}
                            onChange={e => updateLine(i, 'credit', e.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-left focus:outline-none focus:ring-1 focus:ring-red-500 text-red-600"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <button
                            onClick={() => removeLine(i)}
                            disabled={form.lines.length <= 2}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded disabled:opacity-30"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                  <button
                    onClick={addLine}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-3 w-3" />
                    إضافة سطر
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 justify-end border-t border-gray-100 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => handleSubmit('draft')}
                  disabled={loading || !formTotals.balanced}
                  className="flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-700 bg-blue-50 rounded-lg text-sm hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  حفظ كمسودة
                </button>
                <button
                  onClick={() => handleSubmit('pending')}
                  disabled={loading || !formTotals.balanced}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  إرسال للاعتماد
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
