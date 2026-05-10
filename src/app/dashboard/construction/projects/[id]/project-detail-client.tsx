'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, AlertTriangle, Plus, Trash2, CheckSquare, DollarSign, Package, CreditCard, Flag, Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Project {
  id: string; name: string; description: string | null; status: string; client_name: string | null;
  client_phone: string | null; location: string | null; expected_cost: number; actual_cost: number;
  start_date: string; end_date: string | null; notes: string | null;
}
interface Task     { id: string; title: string; status: string; priority: string; due_date: string | null; assigned_worker_id: string | null; con_workers?: { name: string } | null }
interface Expense  { id: string; category: string; amount: number; description: string; vendor: string | null; expense_date: string }
interface Material { id: string; name: string; quantity: number; unit: string; unit_price: number; total_price: number; supplier: string | null; purchase_date: string }
interface Payment  { id: string; type: string; amount: number; description: string; payment_method: string; payment_date: string }
interface Worker   { id: string; name: string }

const STATUS_AR: Record<string, string> = { planning: 'تخطيط', active: 'نشط', on_hold: 'موقوف', completed: 'مكتمل', cancelled: 'ملغي' }
const STATUS_COLORS: Record<string, string> = { planning: 'bg-blue-100 text-blue-700', active: 'bg-green-100 text-green-700', on_hold: 'bg-yellow-100 text-yellow-700', completed: 'bg-gray-100 text-gray-600', cancelled: 'bg-red-100 text-red-500' }
const TASK_STATUS_AR: Record<string, string> = { pending: 'انتظار', in_progress: 'جارٍ', done: 'مكتمل', cancelled: 'ملغي' }
const PRIORITY_COLORS: Record<string, string> = { low: 'text-gray-400', medium: 'text-blue-500', high: 'text-orange-500', urgent: 'text-red-500' }
const METHOD_AR: Record<string, string> = { cash: 'نقدي', bank_transfer: 'تحويل بنكي', check: 'شيك', online: 'إلكتروني' }

type Tab = 'overview' | 'tasks' | 'expenses' | 'materials' | 'payments'

