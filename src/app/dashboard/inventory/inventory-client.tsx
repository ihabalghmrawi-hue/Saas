'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Search, Package, Edit, Trash2, AlertTriangle,
  Filter, BarChart2, X, Check, Loader2, ChevronDown, Upload
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Product, ProductCategory, Unit, Warehouse } from '@/types/erp'

interface InventoryClientProps {
  products: any[]
  categories: any[]
  units: any[]
  warehouses: any[]
  companyId: string
  currency: string
}

const emptyProduct = {
  name: '', name_ar: '', sku: '', barcode: '',
  cost_price: '', sale_price: '', wholesale_price: '',
  min_stock_level: '', tax_rate: '0',
  category_id: '', unit_id: '',
  type: 'product', track_inventory: true, is_active: true,
  description: '',
}

export function InventoryClient({ products: initialProducts, categories, units, warehouses, companyId, currency }: InventoryClientProps) {
  const [products, setProducts] = useState(initialProducts)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterLowStock, setFilterLowStock] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<any>(emptyProduct)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'all' | 'low'>('all')

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch = !search ||
        (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.name_ar && p.name_ar.includes(search)) ||
        (p.barcode && p.barcode.includes(search)) ||
        (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
      const matchCategory = !filterCategory || p.category_id === filterCategory
      const stock = getTotalStock(p)
      const matchLow = !filterLowStock || (p.track_inventory && stock <= p.min_stock_level)
      return matchSearch && matchCategory && matchLow
    })
  }, [products, search, filterCategory, filterLowStock])

  const getTotalStock = (product: any) => {
    if (!Array.isArray(product?.inventory)) return 0
    return product.inventory.reduce((s: number, i: any) => s + Number(i?.quantity || 0), 0)
  }

  const lowStockCount = products.filter(p => p.track_inventory && getTotalStock(p) <= Number(p.min_stock_level || 0)).length

  const openNew = () => {
    setForm(emptyProduct)
    setEditingProduct(null)
    setShowForm(true)
    setError('')
  }

  const openEdit = (product: Product) => {
    setForm({
      name: product.name,
      name_ar: product.name_ar || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      cost_price: product.cost_price,
      sale_price: product.sale_price,
      wholesale_price: product.wholesale_price || '',
      min_stock_level: product.min_stock_level,
      tax_rate: product.tax_rate,
      category_id: product.category_id || '',
      unit_id: product.unit_id || '',
      type: product.type,
      track_inventory: product.track_inventory,
      is_active: product.is_active,
      description: product.description || '',
    })
    setEditingProduct(product)
    setShowForm(true)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const payload = {
        company_id: companyId,
        name: form.name,
        name_ar: form.name_ar || null,
        sku: form.sku || null,
        barcode: form.barcode || null,
        cost_price: parseFloat(form.cost_price) || 0,
        sale_price: parseFloat(form.sale_price) || 0,
        wholesale_price: parseFloat(form.wholesale_price) || 0,
        min_stock_level: parseFloat(form.min_stock_level) || 0,
        tax_rate: parseFloat(form.tax_rate) || 0,
        category_id: form.category_id || null,
        unit_id: form.unit_id || null,
        type: form.type,
        track_inventory: form.track_inventory,
        is_active: form.is_active,
        description: form.description || null,
      }

      const url = editingProduct ? `/api/inventory/products/${editingProduct.id}` : '/api/inventory/products'
      const method = editingProduct ? 'PUT' : 'POST'

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'حدث خطأ')

      if (editingProduct) {
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...data.product } : p))
      } else {
        setProducts(prev => [data.product, ...prev])
      }
      setShowForm(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا المنتج؟')) return
    try {
      const res = await fetch(`/api/inventory/products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('فشل الحذف')
      setProducts(prev => prev.filter(p => p.id !== id))
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">المنتجات والمخزون</h1>
          <p className="text-sm text-muted-foreground">{products.length} منتج · {lowStockCount > 0 && <span className="text-red-500">{lowStockCount} منخفض المخزون</span>}</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          منتج جديد
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي المنتجات', value: products.length, color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' },
          { label: 'منتجات نشطة', value: products.filter(p => p.is_active).length, color: 'bg-green-50 text-green-600 dark:bg-green-900/20' },
          { label: 'منخفض المخزون', value: lowStockCount, color: 'bg-red-50 text-red-600 dark:bg-red-900/20' },
          { label: 'قيمة المخزون', value: formatCurrency(products.reduce((s, p) => s + getTotalStock(p) * Number(p.cost_price || 0), 0), currency), color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20', isText: true },
        ].map((stat, i) => (
          <div key={i} className={cn('rounded-xl p-3', stat.color)}>
            <p className="text-xs opacity-70">{stat.label}</p>
            <p className={cn('text-lg font-bold mt-0.5', stat.isText && 'text-sm')}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الباركود..." className="w-full border border-input rounded-lg px-3 py-2 pr-9 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
          <option value="">كل الفئات</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar || c.name}</option>)}
        </select>
        <button
          onClick={() => setFilterLowStock(!filterLowStock)}
          className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-all', filterLowStock ? 'bg-red-500 text-white border-red-500' : 'border-input bg-background hover:bg-accent')}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          منخفض المخزون
        </button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">المنتج</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الفئة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">سعر التكلفة</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">سعر البيع</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">المخزون</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">لا توجد منتجات</td></tr>
              ) : (
                filtered.map(product => {
                  const stock = getTotalStock(product)
                  const isLow = product.track_inventory && stock <= product.min_stock_level
                  return (
                    <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{product.name_ar || product.name}</p>
                          {(product.sku || product.barcode) && (
                            <p className="text-xs text-muted-foreground">{product.sku || product.barcode}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {(product.product_categories as any) && (
                          <span className="text-xs bg-accent px-2 py-0.5 rounded-full">
                            {(product.product_categories as any).name_ar || (product.product_categories as any).name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatCurrency(product.cost_price, currency)}</td>
                      <td className="px-4 py-3 font-medium text-primary">{formatCurrency(product.sale_price, currency)}</td>
                      <td className="px-4 py-3">
                        {product.track_inventory ? (
                          <span className={cn('font-medium', isLow ? 'text-red-500' : 'text-foreground')}>
                            {isLow && <AlertTriangle className="w-3.5 h-3.5 inline ml-1" />}
                            {stock}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">غير محدود</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full', product.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 'bg-red-100 text-red-700 dark:bg-red-900/30')}>
                          {product.is_active ? 'نشط' : 'موقوف'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(product)} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(product.id)} className="p-1.5 hover:bg-red-100 rounded-lg text-muted-foreground hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-lg">{editingProduct ? 'تعديل المنتج' : 'منتج جديد'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-accent rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">الاسم بالعربي *</label>
                  <input type="text" value={form.name_ar} onChange={e => setForm((f: any) => ({ ...f, name_ar: e.target.value }))} required placeholder="اسم المنتج" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الاسم بالإنجليزي *</label>
                  <input type="text" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} required placeholder="Product name" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" dir="ltr" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الباركود</label>
                  <input type="text" value={form.barcode} onChange={e => setForm((f: any) => ({ ...f, barcode: e.target.value }))} placeholder="123456789" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" dir="ltr" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">رمز المنتج (SKU)</label>
                  <input type="text" value={form.sku} onChange={e => setForm((f: any) => ({ ...f, sku: e.target.value }))} placeholder="SKU-001" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" dir="ltr" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">سعر التكلفة *</label>
                  <input type="number" step="0.01" value={form.cost_price} onChange={e => setForm((f: any) => ({ ...f, cost_price: e.target.value }))} required placeholder="0.00" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">سعر البيع *</label>
                  <input type="number" step="0.01" value={form.sale_price} onChange={e => setForm((f: any) => ({ ...f, sale_price: e.target.value }))} required placeholder="0.00" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">سعر الجملة</label>
                  <input type="number" step="0.01" value={form.wholesale_price} onChange={e => setForm((f: any) => ({ ...f, wholesale_price: e.target.value }))} placeholder="0.00" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الحد الأدنى للمخزون</label>
                  <input type="number" value={form.min_stock_level} onChange={e => setForm((f: any) => ({ ...f, min_stock_level: e.target.value }))} placeholder="0" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الفئة</label>
                  <select value={form.category_id} onChange={e => setForm((f: any) => ({ ...f, category_id: e.target.value }))} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
                    <option value="">بدون فئة</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar || c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الوحدة</label>
                  <select value={form.unit_id} onChange={e => setForm((f: any) => ({ ...f, unit_id: e.target.value }))} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
                    <option value="">اختر الوحدة</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name_ar || u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">نسبة الضريبة %</label>
                  <input type="number" step="0.01" value={form.tax_rate} onChange={e => setForm((f: any) => ({ ...f, tax_rate: e.target.value }))} placeholder="0" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="flex items-center gap-4 pt-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.track_inventory} onChange={e => setForm((f: any) => ({ ...f, track_inventory: e.target.checked }))} className="w-4 h-4 accent-primary" />
                    تتبع المخزون
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm((f: any) => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 accent-primary" />
                    نشط
                  </label>
                </div>
              </div>

              {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingProduct ? 'حفظ التعديلات' : 'إضافة المنتج'}
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
