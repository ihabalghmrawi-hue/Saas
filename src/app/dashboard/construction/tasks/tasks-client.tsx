'use client'

import { useState } from 'react'
import { Plus, Search, Trash2, Edit, Calendar, Flag } from 'lucide-react'

interface Task {
  id: string; title: string; description: string | null; status: string; priority: string;
  project_id: string | null; worker_id: string | null; due_date: string | null;
  completed_at: string | null; notes: string | null;
  con_projects?: { name: string } | null;
  con_workers?:  { name: string } | null;
}
interface Project { id: string; name: string }
interface Worker  { id: string; name: string }

// DB CHECK: ('todo','in_progress','review','done','blocked')
const STATUSES = ['todo', 'in_progress', 'review', 'done', 'blocked']
const STATUS_AR: Record<string, string> = {
  todo:        'قيد الانتظار',
  in_progress: 'جارٍ',
  review:      'مراجعة',
  done:        'مكتمل',
  blocked:     'موقوف',
}
const STATUS_COLORS: Record<string, string> = {
  todo:        'border-gray-200 bg-gray-50',
  in_progress: 'border-blue-200 bg-blue-50',
  review:      'border-purple-200 bg-purple-50',
  done:        'border-green-200 bg-green-50',
  blocked:     'border-red-200 bg-red-50',
}
const STATUS_HEADER: Record<string, string> = {
  todo:        'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  review:      'bg-purple-100 text-purple-700',
  done:        'bg-green-100 text-green-700',
  blocked:     'bg-red-100 text-red-500',
}
const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-400', medium: 'text-blue-500', high: 'text-orange-500', urgent: 'text-red-500',
}
const PRIORITY_AR: Record<string, string> = { low: 'منخفض', medium: 'متوسط', high: 'عالي', urgent: 'عاجل' }

const emptyForm = { title: '', description: '', status: 'todo', priority: 'medium', project_id: '', worker_id: '', due_date: '', notes: '' }

export function TasksClient({ tasks: init, projects, workers }: { tasks: Task[]; projects: Project[]; workers: Worker[] }) {
  const [tasks, setTasks] = useState(init)
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = tasks.filter(t => {
    const q = search.toLowerCase()
    return (!q || t.title.toLowerCase().includes(q))
      && (!filterProject || t.project_id === filterProject)
  })

  const byStatus = STATUSES.map(s => ({ status: s, tasks: filtered.filter(t => t.status === s) }))

  const openNew  = () => { setForm(emptyForm); setEditing(null); setError(''); setShowForm(true) }
  const openEdit = (t: Task) => {
    setForm({ title: t.title, description: t.description || '', status: t.status, priority: t.priority, project_id: t.project_id || '', worker_id: t.worker_id || '', due_date: t.due_date || '', notes: t.notes || '' })
    setEditing(t); setError(''); setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const payload = {
        ...form,
        project_id: form.project_id || null,
        worker_id:  form.worker_id  || null,
        due_date:   form.due_date   || null,
      }
      const url    = editing ? `/api/construction/tasks/${editing.id}` : '/api/construction/tasks'
      const method = editing ? 'PATCH' : 'POST'
      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (editing) setTasks(prev => prev.map(t => t.id === editing.id ? { ...t, ...data } : t))
      else         setTasks(prev => [data, ...prev])
      setShowForm(false)
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذه المهمة؟')) return
    setDeleting(id)
    await fetch(`/api/construction/tasks/${id}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== id))
    setDeleting(null)
  }

  const quickStatus = async (t: Task, status: string) => {
    const res  = await fetch(`/api/construction/tasks/${t.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    const data = await res.json()
    if (res.ok) setTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...data } : x))
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">المهام</h1>
        <button onClick={openNew} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-2">
          <Plus className="w-4 h-4" /> مهمة جديدة
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالعنوان..."
            className="w-full border rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background" />
        </div>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">كل المشاريع</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {byStatus.map(col => (
          <div key={col.status} className="space-y-3">
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${STATUS_HEADER[col.status]}`}>
              <span className="text-xs font-semibold">{STATUS_AR[col.status]}</span>
              <span className="text-xs bg-white/50 px-1.5 py-0.5 rounded-full font-bold">{col.tasks.length}</span>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {col.tasks.map(t => (
                <div key={t.id} className={`border rounded-xl p-3 space-y-2 ${STATUS_COLORS[t.status]}`}>
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-sm font-medium leading-tight">{t.title}</p>
                    <Flag className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${PRIORITY_COLORS[t.priority]}`} />
                  </div>
                  {t.con_projects && <p className="text-xs text-muted-foreground">{t.con_projects.name}</p>}
                  {t.con_workers  && <p className="text-xs text-muted-foreground">{t.con_workers.name}</p>}
                  {t.due_date && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" /><span>{t.due_date}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-black/5">
                    <div className="flex gap-1">
                      {col.status !== 'done' && (
                        <button onClick={() => quickStatus(t, 'done')} title="إتمام"
                          className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors">✓</button>
                      )}
                      {col.status === 'todo' && (
                        <button onClick={() => quickStatus(t, 'in_progress')} title="بدء"
                          className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors">▶</button>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(t)} className="p-1 hover:bg-white/60 rounded text-muted-foreground hover:text-foreground">
                        <Edit className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id}
                        className="p-1 hover:bg-red-50 rounded text-muted-foreground hover:text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {col.tasks.length === 0 && (
                <div className="border-2 border-dashed border-muted rounded-xl p-4 text-center text-xs text-muted-foreground">
                  لا توجد مهام
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b">
              <h2 className="font-semibold">{editing ? 'تعديل مهمة' : 'مهمة جديدة'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">عنوان المهمة *</label>
                  <input required value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">المشروع</label>
                  <select value={form.project_id} onChange={e => setForm((f: any) => ({ ...f, project_id: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">— بدون مشروع —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">العامل المكلف</label>
                  <select value={form.worker_id} onChange={e => setForm((f: any) => ({ ...f, worker_id: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="">— بدون تعيين —</option>
                    {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">الأولوية</label>
                  <select value={form.priority} onChange={e => setForm((f: any) => ({ ...f, priority: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {Object.entries(PRIORITY_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">الحالة</label>
                  <select value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {Object.entries(STATUS_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">تاريخ الاستحقاق</label>
                  <input type="date" value={form.due_date} onChange={e => setForm((f: any) => ({ ...f, due_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">الوصف</label>
                  <textarea rows={2} value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading}
                  className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                  {loading ? 'جاري الحفظ...' : editing ? 'حفظ التعديلات' : 'إنشاء المهمة'}
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
