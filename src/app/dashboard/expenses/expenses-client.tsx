'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, DollarSign, Edit, Trash2, X, Check, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Expense, ExpenseCategory } from '@/types/erp'

interface ExpensesClientProps { expenses: Expense[]; categories: ExpenseCategory[]; companyId: string; currency: string }

const emptyForm = { description: '', amount: '', category_id: '', expense_date: new Date().toISOString().split('T')[0], payment_method: 'cash', reference: '', }

export function ExpensesClient({ expenses: initial, categories, companyId, currency }: ExpensesClientProps) {
  const [expenses, setExpenses] = useState(initial)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = useMemo(() => expenses.filter(e => {
    const matchSearch = !search || (e.description || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = !filterCategory || e.category_id === filterCategory
    return matchSearch && matchCat
  }), [expenses, search, filterCategory])

  const totalMonth = useMemo(() => {
    const now = new Date()
    return expenses.filter(e => {
      const d = new Date(e.expense_date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).reduce((s, e) => s + e.amount, 0)
  }, [expenses])

  const openNew = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); setError('') }
  const openEdit = (e: Expense) => {
    setForm({ description: e.description, amount: e.amount, category_id: e.category_id || '', expense_date: e.expense_date, payment_method: e.payment_method, reference: e.reference || '' })
    setEditingId(e.id); setShowForm(true); setError('')
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setLoading(true); setError('')
    try {
      const payload = { ...form, company_id: companyId, amount: parseFloat(form.amount), category_id: form.category_id || null }
      const url = editingId ? `/api/expenses/${editingId}` : '/api/expenses'
      const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const withCat = { ...data.expense, expense_categories: categories.find(c => c.id === payload.category_id) }
      if (editingId) setExpenses(prev => prev.map(e => e.id === editingId ? withCat : e))
      else setExpenses(prev => [withCat, ...prev])
      setShowForm(false)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا المصروف؟')) return
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    if (res.ok) setExpenses(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">المصروفات</h1>
          <p className="text-sm text-muted-foreground">{expenses.length} مصروف</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" />مصروف جديد
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
          <p className="text-xs text-red-600">مصروفات الشهر</p>
          <p className="text-lg font-bold text-red-700">{formatCurrency(totalMonth, currency)}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3">
          <p className="text-xs text-purple-600">إجمالي المصروفات</p>
          <p className="text-lg font-bold text-purple-700">{formatCurrency(expenses.reduce((s, e) => s + e.amount, 0), currency)}</p>
        </div>
        {categories.slice(0, 2).map(cat => {
          const total = expenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + e.amount, 0)
          return (
            <div key={cat.id} className="bg-accent rounded-xl p-3">
              <p className="text-xs text-muted-foreground">{cat.name_ar || cat.name}</p>
              <p className="text-lg font-bold">{formatCurrency(total, currency)}</p>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="w-full border border-input rounded-lg px-3 py-2 pr-9 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
          <option value="">كل الفئات</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar || c.name}</option>)}
        </select>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الوصف</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الفئة</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المبلغ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">لا توجد مصروفات</td></tr>
            ) : (
              filtered.map(expense => (
                <tr key={expense.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{expense.description}</td>
                  <td className="px-4 py-3">
                    {(expense.expense_categories as any) && (
                      <span className="text-xs bg-accent px-2 py-0.5 rounded-full">
                        {(expense.expense_categories as any).name_ar || (expense.expense_categories as any).name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(expense.expense_date)}</td>
                  <td className="px-4 py-3 font-bold text-red-600">{formatCurrency(expense.amount, currency)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(expense)} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground"><Edit className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(expense.id)} className="p-1.5 hover:bg-red-100 rounded-lg text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-card rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-lg">{editingId ? 'تعديل المصروف' : 'مصروف جديد'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-accent rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">الوصف *</label>
                <input type="text" value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} required className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">المبلغ *</label>
                  <input type="number" step="0.01" value={form.amount} onChange={e => setForm((f: any) => ({ ...f, amount: e.target.value }))} required className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">التاريخ</label>
                  <input type="date" value={form.expense_date} onChange={e => setForm((f: any) => ({ ...f, expense_date: e.target.value }))} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الفئة</label>
                  <select value={form.category_id} onChange={e => setForm((f: any) => ({ ...f, category_id: e.target.value }))} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
                    <option value="">بدون فئة</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar || c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">طريقة الدفع</label>
                  <select value={form.payment_method} onChange={e => setForm((f: any) => ({ ...f, payment_method: e.target.value }))} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
                    <option value="cash">نقدي</option>
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="card">بطاقة</option>
                  </select>
                </div>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingId ? 'حفظ' : 'إضافة'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 border border-input rounded-lg text-sm hover:bg-accent">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
