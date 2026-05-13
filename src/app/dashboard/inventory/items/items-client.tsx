'use client'

import { useState, useMemo } from 'react'
import { Search, Package, Plus, Loader2, Check, X, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ItemsClientProps {
  items: any[]
  warehouses: any[]
  companyId: string
  currency: string
}

const emptyItem = {
  name: '', name_ar: '', sku: '', barcode: '',
  unit: '', category: '',
  cost_price: '', sale_price: '',
  min_stock_level: '0', is_active: true,
}

export function ItemsClient({ items: initialItems, warehouses, companyId, currency }: ItemsClientProps) {
  const [items, setItems] = useState(initialItems)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyItem)

  const filtered = useMemo(() => items.filter(i => {
    if (!search) return true
    const q = search.toLowerCase()
    return (i.name || '').toLowerCase().includes(q) ||
      (i.name_ar || '').includes(search) ||
      (i.sku || '').toLowerCase().includes(q) ||
      (i.barcode || '').includes(q)
  }), [items, search])

  const totalValue = items.reduce((s, i) => s + (Number(i.cost_price || 0) * Number(i.current_qty || 0)), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const payload = {
        company_id: companyId,
        name: form.name, name_ar: form.name_ar || null,
        sku: form.sku || null, barcode: form.barcode || null,
        unit: form.unit || null, category: form.category || null,
        cost_price: parseFloat(form.cost_price) || 0,
        sale_price: parseFloat(form.sale_price) || 0,
        min_stock_level: parseFloat(form.min_stock_level) || 0,
        is_active: form.is_active,
      }
      const res = await fetch('/api/inventory/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'حدث خطأ')
      setItems(prev => [data.data || data.item, ...prev])
      setShowForm(false)
      setForm(emptyItem)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">الأصناف</h1>
          <p className="text-sm text-muted-foreground">{items.length} صنف</p>
        </div>
        <button onClick={() => { setError(''); setShowForm(true) }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" />صنف جديد
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-600">إجمالي الأصناف</p>
          <p className="text-xl font-bold text-blue-700">{items.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-xs text-green-600">قيمة المخزون</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(totalValue, currency)}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <p className="text-xs text-purple-600">المستودعات</p>
          <p className="text-xl font-bold text-purple-700">{warehouses.length}</p>
        </div>
      </div>

      <div className="relative flex-1">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الباركود..."
          className="w-full border border-input rounded-lg px-3 py-2 pr-9 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الصنف</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">سعر التكلفة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">سعر البيع</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الكمية</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحد الأدنى</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">لا توجد أصناف</td></tr>
              ) : filtered.map(item => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-medium">{item.name_ar || item.name || '—'}</p>
                        {(item.sku || item.barcode) && <p className="text-xs text-muted-foreground">{item.sku || item.barcode}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatCurrency(item.cost_price || 0, currency)}</td>
                  <td className="px-4 py-3 font-medium text-primary">{formatCurrency(item.sale_price || 0, currency)}</td>
                  <td className="px-4 py-3">{Number(item.current_qty || 0).toLocaleString('ar')}</td>
                  <td className="px-4 py-3">{Number(item.min_stock_level || 0)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full', item.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                      {item.is_active ? 'نشط' : 'موقوف'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-card z-10">
              <h2 className="font-bold text-lg">صنف جديد</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-accent rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">الاسم بالعربي *</label>
                  <input type="text" value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} required
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الاسم بالإنجليزي</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" dir="ltr" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الباركود</label>
                  <input type="text" value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" dir="ltr" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">رمز SKU</label>
                  <input type="text" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" dir="ltr" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">سعر التكلفة *</label>
                  <input type="number" step="0.01" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} required
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">سعر البيع *</label>
                  <input type="number" step="0.01" value={form.sale_price} onChange={e => setForm(f => ({ ...f, sale_price: e.target.value }))} required
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">الوحدة</label>
                  <input type="text" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الفئة</label>
                  <input type="text" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">الحد الأدنى للمخزون</label>
                <input type="number" value={form.min_stock_level} onChange={e => setForm(f => ({ ...f, min_stock_level: e.target.value }))}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading}
                  className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  إضافة الصنف
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 border border-input rounded-lg text-sm hover:bg-accent">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
