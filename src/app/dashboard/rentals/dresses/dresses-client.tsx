'use client'

import { useState } from 'react'
import { Plus, Edit, Wrench, Check, X, Loader2, Search, Shirt } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

const CATEGORIES = [
  { value: 'wedding', label: 'زفاف' },
  { value: 'evening', label: 'سهرة' },
  { value: 'casual', label: 'كاجوال' },
  { value: 'other', label: 'أخرى' },
]

const STATUS_STYLES: Record<string, string> = {
  available:   'bg-green-100 text-green-700 dark:bg-green-900/30',
  rented:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30',
  maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
}
const STATUS_LABELS: Record<string, string> = {
  available: 'متاح', rented: 'مؤجر', maintenance: 'صيانة',
}

const emptyForm = { name: '', code: '', category: 'wedding', size: '', color: '', description: '', rental_price: '', deposit: '' }

export function DressesClient({ dresses: init, currency }: { dresses: any[]; currency: string }) {
  const [dresses, setDresses] = useState(init)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = dresses.filter(d => {
    const q = search.toLowerCase()
    return (!q || d.name?.toLowerCase().includes(q) || d.code?.toLowerCase().includes(q) || d.color?.toLowerCase().includes(q))
      && (!filterCat || d.category === filterCat)
      && (!filterStatus || d.status === filterStatus)
  })

  const openNew = () => { setForm(emptyForm); setEditing(null); setError(''); setShowForm(true) }
  const openEdit = (d: any) => {
    setForm({ name: d.name, code: d.code || '', category: d.category, size: d.size || '', color: d.color || '', description: d.description || '', rental_price: d.rental_price, deposit: d.deposit })
    setEditing(d); setError(''); setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const payload = { ...form, rental_price: parseFloat(form.rental_price) || 0, deposit: parseFloat(form.deposit) || 0 }
      const url = editing ? `/api/rentals/dresses/${editing.id}` : '/api/rentals/dresses'
      const method = editing ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (editing) setDresses(prev => prev.map(d => d.id === editing.id ? data : d))
      else setDresses(prev => [data, ...prev])
      setShowForm(false)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const toggleMaintenance = async (d: any) => {
    const newStatus = d.status === 'maintenance' ? 'available' : 'maintenance'
    const res = await fetch(`/api/rentals/dresses/${d.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
    if (res.ok) setDresses(prev => prev.map(x => x.id === d.id ? { ...x, status: newStatus } : x))
  }

  const inp = 'w-full border border-input bg-background rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20'

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Shirt className="w-5 h-5 text-primary" /> الفساتين</h1>
          <p className="text-sm text-muted-foreground">{dresses.length} فستان · {dresses.filter(d => d.status === 'available').length} متاح</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> إضافة فستان
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الكود أو اللون..." className="w-full border border-input rounded-lg px-3 py-2 pr-9 text-sm bg-background focus:outline-none" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="border border-input rounded-lg px-3 py-2 text-sm bg-background">
          <option value="">كل الفئات</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-input rounded-lg px-3 py-2 text-sm bg-background">
          <option value="">كل الحالات</option>
          <option value="available">متاح</option>
          <option value="rented">مؤجر</option>
          <option value="maintenance">صيانة</option>
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <Shirt className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p>لا توجد فساتين</p>
          </div>
        )}
        {filtered.map(d => (
          <div key={d.id} className="bg-card border rounded-2xl p-4 hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-sm">{d.name}</p>
                {d.code && <p className="text-xs text-muted-foreground font-mono">{d.code}</p>}
              </div>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLES[d.status] || 'bg-gray-100 text-gray-600')}>
                {STATUS_LABELS[d.status] || d.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {d.category && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{CATEGORIES.find(c => c.value === d.category)?.label || d.category}</span>}
              {d.size && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">مقاس {d.size}</span>}
              {d.color && (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full border" style={{ backgroundColor: d.color }} />
                  {d.color}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-primary">{formatCurrency(d.rental_price, currency)} <span className="text-xs font-normal text-muted-foreground">/ يوم</span></p>
                <p className="text-xs text-muted-foreground">تأمين: {formatCurrency(d.deposit, currency)}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(d)} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground">
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => toggleMaintenance(d)} title={d.status === 'maintenance' ? 'إتاحة' : 'إرسال للصيانة'}
                  className={cn('p-1.5 rounded-lg transition-colors', d.status === 'maintenance' ? 'bg-amber-100 text-amber-700' : 'hover:bg-amber-100 text-muted-foreground hover:text-amber-700')}>
                  <Wrench className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold">{editing ? 'تعديل الفستان' : 'إضافة فستان جديد'}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">اسم الفستان *</label>
                  <input required value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="فستان سهرة فضي" className={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">كود الفستان</label>
                  <input value={form.code} onChange={e => setForm((f: any) => ({ ...f, code: e.target.value }))} placeholder="DR-001" className={inp} dir="ltr" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">الفئة</label>
                  <select value={form.category} onChange={e => setForm((f: any) => ({ ...f, category: e.target.value }))} className={inp}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">المقاس</label>
                  <input value={form.size} onChange={e => setForm((f: any) => ({ ...f, size: e.target.value }))} placeholder="S / M / L / 38 / 40" className={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">اللون</label>
                  <input value={form.color} onChange={e => setForm((f: any) => ({ ...f, color: e.target.value }))} placeholder="أبيض، ذهبي، أحمر..." className={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">سعر الإيجار / يوم *</label>
                  <input type="number" step="0.01" required value={form.rental_price} onChange={e => setForm((f: any) => ({ ...f, rental_price: e.target.value }))} placeholder="0.00" className={inp} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">التأمين (وديعة)</label>
                  <input type="number" step="0.01" value={form.deposit} onChange={e => setForm((f: any) => ({ ...f, deposit: e.target.value }))} placeholder="0.00" className={inp} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">وصف (اختياري)</label>
                  <input value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="وصف الفستان..." className={inp} />
                </div>
              </div>
              {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editing ? 'حفظ التعديلات' : 'إضافة الفستان'}
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
