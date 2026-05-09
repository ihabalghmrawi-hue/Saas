'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Warehouse, Star, Trash2, Edit, X, Check, Loader2, Package, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WarehouseRow {
  id: string
  name: string
  name_ar: string | null
  is_default: boolean
  total_qty: number
}

interface Props { warehouses: WarehouseRow[]; companyId: string }

const empty = { name: '', name_ar: '', is_default: false }

export function WarehousesClient({ warehouses: initial, companyId }: Props) {
  const [warehouses, setWarehouses] = useState(initial)
  const [showForm, setShowForm]     = useState(false)
  const [editTarget, setEditTarget] = useState<WarehouseRow | null>(null)
  const [form, setForm]             = useState<typeof empty>(empty)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  const openNew = () => { setForm(empty); setEditTarget(null); setShowForm(true); setError('') }
  const openEdit = (w: WarehouseRow) => {
    setForm({ name: w.name, name_ar: w.name_ar || '', is_default: w.is_default })
    setEditTarget(w); setShowForm(true); setError('')
  }

  const handleSubmit = async () => {
    if (!form.name) { setError('اسم المخزن مطلوب'); return }
    setLoading(true); setError('')
    try {
      const method = editTarget ? 'PATCH' : 'POST'
      const body   = editTarget ? { id: editTarget.id, ...form } : form
      const res    = await fetch('/api/warehouses', {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (editTarget) {
        setWarehouses(prev => prev.map(w => w.id === editTarget.id ? { ...w, ...data } : data.is_default ? { ...w, is_default: false } : w))
      } else {
        if (data.is_default) setWarehouses(prev => prev.map(w => ({ ...w, is_default: false })))
        setWarehouses(prev => [{ ...data, total_qty: 0 }, ...prev])
      }
      setShowForm(false)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const handleDelete = async (w: WarehouseRow) => {
    if (!confirm(`هل تريد حذف المخزن "${w.name}"؟`)) return
    const res = await fetch('/api/warehouses', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: w.id }) })
    if (res.ok) setWarehouses(prev => prev.filter(x => x.id !== w.id))
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-primary" />
            المخازن
          </h1>
          <p className="text-sm text-muted-foreground">{warehouses.length} مخزن</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> مخزن جديد
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي المخازن',   value: warehouses.length,                                        color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700'    },
          { label: 'إجمالي المخزون',   value: warehouses.reduce((s, w) => s + w.total_qty, 0) + ' وحدة', color: 'bg-green-50 dark:bg-green-900/20 text-green-700'  },
          { label: 'المخزن الافتراضي', value: warehouses.find(w => w.is_default)?.name || '—',           color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700'  },
          { label: 'مخازن نشطة',       value: warehouses.length,                                        color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700'},
        ].map((s, i) => (
          <div key={i} className={`${s.color} rounded-xl p-4 border border-white/50`}>
            <p className="text-xs font-medium opacity-70">{s.label}</p>
            <p className="font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Warehouses Grid */}
      {warehouses.length === 0 ? (
        <div className="bg-card border-2 border-dashed border-primary/20 rounded-2xl p-12 text-center">
          <Warehouse className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <h2 className="text-lg font-semibold mb-1">لا توجد مخازن بعد</h2>
          <p className="text-sm text-muted-foreground mb-4">أضف مخزنك الأول لتتمكن من إدارة المخزون والمبيعات</p>
          <button onClick={openNew} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-primary/90">
            <Plus className="w-4 h-4 inline ml-2" />إضافة مخزن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses.map(w => (
            <div key={w.id} className={cn('bg-card border rounded-2xl p-5 hover:shadow-md transition-all', w.is_default && 'border-primary/30 bg-primary/5')}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', w.is_default ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                    <Warehouse className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{w.name_ar || w.name}</h3>
                    {w.name_ar && w.name !== w.name_ar && <p className="text-xs text-muted-foreground" dir="ltr">{w.name}</p>}
                  </div>
                </div>
                {w.is_default && (
                  <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    <Star className="w-3 h-3 fill-current" />افتراضي
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center gap-1.5 text-sm">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold">{w.total_qty.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">وحدة</span>
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/dashboard/inventory/movements?warehouse=${w.id}`}
                    className="px-2.5 py-1.5 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium">
                    الحركة
                  </Link>
                  <button onClick={() => openEdit(w)} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  {!w.is_default && (
                    <button onClick={() => handleDelete(w)} className="p-1.5 hover:bg-red-100 rounded-lg text-muted-foreground hover:text-red-600 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{editTarget ? 'تعديل المخزن' : 'مخزن جديد'}</h3>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">الاسم بالعربية *</label>
                <input value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))}
                  placeholder="المخزن الرئيسي"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">الاسم بالإنجليزية</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Main Warehouse" dir="ltr"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.is_default}
                onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                className="w-4 h-4 rounded accent-primary" />
              <span className="text-sm">تعيين كمخزن افتراضي</span>
            </label>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 text-xs p-2.5 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 bg-primary text-white py-2.5 rounded-xl font-medium text-sm hover:bg-primary/90 flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editTarget ? 'حفظ التغييرات' : 'إضافة المخزن'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-input rounded-xl text-sm hover:bg-accent">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
