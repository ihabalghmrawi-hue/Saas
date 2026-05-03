'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, ShoppingBag, X, Check, Loader2, Trash2, Eye } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Purchase, Supplier } from '@/types/erp'

interface PurchasesClientProps {
  purchases: Purchase[]
  suppliers: Supplier[]
  products: any[]
  warehouses: any[]
  companyId: string
  currency: string
}

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  paid: { label: 'مدفوعة', color: 'bg-green-100 text-green-700 dark:bg-green-900/30' },
  partial: { label: 'جزئي', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30' },
  unpaid: { label: 'غير مدفوعة', color: 'bg-red-100 text-red-700 dark:bg-red-900/30' },
}

export function PurchasesClient({ purchases: initial, suppliers, products, warehouses, companyId, currency }: PurchasesClientProps) {
  const [purchases, setPurchases] = useState(initial)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState<any[]>([{ product_id: '', quantity: 1, unit_cost: 0, total: 0 }])
  const [form, setForm] = useState({ supplier_id: '', warehouse_id: warehouses[0]?.id || '', purchase_date: new Date().toISOString().split('T')[0], notes: '', payment_status: 'paid' })

  const filtered = useMemo(() => purchases.filter(p => !search || p.invoice_number.includes(search) || (p.suppliers as any)?.name?.toLowerCase().includes(search.toLowerCase())), [purchases, search])

  const totalMonth = purchases.filter(p => {
    const d = new Date(p.purchase_date)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((s, p) => s + p.total, 0)

  const totalUnpaid = purchases.filter(p => p.payment_status !== 'paid').reduce((s, p) => s + p.due_amount, 0)

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      if (field === 'quantity' || field === 'unit_cost') {
        updated[idx].total = updated[idx].quantity * updated[idx].unit_cost
      }
      if (field === 'product_id') {
        const product = products.find(p => p.id === value)
        if (product) updated[idx].unit_cost = product.cost_price || 0
        updated[idx].total = updated[idx].quantity * (updated[idx].unit_cost || 0)
      }
      return updated
    })
  }

  const addItem = () => setItems(prev => [...prev, { product_id: '', quantity: 1, unit_cost: 0, total: 0 }])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const subtotal = items.reduce((s, i) => s + (i.total || 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.every(i => !i.product_id)) { setError('أضف منتجاً واحداً على الأقل'); return }
    setLoading(true); setError('')
    try {
      const validItems = items.filter(i => i.product_id && i.quantity > 0)
      const payload = {
        ...form,
        company_id: companyId,
        items: validItems.map((item, idx) => ({ ...item, line_number: idx + 1 })),
        subtotal,
        total: subtotal,
        paid_amount: form.payment_status === 'paid' ? subtotal : 0,
        due_amount: form.payment_status === 'paid' ? 0 : subtotal,
      }
      const res = await fetch('/api/purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'حدث خطأ')
      setPurchases(prev => [data.purchase, ...prev])
      setShowForm(false)
      setItems([{ product_id: '', quantity: 1, unit_cost: 0, total: 0 }])
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">فواتير الشراء</h1>
          <p className="text-sm text-muted-foreground">{purchases.length} فاتورة</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" />فاتورة شراء جديدة
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
          <p className="text-xs text-blue-600">مشتريات الشهر</p>
          <p className="text-lg font-bold text-blue-700">{formatCurrency(totalMonth, currency)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
          <p className="text-xs text-red-600">مستحق للموردين</p>
          <p className="text-lg font-bold text-red-700">{formatCurrency(totalUnpaid, currency)}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3">
          <p className="text-xs text-purple-600">إجمالي الفواتير</p>
          <p className="text-2xl font-bold text-purple-700">{purchases.length}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم الفاتورة أو المورد..." className="w-full border border-input rounded-lg px-3 py-2 pr-9 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">رقم الفاتورة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">المورد</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الإجمالي</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الدفع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">لا توجد فواتير شراء</td></tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-primary">{p.invoice_number}</td>
                    <td className="px-4 py-3">{(p.suppliers as any)?.name || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(p.purchase_date)}</td>
                    <td className="px-4 py-3 font-bold">{formatCurrency(p.total, currency)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', PAYMENT_STATUS[p.payment_status]?.color)}>
                        {PAYMENT_STATUS[p.payment_status]?.label}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Purchase Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-card rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-lg">فاتورة شراء جديدة</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-accent rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">المورد</label>
                  <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
                    <option value="">اختر المورد</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name_ar || s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">المستودع</label>
                  <select value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_ar || w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">التاريخ</label>
                  <input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none" />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">المنتجات</label>
                  <button type="button" onClick={addItem} className="text-xs text-primary flex items-center gap-1 hover:underline">
                    <Plus className="w-3 h-3" />إضافة منتج
                  </button>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <select value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)} className="w-full border border-input rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none">
                          <option value="">اختر المنتج</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name_ar || p.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0.001" step="0.001" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} placeholder="الكمية" className="w-full border border-input rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none text-center" />
                      </div>
                      <div className="col-span-3">
                        <input type="number" step="0.01" value={item.unit_cost} onChange={e => updateItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)} placeholder="سعر التكلفة" className="w-full border border-input rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none" />
                      </div>
                      <div className="col-span-1 text-sm font-medium text-right text-muted-foreground">
                        {formatCurrency(item.total, currency)}
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-3 text-sm font-bold">
                  الإجمالي: {formatCurrency(subtotal, currency)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">حالة الدفع</label>
                  <select value={form.payment_status} onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
                    <option value="paid">مدفوعة</option>
                    <option value="partial">دفع جزئي</option>
                    <option value="unpaid">آجل</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">ملاحظات</label>
                  <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none" />
                </div>
              </div>

              {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  حفظ فاتورة الشراء
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
