'use client'

import { useState } from 'react'
import { Plus, Search, Users, Edit, Trash2, Star, Phone } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Worker {
  id: string; name: string; phone: string | null; job_type: string; daily_rate: number;
  status: string; rating: number | null; notes: string | null;
}

// DB CHECK: ('available','busy','inactive')
const STATUS_AR: Record<string, string> = { available: 'متاح', busy: 'مشغول', inactive: 'غير نشط' }
const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  busy:      'bg-yellow-100 text-yellow-700',
  inactive:  'bg-gray-100 text-gray-600',
}

// DB CHECK: ('plumber','electrician','painter','carpenter','tiler','mason','welder','general','supervisor','other')
const JOB_TYPES: Record<string, string> = {
  plumber:      'سباك',
  electrician:  'كهربائي',
  painter:      'دهان',
  carpenter:    'نجار',
  tiler:        'بلاط',
  mason:        'بناء',
  welder:       'لحام',
  general:      'عامل عام',
  supervisor:   'مشرف',
  other:        'أخرى',
}

const emptyForm = { name: '', phone: '', job_type: 'general', daily_rate: '', status: 'available', rating: '', notes: '' }

export function WorkersClient({ workers: init, currency }: { workers: Worker[]; currency: string }) {
  const [workers, setWorkers] = useState(init)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Worker | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const fmt = (n: number) => formatCurrency(n, currency)

  const filtered = workers.filter(w => {
    const q = search.toLowerCase()
    return (!q || w.name.toLowerCase().includes(q) || (JOB_TYPES[w.job_type] || w.job_type).toLowerCase().includes(q) || (w.phone || '').includes(q))
      && (!filterStatus || w.status === filterStatus)
  })

  const openNew  = () => { setForm(emptyForm); setEditing(null); setError(''); setShowForm(true) }
  const openEdit = (w: Worker) => {
    setForm({ name: w.name, phone: w.phone || '', job_type: w.job_type, daily_rate: String(w.daily_rate), status: w.status, rating: w.rating !== null ? String(w.rating) : '', notes: w.notes || '' })
    setEditing(w); setError(''); setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const payload = { ...form, daily_rate: Number(form.daily_rate) || 0, rating: form.rating !== '' ? Number(form.rating) : null }
      const url    = editing ? `/api/construction/workers/${editing.id}` : '/api/construction/workers'
      const method = editing ? 'PATCH' : 'POST'
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (editing) setWorkers(prev => prev.map(w => w.id === editing.id ? { ...w, ...data } : w))
      else         setWorkers(prev => [data, ...prev])
      setShowForm(false)
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا العامل؟')) return
    setDeleting(id)
    await fetch(`/api/construction/workers/${id}`, { method: 'DELETE' })
    setWorkers(prev => prev.filter(w => w.id !== id))
    setDeleting(null)
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">العمال</h1>
        <button onClick={openNew} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-2">
          <Plus className="w-4 h-4" /> عامل جديد
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو المهنة..."
            className="w-full border rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(w => (
          <div key={w.id} className="bg-card border rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                  {w.name[0]}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{w.name}</h3>
                  <p className="text-xs text-muted-foreground">{JOB_TYPES[w.job_type] || w.job_type}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[w.status] || 'bg-gray-100 text-gray-600'}`}>
                {STATUS_AR[w.status] || w.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/40 rounded-lg p-2">
                <p className="text-muted-foreground">الأجر اليومي</p>
                <p className="font-semibold text-sm mt-0.5">{fmt(Number(w.daily_rate))}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-2">
                <p className="text-muted-foreground">التقييم</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="font-semibold text-sm">{w.rating ?? '—'}</span>
                </div>
              </div>
            </div>

            {w.phone && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                <span dir="ltr">{w.phone}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-1 pt-1 border-t">
              <button onClick={() => openEdit(w)} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDelete(w.id)} disabled={deleting === w.id}
                className="p-1.5 hover:bg-red-50 rounded-lg text-muted-foreground hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا يوجد عمال</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b">
              <h2 className="font-semibold">{editing ? 'تعديل عامل' : 'عامل جديد'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">الاسم *</label>
                  <input required value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">الهاتف</label>
                  <input value={form.phone} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">المهنة</label>
                  <select value={form.job_type} onChange={e => setForm((f: any) => ({ ...f, job_type: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {Object.entries(JOB_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">الأجر اليومي</label>
                  <input type="number" min="0" step="0.01" value={form.daily_rate} onChange={e => setForm((f: any) => ({ ...f, daily_rate: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">الحالة</label>
                  <select value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {Object.entries(STATUS_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">التقييم (1-5)</label>
                  <input type="number" min="1" max="5" step="0.1" value={form.rating} onChange={e => setForm((f: any) => ({ ...f, rating: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">ملاحظات</label>
                  <textarea rows={2} value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading}
                  className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                  {loading ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إضافة العامل'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-5 py-2 border rounded-lg text-sm hover:bg-accent">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
