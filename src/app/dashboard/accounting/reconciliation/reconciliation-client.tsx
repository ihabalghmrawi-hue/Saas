'use client'

import { useState, useMemo } from 'react'
import {
  Search, Filter, CheckCircle, AlertCircle, X,
  RefreshCw, Loader2, ChevronDown, ChevronUp,
  DollarSign, ArrowUpDown,
} from 'lucide-react'

interface Reconciliation {
  id: string
  company_id: string
  account_id: string
  reference_type: string
  reference_id?: string
  reference_number?: string
  statement_date: string
  statement_amount: number
  cleared_amount: number
  difference: number
  status: string
  notes?: string
  reconciled_at?: string
  reconciliation_lines?: any[]
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    unmatched: { label: 'غير مطابق', cls: 'bg-red-100 text-red-700' },
    partial:   { label: 'مطابق جزئياً', cls: 'bg-yellow-100 text-yellow-700' },
    matched:   { label: 'مطابق', cls: 'bg-green-100 text-green-700' },
    overpaid:  { label: 'مدفوع زيادة', cls: 'bg-blue-100 text-blue-700' },
  }
  const s = config[status] || { label: status, cls: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}

function formatNumber(n: number) {
  return n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function ReconciliationClient({
  initialReconciliations,
  accounts,
  company_id,
  currency,
}: {
  initialReconciliations: Reconciliation[]
  accounts: any[]
  company_id: string
  currency: string
}) {
  const [reconciliations, setReconciliations] = useState(initialReconciliations)
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [form, setForm] = useState({
    account_id: '',
    reference_type: 'invoice',
    reference_number: '',
    statement_amount: '',
    statement_date: new Date().toISOString().slice(0, 10),
    notes: '',
  })

  const accountMap = useMemo(() => {
    const m: Record<string, any> = {}
    for (const a of accounts) m[a.id] = a
    return m
  }, [accounts])

  const filtered = useMemo(() => {
    return reconciliations.filter(r => !filterStatus || r.status === filterStatus)
  }, [reconciliations, filterStatus])

  async function fetchReconciliations() {
    setLoading(true)
    try {
      const res = await fetch('/api/accounting/reconciliation', {
        headers: { 'x-tenant-id': company_id },
      })
      if (res.ok) {
        const data = await res.json()
        setReconciliations(data.data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    setError(null)
    if (!form.account_id || !form.statement_amount) {
      setError('الحساب والمبلغ مطلوبان')
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch('/api/accounting/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': company_id },
        body: JSON.stringify({
          action: 'create',
          account_id: form.account_id,
          reference_type: form.reference_type,
          reference_number: form.reference_number || undefined,
          statement_amount: parseFloat(form.statement_amount),
          statement_date: form.statement_date,
          notes: form.notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'فشل إنشاء التسوية')
      } else {
        setSuccess('تم إنشاء التسوية بنجاح')
        setShowModal(false)
        setForm({
          account_id: '', reference_type: 'invoice', reference_number: '',
          statement_amount: '', statement_date: new Date().toISOString().slice(0, 10), notes: '',
        })
        await fetchReconciliations()
        setTimeout(() => setSuccess(null), 3000)
      }
    } finally {
      setActionLoading(false)
    }
  }

  async function handleAutoMatch(invoiceId: string) {
    setError(null)
    setActionLoading(true)
    try {
      const res = await fetch('/api/accounting/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': company_id },
        body: JSON.stringify({ action: 'auto-match', invoice_id: invoiceId, payment_ids: [] }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'فشلت المطابقة التلقائية')
      } else {
        setSuccess(`تمت المطابقة: ${data.data?.totalMatched || 0}`)
        await fetchReconciliations()
        setTimeout(() => setSuccess(null), 3000)
      }
    } finally {
      setActionLoading(false)
    }
  }

  const totalUnmatched = reconciliations.filter(r => r.status !== 'matched').length

  return (
    <div className="p-6 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">التسويات المحاسبية</h1>
          <p className="text-sm text-gray-500 mt-1">مطابقة الفواتير مع المدفوعات</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchReconciliations} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
            <DollarSign className="h-4 w-4" />
            تسوية جديدة
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4" /><span>{error}</span>
          <button onClick={() => setError(null)} className="mr-auto"><X className="h-4 w-4" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          <CheckCircle className="h-4 w-4" /><span>{success}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500">الإجمالي</p>
          <p className="text-xl font-bold text-gray-900">{reconciliations.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4 shadow-sm bg-green-50">
          <p className="text-xs text-green-700">مطابق</p>
          <p className="text-xl font-bold text-green-700">{reconciliations.filter(r => r.status === 'matched').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-yellow-200 p-4 shadow-sm bg-yellow-50">
          <p className="text-xs text-yellow-700">غير مطابق</p>
          <p className="text-xl font-bold text-yellow-700">{totalUnmatched}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4 shadow-sm bg-red-50">
          <p className="text-xs text-red-700">القيمة غير المطابقة</p>
          <p className="text-xl font-bold text-red-700">
            {formatNumber(reconciliations.reduce((s, r) => s + (r.status !== 'matched' ? r.difference : 0), 0))}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="بحث..." className="w-full pr-9 pl-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">كل الحالات</option>
            <option value="unmatched">غير مطابق</option>
            <option value="partial">مطابق جزئياً</option>
            <option value="matched">مطابق</option>
            <option value="overpaid">مدفوع زيادة</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
                <th className="w-6 px-4 py-2"></th>
                <th className="px-4 py-2 text-right font-medium">المرجع</th>
                <th className="px-4 py-2 text-right font-medium">النوع</th>
                <th className="px-4 py-2 text-right font-medium">التاريخ</th>
                <th className="px-4 py-2 text-left font-medium">مبلغ الكشف</th>
                <th className="px-4 py-2 text-left font-medium">المطابق</th>
                <th className="px-4 py-2 text-left font-medium">الفرق</th>
                <th className="px-4 py-2 text-right font-medium">الحالة</th>
                <th className="px-4 py-2 text-right font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">لا توجد تسويات</td></tr>
              ) : filtered.map(rec => (
                <>
                  <tr key={rec.id} className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}>
                    <td className="px-3 py-3 text-gray-400">
                      {expandedId === rec.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{rec.reference_number || rec.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-gray-600">{rec.reference_type === 'invoice_payment' ? 'فاتورة/دفع' : rec.reference_type}</td>
                    <td className="px-4 py-3 text-gray-600">{rec.statement_date}</td>
                    <td className="px-4 py-3 text-left font-medium">{formatNumber(rec.statement_amount)}</td>
                    <td className="px-4 py-3 text-left">{formatNumber(rec.cleared_amount)}</td>
                    <td className={`px-4 py-3 text-left font-medium ${rec.difference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatNumber(rec.difference)}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={rec.status} /></td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      {rec.status !== 'matched' && (
                        <button onClick={() => handleAutoMatch(rec.id)}
                          disabled={actionLoading}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs hover:bg-blue-100 disabled:opacity-50">
                          <ArrowUpDown className="h-3 w-3" /> مطابقة
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === rec.id && (
                    <tr key={rec.id + '-lines'} className="bg-blue-50/30">
                      <td colSpan={9} className="px-6 py-3">
                        <p className="text-xs text-gray-500 mb-2">{rec.notes || 'لا توجد ملاحظات'}</p>
                        {rec.reconciliation_lines && rec.reconciliation_lines.length > 0 && (
                          <table className="w-full text-xs border border-gray-200 rounded overflow-hidden">
                            <thead>
                              <tr className="bg-gray-100 text-gray-500">
                                <th className="px-3 py-2 text-right">المرجع</th>
                                <th className="px-3 py-2 text-left">المبلغ</th>
                                <th className="px-3 py-2 text-left">المطابق</th>
                                <th className="px-3 py-2 text-left">الحالة</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                              {rec.reconciliation_lines.map((line: any) => (
                                <tr key={line.id}>
                                  <td className="px-3 py-2">{line.invoice_id || line.payment_id || line.journal_entry_id?.slice(0, 8)}</td>
                                  <td className="px-3 py-2 text-left">{formatNumber(line.amount)}</td>
                                  <td className="px-3 py-2 text-left">{formatNumber(line.matched_amount)}</td>
                                  <td className="px-3 py-2">
                                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                                      line.status === 'matched' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {line.status === 'matched' ? 'مطابق' : 'جزئي'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">تسوية جديدة</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">الحساب *</label>
                  <select value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">اختر حساباً</option>
                    {accounts.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name_ar}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">النوع</label>
                  <select value={form.reference_type} onChange={e => setForm(p => ({ ...p, reference_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="invoice">فاتورة</option>
                    <option value="payment">دفعة</option>
                    <option value="invoice_payment">فاتورة ودفعة</option>
                    <option value="bank_statement">كشف بنكي</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">المرجع</label>
                  <input type="text" value={form.reference_number}
                    onChange={e => setForm(p => ({ ...p, reference_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">التاريخ *</label>
                  <input type="date" value={form.statement_date}
                    onChange={e => setForm(p => ({ ...p, statement_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">مبلغ الكشف *</label>
                  <input type="number" value={form.statement_amount}
                    onChange={e => setForm(p => ({ ...p, statement_amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ملاحظات</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} />
              </div>
              <div className="flex items-center gap-3 justify-end pt-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">إلغاء</button>
                <button onClick={handleCreate} disabled={actionLoading}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  إنشاء التسوية
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
