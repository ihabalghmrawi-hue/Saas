'use client'

import { useState } from 'react'
import { Plus, Edit, Check, X, Loader2, Search, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  booked:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30',
  active:    'bg-green-100 text-green-700 dark:bg-green-900/30',
  returned:  'bg-gray-100 text-gray-600 dark:bg-gray-900/30',
  late:      'bg-red-100 text-red-700 dark:bg-red-900/30',
  cancelled: 'bg-red-50 text-red-400',
}
const STATUS_LABELS: Record<string, string> = {
  booked: 'محجوز', active: 'نشط', returned: 'مُرجع', late: 'متأخر', cancelled: 'ملغي',
}

const emptyForm = {
  dress_id: '', customer_name: '', customer_phone: '',
  start_date: '', end_date: '', deposit_paid: false, amount_paid: '', notes: '',
}

interface Dress { id: string; name: string; code: string; status: string; rental_price: number; deposit: number }
interface Order { id: string; order_number: string; dress_id: string; customer_name: string; customer_phone: string; start_date: string; end_date: string; days: number; rental_price: number; total_price: number; deposit: number; deposit_paid: boolean; amount_paid: number; status: string; notes: string; dresses: Dress | null }

export function BookingsClient({ orders: init, dresses, currency }: { orders: Order[]; dresses: Dress[]; currency: string }) {
  const [orders, setOrders] = useState(init)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Order | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [availability, setAvailability] = useState<Record<string, boolean>>({})
  const [checkingAvail, setCheckingAvail] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = orders.filter(o => {
    const q = search.toLowerCase()
    return (!q || o.customer_name?.toLowerCase().includes(q) || o.order_number?.toLowerCase().includes(q) || o.customer_phone?.includes(q))
      && (!filterStatus || o.status === filterStatus)
  })

  const selectedDress = dresses.find(d => d.id === form.dress_id)
  const days = form.start_date && form.end_date
    ? Math.max(1, Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000))
    : 0
  const totalPrice = selectedDress ? selectedDress.rental_price * days : 0

  const checkAvailability = async () => {
    if (!form.start_date || !form.end_date) return
    setCheckingAvail(true)
    const params = new URLSearchParams({ start: form.start_date, end: form.end_date })
    if (editing) params.set('exclude', editing.id)
    const res = await fetch(`/api/rentals/availability?${params}`)
    const data = await res.json()
    const map: Record<string, boolean> = {}
    if (Array.isArray(data)) data.forEach((r: any) => { map[r.dress_id] = r.available })
    setAvailability(map)
    setCheckingAvail(false)
  }

  const openNew = () => { setForm(emptyForm); setEditing(null); setError(''); setAvailability({}); setShowForm(true) }
  const openEdit = (o: Order) => {
    setForm({ dress_id: o.dress_id, customer_name: o.customer_name, customer_phone: o.customer_phone || '', start_date: o.start_date, end_date: o.end_date, deposit_paid: o.deposit_paid, amount_paid: String(o.amount_paid), notes: o.notes || '' })
    setEditing(o); setError(''); setAvailability({}); setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const payload = { ...form, amount_paid: parseFloat(form.amount_paid) || 0, deposit_paid: Number(form.deposit_paid) || 0 }
      const url = editing ? `/api/rentals/orders/${editing.id}` : '/api/rentals/orders'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (editing) setOrders(prev => prev.map(o => o.id === editing.id ? { ...o, ...data } : o))
      else setOrders(prev => [data, ...prev])
      setShowForm(false)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const cancelOrder = async (id: string) => {
    if (!confirm('هل تريد إلغاء هذا الحجز؟')) return
    const res = await fetch(`/api/rentals/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) })
    if (res.ok) setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' } : o))
  }

  const inp = 'w-full border border-input bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20'

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Calendar className="w-5 h-5 text-primary" /> الحجوزات</h1>
          <p className="text-sm text-muted-foreground">{orders.length} حجز · {orders.filter(o => o.status === 'booked').length} محجوز · {orders.filter(o => o.status === 'active').length} نشط</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> حجز جديد
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو رقم الحجز أو الهاتف..." className="w-full border border-input rounded-lg px-3 py-2 pr-9 text-sm bg-background focus:outline-none" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-input rounded-lg px-3 py-2 text-sm bg-background">
          <option value="">كل الحالات</option>
          <option value="booked">محجوز</option>
          <option value="active">نشط</option>
          <option value="late">متأخر</option>
          <option value="returned">مُرجع</option>
          <option value="cancelled">ملغي</option>
        </select>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p>لا توجد حجوزات</p>
          </div>
        )}
        {filtered.map(o => {
          const dress = o.dresses
          const expanded = expandedId === o.id
          const isLate = o.status === 'active' && new Date(o.end_date) < new Date()
          return (
            <div key={o.id} className={cn('bg-card border rounded-2xl overflow-hidden transition-all', isLate && 'border-red-300')}>
              <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpandedId(expanded ? null : o.id)}>
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{o.customer_name}</p>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLES[isLate ? 'late' : o.status])}>
                        {isLate ? 'متأخر' : STATUS_LABELS[o.status]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{o.order_number} · {dress?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-left">
                    <p className="text-sm font-bold text-primary">{formatCurrency(o.total_price, currency)}</p>
                    <p className="text-xs text-muted-foreground">{o.start_date} ← {o.end_date}</p>
                  </div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {expanded && (
                <div className="border-t px-4 py-3 bg-muted/30 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-muted-foreground text-xs">الفستان: </span>{dress?.name} {dress?.code ? `(${dress.code})` : ''}</div>
                    <div><span className="text-muted-foreground text-xs">الهاتف: </span>{o.customer_phone || '—'}</div>
                    <div><span className="text-muted-foreground text-xs">الأيام: </span>{o.days} يوم</div>
                    <div><span className="text-muted-foreground text-xs">سعر اليوم: </span>{formatCurrency(o.rental_price, currency)}</div>
                    <div><span className="text-muted-foreground text-xs">التأمين: </span>{formatCurrency(o.deposit, currency)} {o.deposit_paid ? '✓ مدفوع' : '✗ غير مدفوع'}</div>
                    <div><span className="text-muted-foreground text-xs">المدفوع: </span>{formatCurrency(o.amount_paid, currency)} / {formatCurrency(o.total_price, currency)}</div>
                  </div>
                  {o.notes && <p className="text-xs text-muted-foreground">ملاحظات: {o.notes}</p>}
                  <div className="flex gap-2 pt-1">
                    {['booked', 'active'].includes(o.status) && (
                      <button onClick={() => openEdit(o)} className="flex items-center gap-1 text-xs px-3 py-1.5 border rounded-lg hover:bg-accent">
                        <Edit className="w-3 h-3" /> تعديل
                      </button>
                    )}
                    {o.status === 'booked' && (
                      <button onClick={() => cancelOrder(o.id)} className="flex items-center gap-1 text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                        <X className="w-3 h-3" /> إلغاء
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold">{editing ? 'تعديل الحجز' : 'حجز جديد'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Date range */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">تاريخ البداية *</label>
                  <input type="date" required value={form.start_date} onChange={e => { setForm((f: any) => ({ ...f, start_date: e.target.value })); setAvailability({}) }} className={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">تاريخ النهاية *</label>
                  <input type="date" required value={form.end_date} onChange={e => { setForm((f: any) => ({ ...f, end_date: e.target.value })); setAvailability({}) }} className={inp} />
                </div>
                {/* Availability check */}
                <div className="col-span-2">
                  <button type="button" onClick={checkAvailability} disabled={!form.start_date || !form.end_date || checkingAvail}
                    className="w-full border border-primary/30 text-primary text-sm py-2 rounded-lg hover:bg-primary/5 disabled:opacity-50 flex items-center justify-center gap-2">
                    {checkingAvail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {Object.keys(availability).length ? 'تحديث التوفر' : 'فحص التوفر'}
                  </button>
                </div>
                {/* Dress selection */}
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">الفستان *</label>
                  <select required value={form.dress_id} onChange={e => setForm((f: any) => ({ ...f, dress_id: e.target.value }))} className={inp}>
                    <option value="">اختر الفستان...</option>
                    {dresses.filter(d => d.status !== 'retired').map(d => {
                      const avail = availability[d.id]
                      const label = `${d.name}${d.code ? ` (${d.code})` : ''} — ${formatCurrency(d.rental_price, currency)}/يوم`
                      const suffix = Object.keys(availability).length ? (avail ? ' ✓ متاح' : ' ✗ محجوز') : ''
                      return <option key={d.id} value={d.id} disabled={Object.keys(availability).length > 0 && !avail}>{label}{suffix}</option>
                    })}
                  </select>
                  {days > 0 && selectedDress && (
                    <p className="text-xs text-primary mt-1">{days} يوم × {formatCurrency(selectedDress.rental_price, currency)} = {formatCurrency(totalPrice, currency)}</p>
                  )}
                </div>
                {/* Customer */}
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">اسم العميلة *</label>
                  <input required value={form.customer_name} onChange={e => setForm((f: any) => ({ ...f, customer_name: e.target.value }))} placeholder="اسم العميلة" className={inp} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">رقم الهاتف</label>
                  <input type="tel" value={form.customer_phone} onChange={e => setForm((f: any) => ({ ...f, customer_phone: e.target.value }))} placeholder="05xxxxxxxx" className={inp} dir="ltr" />
                </div>
                {/* Payment */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">المبلغ المدفوع</label>
                  <input type="number" step="0.01" value={form.amount_paid} onChange={e => setForm((f: any) => ({ ...f, amount_paid: e.target.value }))} placeholder="0.00" className={inp} />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id="deposit_paid" checked={!!form.deposit_paid} onChange={e => setForm((f: any) => ({ ...f, deposit_paid: e.target.checked ? (selectedDress?.deposit ?? 0) : 0 }))} className="w-4 h-4 accent-primary" />
                  <label htmlFor="deposit_paid" className="text-sm">التأمين مدفوع</label>
                  {selectedDress && <span className="text-xs text-muted-foreground">({formatCurrency(selectedDress.deposit, currency)})</span>}
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">ملاحظات</label>
                  <input value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} placeholder="أي ملاحظات..." className={inp} />
                </div>
              </div>
              {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editing ? 'حفظ التعديلات' : 'إنشاء الحجز'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 border rounded-xl text-sm hover:bg-accent">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