export function ProjectDetailClient({ project, tasks: initTasks, expenses: initExpenses, materials: initMaterials, payments: initPayments, workers, currency }: {
  project: Project; tasks: Task[]; expenses: Expense[]; materials: Material[]; payments: Payment[]; workers: Worker[]; currency: string
}) {
  const [tab, setTab] = useState<Tab>('overview')
  const [tasks, setTasks]       = useState(initTasks)
  const [expenses, setExpenses] = useState(initExpenses)
  const [materials, setMaterials] = useState(initMaterials)
  const [payments, setPayments] = useState(initPayments)

  const [showTaskForm, setShowTaskForm]    = useState(false)
  const [showExpForm, setShowExpForm]      = useState(false)
  const [showMatForm, setShowMatForm]      = useState(false)
  const [showPayForm, setShowPayForm]      = useState(false)

  const [taskForm, setTaskForm] = useState({ title: '', priority: 'medium', status: 'todo', worker_id: '', due_date: '' })
  const [expForm,  setExpForm]  = useState({ category: 'labor', amount: '', description: '', vendor: '', expense_date: new Date().toISOString().slice(0, 10) })
  const [matForm,  setMatForm]  = useState({ name: '', supplier: '', unit: 'unit', quantity: '', unit_price: '', purchase_date: new Date().toISOString().slice(0, 10) })
  const [payForm,  setPayForm]  = useState({ type: 'incoming', amount: '', description: '', payment_method: 'cash', payment_date: new Date().toISOString().slice(0, 10), reference: '' })

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const fmt = (n: number) => formatCurrency(n, currency)

  const totalIncome    = payments.filter(p => p.type === 'incoming').reduce((s, p) => s + Number(p.amount), 0)
  const totalExpenseAmt = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalMaterialAmt = materials.reduce((s, m) => s + Number(m.total_price || Number(m.quantity) * Number(m.unit_price)), 0)
  const overrun        = Number(project.actual_cost) > Number(project.expected_cost)
  const pct            = Number(project.expected_cost) > 0 ? Math.min(100, Math.round(Number(project.actual_cost) / Number(project.expected_cost) * 100)) : 0

  const saveTask = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res  = await fetch('/api/construction/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...taskForm, project_id: project.id, worker_id: taskForm.worker_id || null, due_date: taskForm.due_date || null }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTasks(prev => [data, ...prev]); setShowTaskForm(false)
      setTaskForm({ title: '', priority: 'medium', status: 'todo', worker_id: '', due_date: '' })
    } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }

  const saveExpense = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res  = await fetch('/api/construction/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...expForm, amount: Number(expForm.amount), project_id: project.id, vendor: expForm.vendor || null }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setExpenses(prev => [data, ...prev]); setShowExpForm(false)
      setExpForm({ category: 'عمالة', amount: '', description: '', vendor: '', expense_date: new Date().toISOString().slice(0, 10) })
    } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }

  const saveMaterial = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res  = await fetch('/api/construction/materials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...matForm, quantity: Number(matForm.quantity), unit_price: Number(matForm.unit_price), project_id: project.id, supplier: matForm.supplier || null }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMaterials(prev => [data, ...prev]); setShowMatForm(false)
      setMatForm({ name: '', supplier: '', unit: 'وحدة', quantity: '', unit_price: '', purchase_date: new Date().toISOString().slice(0, 10) })
    } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res  = await fetch('/api/construction/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payForm, amount: Number(payForm.amount), project_id: project.id, reference: payForm.reference || null }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPayments(prev => [data, ...prev]); setShowPayForm(false)
      setPayForm({ type: 'incoming', amount: '', description: '', payment_method: 'cash', payment_date: new Date().toISOString().slice(0, 10), reference: '' })
    } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }

  const deleteTask    = async (id: string) => { await fetch(`/api/construction/tasks/${id}`,    { method: 'DELETE' }); setTasks(p    => p.filter(x => x.id !== id)) }
  const deleteExpense = async (id: string) => { await fetch(`/api/construction/expenses/${id}`, { method: 'DELETE' }); setExpenses(p => p.filter(x => x.id !== id)) }
  const deleteMat     = async (id: string) => { await fetch(`/api/construction/materials/${id}`,{ method: 'DELETE' }); setMaterials(p => p.filter(x => x.id !== id)) }
  const deletePay     = async (id: string) => { await fetch(`/api/construction/payments/${id}`, { method: 'DELETE' }); setPayments(p  => p.filter(x => x.id !== id)) }

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview',  label: 'نظرة عامة' },
    { key: 'tasks',     label: 'المهام',       count: tasks.length },
    { key: 'expenses',  label: 'المصروفات',    count: expenses.length },
    { key: 'materials', label: 'المواد',        count: materials.length },
    { key: 'payments',  label: 'المدفوعات',    count: payments.length },
  ]

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/dashboard/construction/projects" className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors mt-0.5">
          <ArrowRight className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold">{project.name}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[project.status] || 'bg-gray-100 text-gray-600'}`}>
              {STATUS_AR[project.status] || project.status}
            </span>
            {overrun && <span className="flex items-center gap-1 text-xs text-red-500"><AlertTriangle className="w-3.5 h-3.5" />تجاوز الميزانية</span>}
          </div>
          {project.client_name && <p className="text-sm text-muted-foreground mt-0.5">{project.client_name}{project.location ? ` — ${project.location}` : ''}</p>}
        </div>
      </div>

      {/* Budget Bar */}
      <div className="bg-card border rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">الميزانية المستهلكة ({pct}%)</span>
          <span className={overrun ? 'text-red-500 font-medium' : 'text-foreground'}>{fmt(Number(project.actual_cost))} / {fmt(Number(project.expected_cost))}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${overrun ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-4 pt-1 text-center">
          <div>
            <p className="text-xs text-muted-foreground">الإيرادات</p>
            <p className="font-semibold text-green-600">{fmt(totalIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">التكاليف</p>
            <p className="font-semibold text-red-500">{fmt(totalExpenseAmt + totalMaterialAmt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">الربح</p>
            <p className={`font-semibold ${totalIncome - totalExpenseAmt - totalMaterialAmt >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>
              {fmt(totalIncome - totalExpenseAmt - totalMaterialAmt)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label}
            {t.count !== undefined && <span className="mr-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{t.count}</span>}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3">{error}</p>}

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {project.description && (
            <div className="col-span-full bg-card border rounded-xl p-4">
              <p className="text-muted-foreground text-xs mb-1">الوصف</p>
              <p>{project.description}</p>
            </div>
          )}
          <div className="bg-card border rounded-xl p-4 space-y-3">
            {[
              ['تاريخ البداية', project.start_date],
              ['تاريخ النهاية', project.end_date || '—'],
              ['العميل', project.client_name || '—'],
              ['الهاتف', project.client_phone || '—'],
              ['الموقع', project.location || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
          {project.notes && (
            <div className="bg-card border rounded-xl p-4">
              <p className="text-muted-foreground text-xs mb-1">ملاحظات</p>
              <p className="text-sm">{project.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Tasks Tab */}
      {tab === 'tasks' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowTaskForm(true)} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> مهمة جديدة
            </button>
          </div>
          <div className="space-y-2">
            {tasks.map(t => (
              <div key={t.id} className="bg-card border rounded-xl p-3 flex items-center gap-3">
                <Flag className={`w-4 h-4 shrink-0 ${PRIORITY_COLORS[t.priority]}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground">{TASK_STATUS_AR[t.status] || t.status}</span>
                    {t.con_workers && <span className="text-xs text-muted-foreground">{t.con_workers.name}</span>}
                    {t.due_date && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{t.due_date}</span>}
                  </div>
                </div>
                <button onClick={() => deleteTask(t.id)} className="p-1.5 hover:bg-red-50 rounded text-muted-foreground hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {tasks.length === 0 && <p className="text-center text-muted-foreground py-8">لا توجد مهام</p>}
          </div>
        </div>
      )}

      {/* Expenses Tab */}
      {tab === 'expenses' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowExpForm(true)} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> مصروف جديد
            </button>
          </div>
          <div className="bg-card border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">التاريخ</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الوصف</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الفئة</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">المبلغ</th>
                <th className="px-4 py-2.5"></th>
              </tr></thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-2.5 text-muted-foreground">{e.expense_date}</td>
                    <td className="px-4 py-2.5">{e.description}</td>
                    <td className="px-4 py-2.5"><span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">{e.category}</span></td>
                    <td className="px-4 py-2.5 font-medium text-left">{fmt(Number(e.amount))}</td>
                    <td className="px-4 py-2.5"><button onClick={() => deleteExpense(e.id)} className="p-1 hover:bg-red-50 rounded text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
                {expenses.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">لا توجد مصروفات</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Materials Tab */}
      {tab === 'materials' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowMatForm(true)} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> إضافة مواد
            </button>
          </div>
          <div className="bg-card border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">المادة</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الكمية</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">سعر الوحدة</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">الإجمالي</th>
                <th className="px-4 py-2.5"></th>
              </tr></thead>
              <tbody>
                {materials.map(m => (
                  <tr key={m.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{m.name}</td>
                    <td className="px-4 py-2.5">{Number(m.quantity)} {m.unit}</td>
                    <td className="px-4 py-2.5">{fmt(Number(m.unit_price))}</td>
                    <td className="px-4 py-2.5 font-medium text-left">{fmt(Number(m.total_price || Number(m.quantity) * Number(m.unit_price)))}</td>
                    <td className="px-4 py-2.5"><button onClick={() => deleteMat(m.id)} className="p-1 hover:bg-red-50 rounded text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
                {materials.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">لا توجد مواد</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payments Tab */}
      {tab === 'payments' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowPayForm(true)} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> دفعة جديدة
            </button>
          </div>
          <div className="bg-card border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">التاريخ</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">النوع</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الوصف</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الطريقة</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">المبلغ</th>
                <th className="px-4 py-2.5"></th>
              </tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-2.5 text-muted-foreground">{p.payment_date}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium ${p.type === 'incoming' ? 'text-green-600' : 'text-red-500'}`}>
                        {p.type === 'incoming' ? 'وارد' : 'صادر'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{p.description}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{METHOD_AR[p.payment_method] || p.payment_method}</td>
                    <td className={`px-4 py-2.5 font-bold text-left ${p.type === 'incoming' ? 'text-green-600' : 'text-red-500'}`}>
                      {p.type === 'incoming' ? '+' : '-'}{fmt(Number(p.amount))}
                    </td>
                    <td className="px-4 py-2.5"><button onClick={() => deletePay(p.id)} className="p-1 hover:bg-red-50 rounded text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
                {payments.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">لا توجد مدفوعات</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Task Form Modal */}
      {showTaskForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-4 border-b"><h2 className="font-semibold text-sm">مهمة جديدة</h2></div>
            <form onSubmit={saveTask} className="p-4 space-y-3">
              <input required placeholder="عنوان المهمة *" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <div className="grid grid-cols-2 gap-2">
                <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="low">منخفض</option><option value="medium">متوسط</option>
                  <option value="high">عالي</option><option value="urgent">عاجل</option>
                </select>
                <select value={taskForm.worker_id} onChange={e => setTaskForm(f => ({ ...f, worker_id: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">— عامل —</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <input type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {loading ? '...' : 'إضافة'}
                </button>
                <button type="button" onClick={() => setShowTaskForm(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-accent">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Form Modal */}
      {showExpForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-4 border-b"><h2 className="font-semibold text-sm">مصروف جديد</h2></div>
            <form onSubmit={saveExpense} className="p-4 space-y-3">
              <input required placeholder="الوصف *" value={expForm.description} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <div className="grid grid-cols-2 gap-2">
                <select value={expForm.category} onChange={e => setExpForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="labor">عمالة</option>
              <option value="materials">مواد بناء</option>
              <option value="equipment">معدات</option>
              <option value="transport">نقل</option>
              <option value="subcontract">مقاول من الباطن</option>
              <option value="other">أخرى</option>
                </select>
                <input required type="number" min="0" step="0.01" placeholder="المبلغ *" value={expForm.amount} onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="المورد / الجهة" value={expForm.vendor} onChange={e => setExpForm(f => ({ ...f, vendor: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <input type="date" value={expForm.expense_date} onChange={e => setExpForm(f => ({ ...f, expense_date: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium disabled:opacity-50">{loading ? '...' : 'إضافة'}</button>
                <button type="button" onClick={() => setShowExpForm(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-accent">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Material Form Modal */}
      {showMatForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-4 border-b"><h2 className="font-semibold text-sm">إضافة مواد</h2></div>
            <form onSubmit={saveMaterial} className="p-4 space-y-3">
              <input required placeholder="اسم المادة *" value={matForm.name} onChange={e => setMatForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <div className="grid grid-cols-2 gap-2">
                <input required type="number" min="0" step="0.01" placeholder="الكمية *" value={matForm.quantity} onChange={e => setMatForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <select value={matForm.unit} onChange={e => setMatForm(f => ({ ...f, unit: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="unit">وحدة</option>
                  <option value="m">متر</option>
                  <option value="m2">متر مربع</option>
                  <option value="m3">متر مكعب</option>
                  <option value="kg">كيلو</option>
                  <option value="ton">طن</option>
                  <option value="liter">لتر</option>
                  <option value="box">صندوق</option>
                  <option value="bag">كيس</option>
                  <option value="roll">رول</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input required type="number" min="0" step="0.01" placeholder="سعر الوحدة *" value={matForm.unit_price} onChange={e => setMatForm(f => ({ ...f, unit_price: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <input placeholder="المورد" value={matForm.supplier} onChange={e => setMatForm(f => ({ ...f, supplier: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              {matForm.quantity && matForm.unit_price && (
                <p className="text-sm text-primary font-medium">الإجمالي: {fmt(Number(matForm.quantity) * Number(matForm.unit_price))}</p>
              )}
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium disabled:opacity-50">{loading ? '...' : 'إضافة'}</button>
                <button type="button" onClick={() => setShowMatForm(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-accent">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Form Modal */}
      {showPayForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-4 border-b"><h2 className="font-semibold text-sm">دفعة جديدة</h2></div>
            <form onSubmit={savePayment} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <select value={payForm.type} onChange={e => setPayForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="incoming">وارد</option><option value="outgoing">صادر</option>
                </select>
                <input required type="number" min="0" step="0.01" placeholder="المبلغ *" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <input required placeholder="الوصف *" value={payForm.description} onChange={e => setPayForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <div className="grid grid-cols-2 gap-2">
                <select value={payForm.payment_method} onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="cash">نقدي</option><option value="bank_transfer">تحويل بنكي</option>
                  <option value="check">شيك</option><option value="online">إلكتروني</option>
                </select>
                <input type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium disabled:opacity-50">{loading ? '...' : 'إضافة'}</button>
                <button type="button" onClick={() => setShowPayForm(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-accent">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
