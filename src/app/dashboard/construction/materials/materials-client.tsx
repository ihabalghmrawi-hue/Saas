'use client'

import { useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Material {
  id: string; project_id: string | null; name: string; supplier: string | null; unit: string;
  quantity: number; unit_price: number; total_price: number; purchase_date: string; notes: string | null;
  con_projects?: { name: string } | null;
}
interface Project { id: string; name: string }

// DB CHECK: ('unit','kg','ton','m','m2','m3','liter','box','bag','roll','other')
const UNITS: Record<string, string> = {
  unit:  'وحدة',
  kg:    'كيلو',
  ton:   'طن',
  m:     'متر',
  m2:    'متر مربع',
  m3:    'متر مكعب',
  liter: 'لتر',
  box:   'صندوق',
  bag:   'كيس',
  roll:  'رول',
  other: 'أخرى',
}

const emptyForm = {
  project_id: '', name: '', supplier: '', unit: 'unit', quantity: '',
  unit_price: '', purchase_date: new Date().toISOString().slice(0, 10), notes: '',
}

export function MaterialsClient({ materials: init, projects, currency }: { materials: Material[]; projects: Project[]; currency: string }) {
  const [materials, setMaterials] = useState(init)
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const fmt = (n: number) => formatCurrency(n, currency)

  const filtered = materials.filter(m => {
    const q = search.toLowerCase()
    return (!q || m.name.toLowerCase().includes(q) || (m.supplier || '').toLowerCase().includes(q))
      && (!filterProject || m.project_id === filterProject)
  })

  const total = filtered.reduce((s, m) => s + Number(m.total_price || (Number(m.quantity) * Number(m.unit_price))), 0)

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setLoading(true); setError('')
    try {
      const payload = {
        ...form,
        quantity:   Number(form.quantity)   || 0,
        unit_price: Number(form.unit_price) || 0,
        project_id: form.project_id || null,
        supplier:   form.supplier   || null,
        notes:      form.notes      || null,
      }
      const res  = await fetch('/api/construction/materials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMaterials(prev => [data, ...prev])
      setShowForm(false); setForm(emptyForm)
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا الصنف؟')) return
    setDeleting(id)
    await fetch(`/api/construction/materials/${id}`, { method: 'DELETE' })
    setMaterials(prev => prev.filter(m => m.id !== id))
    setDeleting(null)
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">المواد والمشتريات</h1>
          <p className="text-sm text-muted-foreground mt-0.5">الإجمالي: <span className="font-semibold text-foreground">{fmt(total)}</span></p>
        </div>
        <button onClick={() => { setForm(emptyForm); setError(''); setShowForm(true) }}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-2">
          <Plus className="w-4 h-4" /> إضافة مواد
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالمادة أو المورد..."
            className="w-full border rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background" />
        </div>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">كل المشاريع</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المادة</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المشروع</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المورد</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الكمية</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">سعر الوحدة</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">الإجمالي</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.id} className="border-t hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-muted-foreground">{m.purchase_date}</td>
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{m.con_projects?.name || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{m.supplier || '—'}</td>
                <td className="px-4 py-3">{Number(m.quantity)} {UNITS[m.unit] || m.unit}</td>
                <td className="px-4 py-3">{fmt(Number(m.unit_price))}</td>
                <td className="px-4 py-3 font-medium text-left">{fmt(Number(m.total_price || Number(m.quantity) * Number(m.unit_price)))}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(m.id)} disabled={deleting === m.id}
                    className="p-1.5 hover:bg-red-50 rounded text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">لا توجد مواد</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b"><h2 className="font-semibold">إضافة مواد</h2></div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">اسم المادة *</label>
                  <input required value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
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
                  <label className="text-xs text-muted-foreground mb-1 block">المورد</label>
                  <input value={form.supplier} onChange={e => setForm((f: any) => ({ ...f, supplier: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">الكمية *</label>
                  <input required type="number" min="0" step="0.001" value={form.quantity} onChange={e => setForm((f: any) => ({ ...f, quantity: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">الوحدة</label>
                  <select value={form.unit} onChange={e => setForm((f: any) => ({ ...f, unit: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {Object.entries(UNITS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">سعر الوحدة *</label>
                  <input required type="number" min="0" step="0.01" value={form.unit_price} onChange={e => setForm((f: any) => ({ ...f, unit_price: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">تاريخ الشراء</label>
                  <input type="date" value={form.purchase_date} onChange={e => setForm((f: any) => ({ ...f, purchase_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">ملاحظات</label>
                  <textarea rows={2} value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                {form.quantity && form.unit_price && (
                  <div className="col-span-2 bg-primary/5 rounded-lg p-3 text-sm">
                    الإجمالي: <span className="font-bold text-primary">{fmt(Number(form.quantity) * Number(form.unit_price))}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading}
                  className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                  {loading ? 'جاري الحفظ...' : 'إضافة المواد'}
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
