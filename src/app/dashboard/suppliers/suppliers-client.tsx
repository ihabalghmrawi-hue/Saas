'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, Truck, Edit, Trash2, Phone, X, Check, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Supplier } from '@/types/erp'

interface SuppliersClientProps { suppliers: Supplier[]; companyId: string; currency: string }

const emptyForm = { name: '', name_ar: '', phone: '', email: '', address: '', tax_number: '', payment_terms: '30', notes: '', is_active: true }

export function SuppliersClient({ suppliers: initial, companyId, currency }: SuppliersClientProps) {
  const [suppliers, setSuppliers] = useState(initial)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const filtered = useMemo(() => suppliers.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.phone && s.phone.includes(search))), [suppliers, search])
  const totalDebt = suppliers.reduce((s, sup) => s + Math.max(0, sup.balance), 0)

  const openNew = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); setError('') }
  const openEdit = (s: Supplier) => {
    setForm({ name: s.name, name_ar: s.name_ar || '', phone: s.phone || '', email: s.email || '', address: s.address || '', tax_number: s.tax_number || '', payment_terms: s.payment_terms, notes: s.notes || '', is_active: s.is_active })
    setEditingId(s.id); setShowForm(true); setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const payload = { ...form, company_id: companyId, payment_terms: parseInt(form.payment_terms) || 30 }
      const url = editingId ? `/api/suppliers/${editingId}` : '/api/suppliers'
      const res = await fetch(url, { method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (editingId) setSuppliers(prev => prev.map(s => s.id === editingId ? data.supplier : s))
      else setSuppliers(prev => [data.supplier, ...prev])
      setShowForm(false)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا المورد؟')) return
    const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
    if (res.ok) setSuppliers(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">الموردون</h1>
          <p className="text-sm text-muted-foreground">{suppliers.length} مورد · مستحق: {formatCurrency(totalDebt, currency)}</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" />مورد جديد
        </button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الهاتف..." className="w-full border border-input rounded-lg px-3 py-2 pr-9 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(supplier => (
          <div key={supplier.id} className="bg-card border rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center">
                  <Truck className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{supplier.name_ar || supplier.name}</p>
                  {supplier.phone && <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><Phone className="w-3 h-3" />{supplier.phone}</div>}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(supplier)} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground"><Edit className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(supplier.id)} className="p-1.5 hover:bg-red-100 rounded-lg text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            {supplier.balance > 0 && (
              <div className="mt-3 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-1.5 flex justify-between">
                <span className="text-xs text-red-600">مستحق</span>
                <span className="text-sm font-bold text-red-700">{formatCurrency(supplier.balance, currency)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-card rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-lg">{editingId ? 'تعديل المورد' : 'مورد جديد'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-accent rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'الاسم *', key: 'name_ar', type: 'text', required: true },
                  { label: 'الهاتف', key: 'phone', type: 'text', dir: 'ltr' },
                  { label: 'البريد الإلكتروني', key: 'email', type: 'email', dir: 'ltr' },
                  { label: 'أيام السداد', key: 'payment_terms', type: 'number' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-sm font-medium mb-1 block">{field.label}</label>
                    <input
                      type={field.type}
                      value={form[field.key]}
                      onChange={e => setForm((f: any) => ({ ...f, [field.key]: e.target.value, ...(field.key === 'name_ar' ? { name: e.target.value } : {}) }))}
                      required={field.required}
                      dir={field.dir as any}
                      className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">العنوان</label>
                <input type="text" value={form.address} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
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
