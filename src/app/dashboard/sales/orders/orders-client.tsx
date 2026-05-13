'use client'

import { useState, useMemo } from 'react'
import { Search, ShoppingCart, Loader2, Check, X } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface OrdersClientProps {
  orders: any[]
  companyId: string
  currency: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-700' },
  approved: { label: 'معتمد', color: 'bg-blue-100 text-blue-700' },
  partially_fulfilled: { label: 'منفذ جزئياً', color: 'bg-yellow-100 text-yellow-700' },
  fulfilled: { label: 'منفذ', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-700' },
}

export function OrdersClient({ orders: initialOrders, companyId, currency }: OrdersClientProps) {
  const [orders, setOrders] = useState(initialOrders)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const filtered = useMemo(() => orders.filter(o => {
    const matchSearch = !search || (o.customer_name || '').includes(search) || (o.order_no || '').includes(search)
    const matchStatus = !filterStatus || o.status === filterStatus
    return matchSearch && matchStatus
  }), [orders, search, filterStatus])

  const handleApprove = async (id: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/sales/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'فشل الاعتماد')
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'approved' } : o))
    } catch (e: any) { alert(e.message) } finally { setActionLoading(null) }
  }

  const totalOutstanding = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total || 0) - Number(o.paid_amount || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">طلبات البيع</h1>
          <p className="text-sm text-muted-foreground">{orders.length} طلب</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-600">إجمالي الطلبات</p>
          <p className="text-xl font-bold text-blue-700">{orders.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-xs text-green-600">المعتمدة</p>
          <p className="text-xl font-bold text-green-700">{orders.filter(o => o.status === 'approved').length}</p>
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
            placeholder="بحث برقم الطلب أو اسم العميل..."
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
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">رقم الطلب</th>
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
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">لا توجد طلبات</td></tr>
              ) : filtered.map(o => (
                <tr key={o.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{o.order_no || '—'}</td>
                  <td className="px-4 py-3">{o.customer_name || '—'}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(o.total || 0, currency)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatCurrency(o.paid_amount || 0, currency)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_LABELS[o.status]?.color)}>
                      {STATUS_LABELS[o.status]?.label || o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(o.created_at)}</td>
                  <td className="px-4 py-3">
                    {o.status === 'draft' && (
                      <button onClick={() => handleApprove(o.id)} disabled={actionLoading === o.id}
                        className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-200">
                        {actionLoading === o.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        اعتماد
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
