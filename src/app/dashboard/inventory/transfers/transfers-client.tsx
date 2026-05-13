'use client'

import { useState, useMemo } from 'react'
import { Search, Truck, Plus, Loader2, Check, X, ArrowLeftRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface TransfersClientProps {
  transfers: any[]
  warehouses: any[]
  companyId: string
  currency: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-700' },
  pending: { label: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'معتمد', color: 'bg-blue-100 text-blue-700' },
  transferred: { label: 'منقول', color: 'bg-green-100 text-green-700' },
  received: { label: 'مستلم', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700' },
}

export function TransfersClient({ transfers: initialTransfers, warehouses, companyId, currency }: TransfersClientProps) {
  const [transfers, setTransfers] = useState(initialTransfers)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const filtered = useMemo(() => transfers.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return (t.reference || '').toLowerCase().includes(q) ||
      (t.from_warehouse?.name_ar || t.from_warehouse?.name || '').includes(search)
  }), [transfers, search])

  const handleAction = async (id: string, action: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/inventory/transfers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'فشل العملية')
      setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: action === 'approve' ? 'approved' : action === 'receive' ? 'received' : 'cancelled' } : t))
    } catch (e: any) { alert(e.message) } finally { setActionLoading(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">التحويلات</h1>
          <p className="text-sm text-muted-foreground">{transfers.length} تحويلة</p>
        </div>
      </div>

      <div className="relative flex-1">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="بحث..."
          className="w-full border border-input rounded-lg px-3 py-2 pr-9 text-sm bg-background focus:outline-none" />
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">المرجع</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">من مستودع</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">إلى مستودع</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">لا توجد تحويلات</td></tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{t.reference || '—'}</td>
                  <td className="px-4 py-3">{t.from_warehouse?.name_ar || t.from_warehouse?.name || '—'}</td>
                  <td className="px-4 py-3">{t.to_warehouse?.name_ar || t.to_warehouse?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_LABELS[t.status]?.color)}>
                      {STATUS_LABELS[t.status]?.label || t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(t.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {t.status === 'pending' && (
                        <>
                          <button onClick={() => handleAction(t.id, 'approve')} disabled={actionLoading === t.id}
                            className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-600" title="اعتماد">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleAction(t.id, 'cancel')} disabled={actionLoading === t.id}
                            className="p-1.5 hover:bg-red-100 rounded-lg text-red-600" title="إلغاء">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {t.status === 'approved' && (
                        <button onClick={() => handleAction(t.id, 'receive')} disabled={actionLoading === t.id}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                          <ArrowLeftRight className="w-3 h-3" />استلام
                        </button>
                      )}
                      {actionLoading === t.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
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
