'use client'

import { useState, useMemo } from 'react'
import { Search, FileText, Loader2, Check, X, Eye } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface InvoicesClientProps {
  invoices: any[]
  companyId: string
  currency: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-700' },
  posted: { label: 'مرحلة', color: 'bg-blue-100 text-blue-700' },
  partially_paid: { label: 'مدفوعة جزئياً', color: 'bg-yellow-100 text-yellow-700' },
  paid: { label: 'مدفوعة', color: 'bg-green-100 text-green-700' },
  overdue: { label: 'متأخرة', color: 'bg-red-100 text-red-700' },
  reversed: { label: 'ملغاة', color: 'bg-gray-100 text-gray-500' },
  cancelled: { label: 'ملغية', color: 'bg-red-100 text-red-700' },
}

export function InvoicesClient({ invoices: initialInvoices, companyId, currency }: InvoicesClientProps) {
  const [invoices, setInvoices] = useState(initialInvoices)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const filtered = useMemo(() => invoices.filter(inv => {
    const matchSearch = !search || (inv.customer_name || '').includes(search) || (inv.invoice_no || '').includes(search)
    const matchStatus = !filterStatus || inv.status === filterStatus
    return matchSearch && matchStatus
  }), [invoices, search, filterStatus])

  const handleAction = async (id: string, action: string) => {
    setActionLoading(id)
    const reason = action === 'reverse' ? prompt('سبب الإلغاء:') : null
    if (action === 'reverse' && !reason) { setActionLoading(null); return }
    try {
      const res = await fetch(`/api/sales/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason, posted_by: 'admin' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'فشل العملية')
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: action === 'post' ? 'posted' : 'reversed' } : inv))
    } catch (e: any) { alert(e.message) } finally { setActionLoading(null) }
  }

  const totalOutstanding = invoices.filter(i => i.status !== 'cancelled' && i.status !== 'reversed').reduce((s, i) => s + Number(i.total || 0) - Number(i.paid_amount || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">الفواتير</h1>
          <p className="text-sm text-muted-foreground">{invoices.length} فاتورة</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-600">إجمالي الفواتير</p>
          <p className="text-xl font-bold text-blue-700">{invoices.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-xs text-green-600">المدفوعة</p>
          <p className="text-xl font-bold text-green-700">{invoices.filter(i => i.status === 'paid').length}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4">
          <p className="text-xs text-red-600">المستحق</p>
          <p className="text-xl font-bold text-red-700">{formatCurrency(totalOutstanding, currency)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث..."
            className="w-full border border-input rounded-lg px-3 py-2 pr-9 text-sm bg-background focus:outline-none" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-input rounded-lg px-3 py-2 text-sm bg-background">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">رقم الفاتورة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">العميل</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الإجمالي</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">المدفوع</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">لا توجد فواتير</td></tr>
              ) : filtered.map(inv => (
                <tr key={inv.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{inv.invoice_no || '—'}</td>
                  <td className="px-4 py-3">{inv.customer_name || '—'}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(inv.total || 0, currency)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatCurrency(inv.paid_amount || 0, currency)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_LABELS[inv.status]?.color)}>
                      {STATUS_LABELS[inv.status]?.label || inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(inv.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {inv.status === 'draft' && (
                        <button onClick={() => handleAction(inv.id, 'post')} disabled={actionLoading === inv.id}
                          className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-200">
                          {actionLoading === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          ترحيل
                        </button>
                      )}
                      {inv.status === 'posted' && (
                        <button onClick={() => handleAction(inv.id, 'reverse')} disabled={actionLoading === inv.id}
                          className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg hover:bg-red-200">
                          <X className="w-3 h-3" />إلغاء
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
