'use client'

import { useState, useMemo } from 'react'
import { Search, Undo2, Loader2, Check } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ReturnsClientProps {
  returns: any[]
  companyId: string
  currency: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-700' },
  approved: { label: 'معتمد', color: 'bg-blue-100 text-blue-700' },
  received: { label: 'مستلم', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'مكتمل', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700' },
}

export function ReturnsClient({ returns: initialReturns, companyId, currency }: ReturnsClientProps) {
  const [returns, setReturns] = useState(initialReturns)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const filtered = useMemo(() => returns.filter(r => {
    if (!search) return true
    return (r.customer_name || '').includes(search) || (r.return_no || '').includes(search)
  }), [returns, search])

  const handleComplete = async (id: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/sales/returns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'فشل الإكمال')
      setReturns(prev => prev.map(r => r.id === id ? { ...r, status: 'completed', credit_note_id: data.data?.credit_note_id } : r))
    } catch (e: any) { alert(e.message) } finally { setActionLoading(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">المرتجعات</h1>
          <p className="text-sm text-muted-foreground">{returns.length} مرتجع</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-600">إجمالي المرتجعات</p>
          <p className="text-xl font-bold text-blue-700">{returns.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-xs text-green-600">مكتملة</p>
          <p className="text-xl font-bold text-green-700">{returns.filter(r => r.status === 'completed').length}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4">
          <p className="text-xs text-yellow-600">قيد الانتظار</p>
          <p className="text-xl font-bold text-yellow-700">{returns.filter(r => r.status !== 'completed' && r.status !== 'cancelled').length}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث..."
            className="w-full border border-input rounded-lg px-3 py-2 pr-9 text-sm bg-background focus:outline-none" />
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">رقم المرتجع</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">العميل</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">النوع</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الإجمالي</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">لا توجد مرتجعات</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{r.return_no || '—'}</td>
                  <td className="px-4 py-3">{r.customer_name || '—'}</td>
                  <td className="px-4 py-3">{r.return_type === 'full' ? 'كلي' : r.return_type === 'partial' ? 'جزئي' : r.return_type}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(r.total || 0, currency)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_LABELS[r.status]?.color)}>
                      {STATUS_LABELS[r.status]?.label || r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3">
                    {r.status === 'received' && (
                      <button onClick={() => handleComplete(r.id)} disabled={actionLoading === r.id}
                        className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200">
                        {actionLoading === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        إكمال
                      </button>
                    )}
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
