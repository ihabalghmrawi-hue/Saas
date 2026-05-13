'use client'

import { useState, useMemo } from 'react'
import { Search, Truck, Loader2, Check, Send, Eye } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ShipmentsClientProps {
  shipments: any[]
  companyId: string
  currency: string
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-700' },
  picking: { label: 'قيد التجهيز', color: 'bg-blue-100 text-blue-700' },
  packed: { label: 'مجهزة', color: 'bg-purple-100 text-purple-700' },
  shipped: { label: 'شحنت', color: 'bg-indigo-100 text-indigo-700' },
  delivered: { label: 'تم التسليم', color: 'bg-green-100 text-green-700' },
  returned: { label: 'مرتجعة', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'ملغية', color: 'bg-gray-100 text-gray-700' },
}

export function ShipmentsClient({ shipments: initialShipments, companyId, currency }: ShipmentsClientProps) {
  const [shipments, setShipments] = useState(initialShipments)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const filtered = useMemo(() => shipments.filter(s => {
    if (!search) return true
    return (s.shipment_no || '').includes(search) || (s.carrier || '').includes(search)
  }), [shipments, search])

  const handleAction = async (id: string, action: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/sales/shipments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, carrier: 'default' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'فشل العملية')
      setShipments(prev => prev.map(s => s.id === id ? { ...s, status: action === 'ship' ? 'shipped' : 'delivered' } : s))
    } catch (e: any) { alert(e.message) } finally { setActionLoading(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">الشحنات</h1>
          <p className="text-sm text-muted-foreground">{shipments.length} شحنة</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-600">إجمالي الشحنات</p>
          <p className="text-xl font-bold text-blue-700">{shipments.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-xs text-green-600">تم التسليم</p>
          <p className="text-xl font-bold text-green-700">{shipments.filter(s => s.status === 'delivered').length}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4">
          <p className="text-xs text-yellow-600">قيد التنفيذ</p>
          <p className="text-xl font-bold text-yellow-700">{shipments.filter(s => s.status !== 'delivered' && s.status !== 'cancelled').length}</p>
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
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">رقم الشحنة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الناقل</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">رقم التتبع</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">تاريخ الشحن</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">لا توجد شحنات</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{s.shipment_no || '—'}</td>
                  <td className="px-4 py-3">{s.carrier || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.tracking_no || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_LABELS[s.status]?.color)}>
                      {STATUS_LABELS[s.status]?.label || s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{s.shipped_date ? formatDate(s.shipped_date) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {s.status === 'pending' && (
                        <button onClick={() => handleAction(s.id, 'ship')} disabled={actionLoading === s.id}
                          className="flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-200">
                          {actionLoading === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          شحن
                        </button>
                      )}
                      {s.status === 'shipped' && (
                        <button onClick={() => handleAction(s.id, 'deliver')} disabled={actionLoading === s.id}
                          className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200">
                          {actionLoading === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          تسليم
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
