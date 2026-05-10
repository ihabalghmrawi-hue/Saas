'use client'

import { useState } from 'react'
import { Plus, Search, DollarSign, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Expense {
  id: string; project_id: string | null; category: string; amount: number; description: string;
  vendor: string | null; expense_date: string; receipt_url: string | null; notes: string | null;
  con_projects?: { name: string } | null;
}
interface Project { id: string; name: string }

const CATEGORIES = ['عمالة', 'مواد بناء', 'معدات', 'نقل', 'كهرباء وماء', 'إدارية', 'أخرى']

const emptyForm = { project_id: '', category: 'عمالة', amount: '', description: '', vendor: '', expense_date: new Date().toISOString().slice(0, 10), notes: '' }

export function ExpensesClient({ expenses: init, projects, currency }: { expenses: Expense[]; projects: Project[]; currency: string }) {
  const [expenses, setExpenses] = useState(init)
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const fmt = (n: number) => formatCurrency(n, currency)

  const filtered = expenses.filter(e => {
    const q = search.toLowerCase()
    return (!q || e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || (e.vendor || '').toLowerCase().includes(q))
      && (!filterProject  || e.project_id === filterProject)
      && (!filterCategory || e.category   === filterCategory)
  })

  const total = filtered.reduce((s, e) => s + Number(e.amount), 0)

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setLoading(true); setError('')
    try {
      const payload = { ...form, amount: Number(form.amount) || 0, project_id: form.project_id || null, vendor: form.vendor || null, notes: form.notes || null }
      const res  = await fetch('/api/construction/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setExpenses(prev => [data, ...prev])
      setShowForm(false)
      setForm(emptyForm)
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا المصروف؟')) return
    setDeleting(id)
    await fetch(`/api/construction/expenses/${id}`, { method: 'DELETE' })
    setExpenses(prev => prev.filter(e => e.id !== id))
    setDeleting(null)
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">المصروفات</h1>
          <p className="text-sm text-muted-foreground mt-0.5">الإجمالي: <span className="font-semibold text-foreground">{fmt(total)}</span></p>
        </div>
        <button onClick={() => { setForm(emptyForm); setError(''); setShowForm(true) }}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-2">
          <Plus className="w-4 h-4" /> مصروف جديد
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
            className="w-full border rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background" />
        </div>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">كل المشاريع</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">كل الفئات</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الوصف</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الفئة</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المشروع</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المورد</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">المبلغ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} className="border-t hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-muted-foreground">{e.expense_date}</td>
                <td className="px-4 py-3">{e.description}</td>
                <td className="px-4 py-3">
                  <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">{e.category}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{e.con_projects?.name || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{e.vendor || '—'}</td>
                <td className="px-4 py-3 font-medium text-left">{fmt(Number(e.amount))}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id}
                    className="p-1.5 hover:bg-red-50 rounded text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">لا توجد مصروفات</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b"><h2 className="font-semibold">مصروف جديد</h2></div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">الوصف *</label>
                  <input required value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">الفئة</label>
                  <select value={form.category} onChange={e => setForm((f: any) => ({ ...f, category: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">المبلغ *</label>
                  <input required type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm((f: any) => ({ ...f, amount: e.target.value }))}
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
                  <label className="text-xs text-muted-foreground mb-1 block">المورد / الجهة</label>
                  <input value={form.vendor} onChange={e => setForm((f: any) => ({ ...f, vendor: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">التاريخ</label>
                  <input type="date" value={form.expense_date} onChange={e => setForm((f: any) => ({ ...f, expense_date: e.target.value }))}
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
                  {loading ? 'جاري الحفظ...' : 'إضافة المصروف'}
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
