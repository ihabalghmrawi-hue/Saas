'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Building2, Edit, Trash2, AlertTriangle, ChevronRight } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

interface Project {
  id: string; name: string; description: string | null; status: string; client_name: string | null;
  client_phone: string | null; location: string | null; expected_cost: number; actual_cost: number;
  start_date: string; end_date: string | null; notes: string | null; created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  planning:  'bg-blue-100 text-blue-700',
  active:    'bg-green-100 text-green-700',
  on_hold:   'bg-yellow-100 text-yellow-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-500',
}
const STATUS_AR: Record<string, string> = {
  planning: 'تخطيط', active: 'نشط', on_hold: 'موقوف', completed: 'مكتمل', cancelled: 'ملغي',
}

const emptyForm = {
  name: '', description: '', status: 'planning', client_name: '', client_phone: '',
  location: '', expected_cost: '', start_date: '', end_date: '', notes: '',
}

export function ProjectsClient({ projects: init, currency }: { projects: Project[]; currency: string }) {
  const [projects, setProjects] = useState(init)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const fmt = (n: number) => formatCurrency(n, currency)

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    return (!q || p.name.toLowerCase().includes(q) || (p.client_name || '').toLowerCase().includes(q) || (p.location || '').toLowerCase().includes(q))
      && (!filterStatus || p.status === filterStatus)
  })

  const openNew  = () => { setForm(emptyForm); setEditing(null); setError(''); setShowForm(true) }
  const openEdit = (p: Project) => {
    setForm({
      name: p.name, description: p.description || '', status: p.status,
      client_name: p.client_name || '', client_phone: p.client_phone || '',
      location: p.location || '', expected_cost: String(p.expected_cost),
      start_date: p.start_date, end_date: p.end_date || '', notes: p.notes || '',
    })
    setEditing(p); setError(''); setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const payload = { ...form, expected_cost: Number(form.expected_cost) || 0 }
      const url    = editing ? `/api/construction/projects/${editing.id}` : '/api/construction/projects'
      const method = editing ? 'PATCH' : 'POST'
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (editing) setProjects(prev => prev.map(p => p.id === editing.id ? { ...p, ...data } : p))
      else         setProjects(prev => [data, ...prev])
      setShowForm(false)
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا المشروع؟')) return
    setDeleting(id)
    await fetch(`/api/construction/projects/${id}`, { method: 'DELETE' })
    setProjects(prev => prev.filter(p => p.id !== id))
    setDeleting(null)
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">المشاريع</h1>
        <button onClick={openNew} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-2">
          <Plus className="w-4 h-4" /> مشروع جديد
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
            className="w-full border rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(p => {
          const overrun = Number(p.actual_cost) > Number(p.expected_cost)
          const pct     = Number(p.expected_cost) > 0 ? Math.min(100, Math.round(Number(p.actual_cost) / Number(p.expected_cost) * 100)) : 0
          return (
            <div key={p.id} className="bg-card border rounded-xl p-4 space-y-3 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                  {p.client_name && <p className="text-xs text-muted-foreground truncate">{p.client_name}</p>}
                  {p.location    && <p className="text-xs text-muted-foreground truncate">{p.location}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {overrun && <AlertTriangle className="w-4 h-4 text-red-500" />}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_AR[p.status] || p.status}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>الميزانية المستهلكة</span>
                  <span className={overrun ? 'text-red-500 font-medium' : ''}>{pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${overrun ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">الفعلي: <span className="font-medium text-foreground">{fmt(Number(p.actual_cost))}</span></span>
                  <span className="text-muted-foreground">المتوقع: <span className="font-medium text-foreground">{fmt(Number(p.expected_cost))}</span></span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">{p.start_date}{p.end_date ? ` — ${p.end_date}` : ''}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <Link href={`/dashboard/construction/projects/${p.id}`}
                    className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد مشاريع</p>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b">
              <h2 className="font-semibold">{editing ? 'تعديل مشروع' : 'مشروع جديد'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">اسم المشروع *</label>
                  <input required value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">اسم العميل</label>
                  <input value={form.client_name} onChange={e => setForm((f: any) => ({ ...f, client_name: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">هاتف العميل</label>
                  <input value={form.client_phone} onChange={e => setForm((f: any) => ({ ...f, client_phone: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">الموقع</label>
                  <input value={form.location} onChange={e => setForm((f: any) => ({ ...f, location: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">الميزانية المتوقعة</label>
                  <input type="number" min="0" step="0.01" value={form.expected_cost} onChange={e => setForm((f: any) => ({ ...f, expected_cost: e.target.value }))}
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
                  <label className="text-xs text-muted-foreground mb-1 block">تاريخ البداية *</label>
                  <input required type="date" value={form.start_date} onChange={e => setForm((f: any) => ({ ...f, start_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">تاريخ النهاية</label>
                  <input type="date" value={form.end_date} onChange={e => setForm((f: any) => ({ ...f, end_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">وصف</label>
                  <textarea rows={2} value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
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
                  {loading ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إنشاء المشروع'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-5 py-2 border rounded-lg text-sm hover:bg-accent">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
