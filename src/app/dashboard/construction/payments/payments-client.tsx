'use client'

import { useState } from 'react'
import { Plus, Search, ArrowDownLeft, ArrowUpRight, Trash2 } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

interface Payment {
  id: string; project_id: string | null; type: string; amount: number; description: string;
  payment_method: string; payment_date: string; reference: string | null; notes: string | null;
  con_projects?: { name: string } | null;
}
interface Project { id: string; name: string }

const METHODS = ['cash', 'bank_transfer', 'check', 'online']
const METHOD_AR: Record<string, string> = { cash: 'نقدي', bank_transfer: 'تحويل بنكي', check: 'شيك', online: 'إلكتروني' }

const emptyForm = { project_id: '', type: 'incoming', amount: '', description: '', payment_method: 'cash', payment_date: new Date().toISOString().slice(0, 10), reference: '', notes: '' }

export function PaymentsClient({ payments: init, projects, currency }: { payments: Payment[]; projects: Project[]; currency: string }) {
  const [payments, setPayments] = useState(init)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const fmt = (n: number) => formatCurrency(n, currency)

  const filtered = payments.filter(p => {
    const q = search.toLowerCase()
    return (!q || p.description.toLowerCase().includes(q) || (p.reference || '').toLowerCase().includes(q))
      && (!filterType    || p.type       === filterType)
      && (!filterProject || p.project_id === filterProject)
  })

  const totalIn  = filtered.filter(p => p.type === 'incoming').reduce((s, p) => s + Number(p.amount), 0)
  const totalOut = filtered.filter(p => p.type === 'outgoing').reduce((s, p) => s + Number(p.amount), 0)

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setLoading(true); setError('')
    try {
      const payload = { ...form, amount: Number(form.amount) || 0, project_id: form.project_id || null, reference: form.reference || null, notes: form.notes || null }
      const res  = await fetch('/api/construction/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPayments(prev => [data, ...prev])
      setShowForm(false); setForm(emptyForm)
    } catch (err: any) { setError(err.message) }
    finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذه الدفعة؟')) return
    setDeleting(id)
    await fetch(`/api/construction/payments/${id}`, { method: 'DELETE' })
    setPayments(prev => prev.filter(p => p.id !== id))
    setDeleting(null)
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">المدفوعات</h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm text-green-600">وارد: <span className="font-bold">{fmt(totalIn)}</span></p>
            <p className="text-sm text-red-500">صادر: <span className="font-bold">{fmt(totalOut)}</span></p>
            <p className="text-sm text-muted-foreground">صافي: <span className={`font-bold ${totalIn - totalOut >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(totalIn - totalOut)}</span></p>
          </div>
        </div>
        <button onClick={() => { setForm(emptyForm); setError(''); setShowForm(true) }}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-2">
          <Plus className="w-4 h-4" /> دفعة جديدة
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
            className="w-full border rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="">الكل</option>
          <option value="incoming">وارد</option>
          <option value="outgoing">صادر</option>
        </select>
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
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">النوع</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الوصف</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المشروع</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">طريقة الدفع</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المرجع</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">المبلغ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-t hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-muted-foreground">{p.payment_date}</td>
                <td className="px-4 py-3">
                  {p.type === 'incoming'
                    ? <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><ArrowDownLeft className="w-3.5 h-3.5" />وارد</span>
                    : <span className="flex items-center gap-1 text-red-500 text-xs font-medium"><ArrowUpRight className="w-3.5 h-3.5" />صادر</span>
                  }
                </td>
                <td className="px-4 py-3">{p.description}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.con_projects?.name || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{METHOD_AR[p.payment_method] || p.payment_method}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.reference || '—'}</td>
                <td className={`px-4 py-3 font-bold text-left ${p.type === 'incoming' ? 'text-green-600' : 'text-red-500'}`}>
                  {p.type === 'incoming' ? '+' : '-'}{fmt(Number(p.amount))}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                    className="p-1.5 hover:bg-red-50 rounded text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">لا توجد مدفوعات</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b"><h2 className="font-semibold">دفعة جديدة</h2></div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">النوع</label>
                  <select value={form.type} onChange={e => setForm((f: any) => ({ ...f, type: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                    <option value="incoming">وارد (إيراد)</option>
                    <option value="outgoing">صادر (دفع)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">المبلغ *</label>
                  <input required type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm((f: any) => ({ ...f, amount: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">الوصف *</label>
                  <input required value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
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
                  <label className="text-xs text-muted-foreground mb-1 block">طريقة الدفع</label>
                  <select value={form.payment_method} onChange={e => setForm((f: any) => ({ ...f, payment_method: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {METHODS.map(m => <option key={m} value={m}>{METHOD_AR[m]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">التاريخ</label>
                  <input type="date" value={form.payment_date} onChange={e => setForm((f: any) => ({ ...f, payment_date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">المرجع</label>
                  <input value={form.reference} onChange={e => setForm((f: any) => ({ ...f, reference: e.target.value }))}
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
                  {loading ? 'جاري الحفظ...' : 'إضافة الدفعة'}
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
