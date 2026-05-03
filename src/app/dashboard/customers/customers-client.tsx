'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, User, Edit, Trash2, Phone, Mail, X, Check, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Customer } from '@/types/erp'

interface CustomersClientProps {
  customers: Customer[]
  companyId: string
  currency: string
}

const emptyForm = {
  name: '', name_ar: '', phone: '', email: '', address: '',
  tax_number: '', credit_limit: '0', notes: '', is_active: true,
}

export function CustomersClient({ customers: initial, companyId, currency }: CustomersClientProps) {
  const [customers, setCustomers] = useState(initial)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = useMemo(() =>
    customers.filter(c =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search)) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
    ), [customers, search])

  const totalDebt = customers.reduce((s, c) => s + Math.max(0, c.balance), 0)

  const openNew = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
    setError('')
  }

  const openEdit = (c: Customer) => {
    setForm({
      name: c.name, name_ar: c.name_ar || '', phone: c.phone || '',
      email: c.email || '', address: c.address || '', tax_number: c.tax_number || '',
      credit_limit: c.credit_limit, notes: c.notes || '', is_active: c.is_active,
    })
    setEditingId(c.id)
    setShowForm(true)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload = { ...form, company_id: companyId, credit_limit: parseFloat(form.credit_limit) || 0 }
      const url = editingId ? `/api/customers/${editingId}` : '/api/customers'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'حدث خطأ')
      if (editingId) {
        setCustomers(prev => prev.map(c => c.id === editingId ? data.customer : c))
      } else {
        setCustomers(prev => [data.customer, ...prev])
      }
      setShowForm(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا العميل؟')) return
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    if (res.ok) setCustomers(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">العملاء</h1>
          <p className="text-sm text-muted-foreground">{customers.length} عميل · ديون: {formatCurrency(totalDebt, currency)}</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" />
          عميل جديد
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
          <p className="text-xs text-blue-600">إجمالي العملاء</p>
          <p className="text-2xl font-bold text-blue-700">{customers.length}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
          <p className="text-xs text-red-600">إجمالي الديون</p>
          <p className="text-lg font-bold text-red-700">{formatCurrency(totalDebt, currency)}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
          <p className="text-xs text-green-600">عملاء نشطون</p>
          <p className="text-2xl font-bold text-green-700">{customers.filter(c => c.is_active).length}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الهاتف..." className="w-full border border-input rounded-lg px-3 py-2 pr-9 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(customer => (
          <div key={customer.id} className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{customer.name_ar || customer.name}</p>
                  {customer.code && <p className="text-xs text-muted-foreground">{customer.code}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(customer)} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground"><Edit className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(customer.id)} className="p-1.5 hover:bg-red-100 rounded-lg text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              {customer.phone && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="w-3 h-3" />{customer.phone}
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="w-3 h-3" />{customer.email}
                </div>
              )}
            </div>
            {customer.balance > 0 && (
              <div className="mt-3 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-1.5 flex justify-between items-center">
                <span className="text-xs text-red-600">رصيد مستحق</span>
                <span className="text-sm font-bold text-red-700">{formatCurrency(customer.balance, currency)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-card rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-lg">{editingId ? 'تعديل العميل' : 'عميل جديد'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-accent rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">الاسم بالعربي *</label>
                  <input type="text" value={form.name_ar} onChange={e => setForm((f: any) => ({ ...f, name_ar: e.target.value, name: e.target.value }))} required className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">رقم الهاتف</label>
                  <input type="text" value={form.phone} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} dir="ltr" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">البريد الإلكتروني</label>
                  <input type="email" value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} dir="ltr" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">حد الائتمان</label>
                  <input type="number" value={form.credit_limit} onChange={e => setForm((f: any) => ({ ...f, credit_limit: e.target.value }))} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">العنوان</label>
                <input type="text" value={form.address} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">ملاحظات</label>
                <textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingId ? 'حفظ' : 'إضافة'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-input rounded-lg text-sm hover:bg-accent">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
