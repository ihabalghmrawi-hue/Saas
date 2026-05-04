'use client'

import { useState } from 'react'
import { Check, X, Loader2, Search, RotateCcw, AlertTriangle } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

const CONDITION_OPTIONS = [
  { value: 'good', label: 'ممتاز — لا يوجد ضرر' },
  { value: 'minor_damage', label: 'ضرر بسيط' },
  { value: 'major_damage', label: 'ضرر كبير' },
  { value: 'lost', label: 'مفقود' },
]

interface Order {
  id: string; order_number: string; customer_name: string; customer_phone: string
  start_date: string; end_date: string; days: number; total_price: number
  deposit: number; deposit_paid: boolean; amount_paid: number; status: string
  dresses: { id: string; name: string; code: string } | null
}

export function ReturnsClient({ orders: init, currency }: { orders: Order[]; currency: string }) {
  const [orders, setOrders] = useState(init)
  const [search, setSearch] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [form, setForm] = useState({ condition: 'good', extra_fees: '', deposit_refund: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = orders.filter(o => {
    const q = search.toLowerCase()
    return !q || o.customer_name?.toLowerCase().includes(q) || o.order_number?.toLowerCase().includes(q) || o.customer_phone?.includes(q)
  })

  const openReturn = (o: Order) => {
    setSelectedOrder(o)
    setForm({ condition: 'good', extra_fees: '', deposit_refund: o.deposit_paid ? String(o.deposit) : '0', notes: '' })
    setError('')
  }

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrder) return
    setLoading(true); setError('')
    try {
      const payload = { condition: form.condition, extra_fees: parseFloat(form.extra_fees) || 0, deposit_refund: parseFloat(form.deposit_refund) || 0, notes: form.notes }
      const res = await fetch(`/api/rentals/orders/${selectedOrder.id}/return`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOrders(prev => prev.filter(o => o.id !== selectedOrder.id))
      setSelectedOrder(null)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const inp = 'w-full border border-input bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20'

  const isLate = (o: Order) => new Date(o.end_date) < new Date()

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><RotateCcw className="w-5 h-5 text-primary" /> إرجاع الفساتين</h1>
          <p className="text-sm text-muted-foreground">{orders.length} حجز بانتظار الإرجاع · {orders.filter(isLate).length} متأخر</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو رقم الحجز..." className="w-full border border-input rounded-lg px-3 py-2 pr-9 text-sm bg-background focus:outline-none" />
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <RotateCcw className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p>لا توجد فساتين بانتظار الإرجاع</p>
          </div>
        )}
        {filtered.map(o => {
          const dress = o.dresses
          const late = isLate(o)
          const remaining = o.total_price - o.amount_paid
          return (
            <div key={o.id} className={cn('bg-card border rounded-2xl p-4 flex items-center justify-between gap-4', late && 'border-red-300 bg-red-50/30 dark:bg-red-900/10')}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-sm">{o.customer_name}</p>
                  {late && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> متأخر
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono">{o.order_number} · {dress?.name}</p>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  <span>من {o.start_date} إلى {o.end_date}</span>
                  <span>·</span>
                  <span>{o.days} يوم</span>
                </div>
              </div>
              <div className="text-left shrink-0">
                <p className="text-sm font-bold text-primary">{formatCurrency(o.total_price, currency)}</p>
                {remaining > 0 && <p className="text-xs text-amber-600">متبقي: {formatCurrency(remaining, currency)}</p>}
                {remaining <= 0 && <p className="text-xs text-green-600">مدفوع بالكامل</p>}
              </div>
              <button onClick={() => openReturn(o)} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 shrink-0">
                إرجاع
              </button>
            </div>
          )
        })}
      </div>

      {/* Return Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setSelectedOrder(null)}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold">تسجيل الإرجاع</h2>
              <button onClick={() => setSelectedOrder(null)}><X className="w-4 h-4" /></button>
            </div>

            {/* Order summary */}
            <div className="px-5 pt-4 pb-3 bg-muted/30 border-b">
              <p className="font-semibold text-sm">{selectedOrder.customer_name}</p>
              <p className="text-xs text-muted-foreground">{selectedOrder.dresses?.name} · {selectedOrder.order_number}</p>
              <div className="flex gap-4 mt-2 text-xs">
                <span className="text-muted-foreground">الإجمالي: <strong className="text-foreground">{formatCurrency(selectedOrder.total_price, currency)}</strong></span>
                <span className="text-muted-foreground">مدفوع: <strong className="text-foreground">{formatCurrency(selectedOrder.amount_paid, currency)}</strong></span>
                {selectedOrder.deposit_paid && <span className="text-muted-foreground">تأمين: <strong className="text-foreground">{formatCurrency(selectedOrder.deposit, currency)}</strong></span>}
              </div>
            </div>

            <form onSubmit={handleReturn} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">حالة الفستان عند الإرجاع *</label>
                <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} className={inp}>
                  {CONDITION_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">رسوم إضافية</label>
                  <input type="number" step="0.01" value={form.extra_fees} onChange={e => setForm(f => ({ ...f, extra_fees: e.target.value }))} placeholder="0.00" className={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">مبلغ إعادة التأمين</label>
                  <input type="number" step="0.01" value={form.deposit_refund} onChange={e => setForm(f => ({ ...f, deposit_refund: e.target.value }))} placeholder="0.00" className={inp} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ملاحظات</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات الإرجاع..." className={inp} />
              </div>

              {/* Summary */}
              {(parseFloat(form.extra_fees) > 0 || parseFloat(form.deposit_refund) > 0) && (
                <div className="bg-muted/50 rounded-xl p-3 text-sm space-y-1">
                  {parseFloat(form.extra_fees) > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">رسوم إضافية</span><span className="text-red-600 font-medium">+{formatCurrency(parseFloat(form.extra_fees), currency)}</span></div>
                  )}
                  {parseFloat(form.deposit_refund) > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">إعادة التأمين</span><span className="text-green-600 font-medium">-{formatCurrency(parseFloat(form.deposit_refund), currency)}</span></div>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  تأكيد الإرجاع
                </button>
                <button type="button" onClick={() => setSelectedOrder(null)} className="px-4 py-2.5 border rounded-xl text-sm hover:bg-accent">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
