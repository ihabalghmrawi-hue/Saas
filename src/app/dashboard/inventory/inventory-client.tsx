'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Search, Package, Edit, Trash2, AlertTriangle,
  X, Check, Loader2, Sparkles, ChevronDown, ChevronUp, Tag, Ruler, Palette,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Features } from '@/lib/features'

interface InventoryClientProps {
  products: any[]
  categories: any[]
  units: any[]
  warehouses: any[]
  companyId: string
  currency: string
  features: Features
}

// ── Size presets per business domain ─────────────────────────────────────────
const SIZE_PRESETS: Record<string, { label: string; values: string[] }[]> = {
  clothing: [
    { label: 'حروف (عالمي)',    values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] },
    { label: 'أرقام (ملابس)',   values: ['34', '36', '38', '40', '42', '44', '46', '48', '50', '52'] },
    { label: 'أحذية',           values: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'] },
    { label: 'أطفال (سنوات)',   values: ['2Y', '4Y', '6Y', '8Y', '10Y', '12Y', '14Y', '16Y'] },
  ],
  retail: [
    { label: 'وزن',            values: ['100g', '250g', '500g', '750g', '1kg', '2kg', '5kg', '10kg', '25kg'] },
    { label: 'حجم سائل',       values: ['100ml', '250ml', '500ml', '750ml', '1L', '2L', '5L', '10L'] },
  ],
  pharmacy: [
    { label: 'جرعة (mg)',      values: ['2.5mg', '5mg', '10mg', '25mg', '50mg', '100mg', '200mg', '500mg', '1000mg'] },
    { label: 'حجم (ml)',       values: ['5ml', '10ml', '15ml', '30ml', '60ml', '100ml', '120ml', '150ml', '200ml'] },
    { label: 'عبوة',           values: ['10أقراص', '20قرص', '28قرص', '30قرص', '60قرص', '100قرص'] },
  ],
  wholesale: [
    { label: 'وزن',            values: ['1kg', '5kg', '10kg', '25kg', '50kg', '100kg', '200kg', '500kg', '1ton'] },
    { label: 'حجم',            values: ['1L', '5L', '10L', '20L', '25L', '50L', '100L', '200L'] },
  ],
  stationery: [
    { label: 'ورق (قياس)',    values: ['A3', 'A4', 'A5', 'A6', 'Legal', 'Letter', 'B4', 'B5'] },
    { label: 'عدد الأوراق',   values: ['50', '100', '200', '250', '500', '1000'] },
  ],
  tools: [
    { label: 'مقاس',           values: ['صغير', 'متوسط', 'كبير', 'إكستر لارج'] },
    { label: 'قياس (mm)',      values: ['6mm', '8mm', '10mm', '12mm', '14mm', '16mm', '19mm', '22mm', '25mm'] },
    { label: 'طول',            values: ['30cm', '50cm', '1m', '1.5m', '2m', '3m', '5m', '10m'] },
  ],
  other: [
    { label: 'مقاسات',         values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
    { label: 'أوزان',          values: ['250g', '500g', '1kg', '2kg', '5kg'] },
  ],
}
SIZE_PRESETS.dress_rental = SIZE_PRESETS.clothing

// ── Color presets (universal) ─────────────────────────────────────────────────
const COLOR_PRESETS = [
  { label: 'أسود',      hex: '#111827' },
  { label: 'أبيض',      hex: '#f9fafb' },
  { label: 'رمادي',    hex: '#6b7280' },
  { label: 'بني',      hex: '#92400e' },
  { label: 'بيج',      hex: '#d4b896' },
  { label: 'أحمر',     hex: '#ef4444' },
  { label: 'برتقالي', hex: '#f97316' },
  { label: 'أصفر',     hex: '#f59e0b' },
  { label: 'أخضر',     hex: '#10b981' },
  { label: 'أزرق',     hex: '#3b82f6' },
  { label: 'كحلي',     hex: '#1e3a5f' },
  { label: 'بنفسجي',  hex: '#8b5cf6' },
  { label: 'وردي',     hex: '#ec4899' },
  { label: 'ذهبي',     hex: '#d97706' },
  { label: 'فضي',      hex: '#94a3b8' },
  { label: 'زيتي',     hex: '#4d7c0f' },
  { label: 'فيروزي',  hex: '#06b6d4' },
  { label: 'بودري',    hex: '#fce7f3' },
]

const emptyProduct = {
  name: '', name_ar: '', sku: '', barcode: '',
  cost_price: '', sale_price: '', wholesale_price: '',
  min_stock_level: '0', tax_rate: '0',
  category_id: '', unit_id: '',
  type: 'product', track_inventory: true, is_active: true,
  description: '',
  expiry_date: '', batch_number: '', min_qty: '1',
  sizes: [] as string[],
  colors: [] as string[],
  showVariants: false,
}

// Chip toggle helper
function toggleItem(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
}

export function InventoryClient({ products: initialProducts, categories: propCategories, units: propUnits, warehouses, companyId, currency, features }: InventoryClientProps) {
  const [products, setProducts]     = useState(initialProducts)
  const [categories, setCategories] = useState(propCategories)
  const [units, setUnits]           = useState(propUnits)
  const [search, setSearch]         = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterLowStock, setFilterLowStock] = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [editingProduct, setEditingProduct] = useState<any | null>(null)
  const [form, setForm]             = useState<any>(emptyProduct)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [seedingCats, setSeedingCats]   = useState(false)
  const [seedingUnits, setSeedingUnits] = useState(false)
  const [activeSizeGroup, setActiveSizeGroup] = useState(0)

  const bt = features.businessType

  const getTotalStock = (product: any) => {
    if (!Array.isArray(product?.inventory)) return 0
    return product.inventory.reduce((s: number, i: any) => s + Number(i?.quantity || 0), 0)
  }

  const filtered = useMemo(() => products.filter(p => {
    const matchSearch = !search ||
      (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.name_ar && p.name_ar.includes(search)) ||
      (p.barcode && p.barcode.includes(search)) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
    const matchCategory = !filterCategory || p.category_id === filterCategory
    const stock = getTotalStock(p)
    const matchLow = !filterLowStock || (p.track_inventory && stock <= p.min_stock_level)
    return matchSearch && matchCategory && matchLow
  }), [products, search, filterCategory, filterLowStock])

  const lowStockCount = products.filter(p => p.track_inventory && getTotalStock(p) <= Number(p.min_stock_level || 0)).length

  const openNew = () => {
    setForm({ ...emptyProduct, sizes: [], colors: [] })
    setEditingProduct(null)
    setShowForm(true)
    setError('')
    setActiveSizeGroup(0)
  }

  const openEdit = (product: any) => {
    setForm({
      name: product.name, name_ar: product.name_ar || '',
      sku: product.sku || '', barcode: product.barcode || '',
      cost_price: product.cost_price, sale_price: product.sale_price,
      wholesale_price: product.wholesale_price || '',
      min_stock_level: product.min_stock_level,
      tax_rate: product.tax_rate,
      category_id: product.category_id || '',
      unit_id: product.unit_id || '',
      type: product.type, track_inventory: product.track_inventory,
      is_active: product.is_active, description: product.description || '',
      expiry_date: product.expiry_date || '',
      batch_number: product.batch_number || '',
      min_qty: product.min_qty || '1',
      sizes: product.sizes || [],
      colors: product.colors || [],
      showVariants: (product.sizes?.length || product.colors?.length) ? true : false,
    })
    setEditingProduct(product)
    setShowForm(true)
    setError('')
  }

  const seedCategories = async () => {
    setSeedingCats(true)
    try {
      await fetch('/api/inventory/categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed', businessType: bt }),
      })
      const res = await fetch('/api/inventory/categories')
      if (res.ok) setCategories(await res.json())
    } finally { setSeedingCats(false) }
  }

  const seedUnits = async () => {
    setSeedingUnits(true)
    try {
      await fetch('/api/inventory/units', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed', businessType: bt }),
      })
      const res = await fetch('/api/inventory/units')
      if (res.ok) setUnits(await res.json())
    } finally { setSeedingUnits(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload: any = {
        company_id: companyId,
        name: form.name, name_ar: form.name_ar || null,
        sku: form.sku || null, barcode: form.barcode || null,
        cost_price: parseFloat(form.cost_price) || 0,
        sale_price: parseFloat(form.sale_price) || 0,
        wholesale_price: parseFloat(form.wholesale_price) || 0,
        min_stock_level: parseFloat(form.min_stock_level) || 0,
        tax_rate: parseFloat(form.tax_rate) || 0,
        category_id: form.category_id || null,
        unit_id: form.unit_id || null,
        type: form.type, track_inventory: form.track_inventory,
        is_active: form.is_active, description: form.description || null,
        expiry_date: features.hasExpiry && form.expiry_date ? form.expiry_date : null,
        batch_number: features.hasBatch && form.batch_number ? form.batch_number : null,
        min_qty: features.hasMinQty ? parseInt(form.min_qty) || 1 : 1,
      }
      // Only include if non-empty (requires DB columns to exist)
      if (form.sizes?.length) payload.sizes = form.sizes
      if (form.colors?.length) payload.colors = form.colors

      const url    = editingProduct ? `/api/inventory/products/${editingProduct.id}` : '/api/inventory/products'
      const method = editingProduct ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data   = await res.json()
      if (!res.ok) throw new Error(data.error || 'حدث خطأ')
      if (editingProduct) {
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...data.product } : p))
      } else {
        setProducts(prev => [data.product, ...prev])
      }
      setShowForm(false)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا المنتج؟')) return
    try {
      const res = await fetch(`/api/inventory/products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('فشل الحذف')
      setProducts(prev => prev.filter(p => p.id !== id))
    } catch (e: any) { alert(e.message) }
  }

  const sizeGroups = SIZE_PRESETS[bt] || SIZE_PRESETS.other

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">المنتجات والمخزون</h1>
          <p className="text-sm text-muted-foreground">
            {products.length} منتج
            {lowStockCount > 0 && <> · <span className="text-red-500">{lowStockCount} منخفض المخزون</span></>}
          </p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />منتج جديد
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي المنتجات',  value: products.length, color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' },
          { label: 'منتجات نشطة',      value: products.filter(p => p.is_active).length, color: 'bg-green-50 text-green-600 dark:bg-green-900/20' },
          { label: 'منخفض المخزون',    value: lowStockCount, color: 'bg-red-50 text-red-600 dark:bg-red-900/20' },
          { label: 'قيمة المخزون',      value: formatCurrency(products.reduce((s, p) => s + getTotalStock(p) * Number(p.cost_price || 0), 0), currency), color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20', isText: true },
        ].map((stat, i) => (
          <div key={i} className={cn('rounded-xl p-3', stat.color)}>
            <p className="text-xs opacity-70">{stat.label}</p>
            <p className={cn('text-lg font-bold mt-0.5', (stat as any).isText && 'text-sm')}>{stat.value}</p>
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
        <button onClick={() => setFilterLowStock(!filterLowStock)} className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-all', filterLowStock ? 'bg-red-500 text-white border-red-500' : 'border-input bg-background hover:bg-accent')}>
          <AlertTriangle className="w-3.5 h-3.5" />منخفض المخزون
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
                {features.hasExpiry && <th className="text-right px-4 py-3 font-medium text-muted-foreground">الانتهاء</th>}
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
              ) : filtered.map(product => {
                const stock = getTotalStock(product)
                const isLow = product.track_inventory && stock <= product.min_stock_level
                return (
                  <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{product.name_ar || product.name}</p>
                        {(product.sku || product.barcode) && <p className="text-xs text-muted-foreground">{product.sku || product.barcode}</p>}
                        {/* Show sizes/colors badges */}
                        {(product.sizes?.length > 0 || product.colors?.length > 0) && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {product.sizes?.slice(0, 3).map((s: string) => (
                              <span key={s} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{s}</span>
                            ))}
                            {product.sizes?.length > 3 && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">+{product.sizes.length - 3}</span>}
                            {product.colors?.map((c: string) => (
                              <span key={c} className="text-[10px] bg-accent text-muted-foreground px-1.5 py-0.5 rounded-full">{c}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {product.product_categories && (
                        <span className="text-xs bg-accent px-2 py-0.5 rounded-full">
                          {product.product_categories.name_ar || product.product_categories.name}
                        </span>
                      )}
                    </td>
                    {features.hasExpiry && (
                      <td className="px-4 py-3 text-xs">
                        {product.expiry_date ? (
                          <span className={cn('font-medium',
                            new Date(product.expiry_date) < new Date() ? 'text-red-500' :
                            new Date(product.expiry_date) < new Date(Date.now() + 30*24*60*60*1000) ? 'text-amber-500' :
                            'text-muted-foreground'
                          )}>{new Date(product.expiry_date).toLocaleDateString('ar-SA')}</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-3 text-muted-foreground">{formatCurrency(product.cost_price, currency)}</td>
                    <td className="px-4 py-3 font-medium text-primary">{formatCurrency(product.sale_price, currency)}</td>
                    <td className="px-4 py-3">
                      {product.track_inventory ? (
                        <span className={cn('font-medium', isLow ? 'text-red-500' : 'text-foreground')}>
                          {isLow && <AlertTriangle className="w-3.5 h-3.5 inline ml-1" />}{stock}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">غير محدود</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', product.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 'bg-red-100 text-red-700 dark:bg-red-900/30')}>
                        {product.is_active ? 'نشط' : 'موقوف'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(product)} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(product.id)} className="p-1.5 hover:bg-red-100 rounded-lg text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Product Form Modal ────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-card z-10">
              <h2 className="font-bold text-lg">{editingProduct ? 'تعديل المنتج' : 'منتج جديد'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-accent rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5">

              {/* ── Basic Info ─────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">الاسم بالعربي *</label>
                  <input type="text" value={form.name_ar} onChange={e => setForm((f: any) => ({ ...f, name_ar: e.target.value }))} required placeholder="اسم المنتج" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الاسم بالإنجليزي</label>
                  <input type="text" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Product name" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" dir="ltr" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الباركود</label>
                  <input type="text" value={form.barcode} onChange={e => setForm((f: any) => ({ ...f, barcode: e.target.value }))} placeholder="123456789" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" dir="ltr" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">رمز SKU</label>
                  <input type="text" value={form.sku} onChange={e => setForm((f: any) => ({ ...f, sku: e.target.value }))} placeholder="SKU-001" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" dir="ltr" />
                </div>
              </div>

              {/* ── Pricing ───────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">سعر التكلفة *</label>
                  <input type="number" step="0.01" value={form.cost_price} onChange={e => setForm((f: any) => ({ ...f, cost_price: e.target.value }))} required placeholder="0.00" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">سعر البيع *</label>
                  <input type="number" step="0.01" value={form.sale_price} onChange={e => setForm((f: any) => ({ ...f, sale_price: e.target.value }))} required placeholder="0.00" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                {features.hasWholesalePrice && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">سعر الجملة</label>
                    <input type="number" step="0.01" value={form.wholesale_price} onChange={e => setForm((f: any) => ({ ...f, wholesale_price: e.target.value }))} placeholder="0.00" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium mb-1 block">نسبة الضريبة %</label>
                  <input type="number" step="0.01" value={form.tax_rate} onChange={e => setForm((f: any) => ({ ...f, tax_rate: e.target.value }))} placeholder="0" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الحد الأدنى للمخزون</label>
                  <input type="number" value={form.min_stock_level} onChange={e => setForm((f: any) => ({ ...f, min_stock_level: e.target.value }))} placeholder="0" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>

              {/* ── Category & Unit ───────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium flex items-center gap-1"><Tag className="w-3.5 h-3.5" />الفئة</label>
                    {categories.length === 0 && (
                      <button type="button" onClick={seedCategories} disabled={seedingCats} className="flex items-center gap-1 text-xs text-primary hover:underline">
                        {seedingCats ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        إضافة افتراضية
                      </button>
                    )}
                  </div>
                  <select value={form.category_id} onChange={e => setForm((f: any) => ({ ...f, category_id: e.target.value }))} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
                    <option value="">بدون فئة</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar || c.name}</option>)}
                  </select>
                  {categories.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">لا توجد فئات — اضغط "إضافة افتراضية" لإضافة فئات {features.label}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium flex items-center gap-1"><Ruler className="w-3.5 h-3.5" />وحدة القياس</label>
                    {units.length === 0 && (
                      <button type="button" onClick={seedUnits} disabled={seedingUnits} className="flex items-center gap-1 text-xs text-primary hover:underline">
                        {seedingUnits ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        إضافة افتراضية
                      </button>
                    )}
                  </div>
                  <select value={form.unit_id} onChange={e => setForm((f: any) => ({ ...f, unit_id: e.target.value }))} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
                    <option value="">اختر الوحدة</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name_ar || u.name}</option>)}
                  </select>
                  {units.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">لا توجد وحدات — اضغط "إضافة افتراضية"</p>
                  )}
                </div>
              </div>

              {/* ── Domain-specific fields ────────────────────────────────── */}
              {features.hasExpiry && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">تاريخ الانتهاء</label>
                    <input type="date" value={form.expiry_date} onChange={e => setForm((f: any) => ({ ...f, expiry_date: e.target.value }))} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  {features.hasBatch && (
                    <div>
                      <label className="text-sm font-medium mb-1 block">رقم الدُفعة</label>
                      <input type="text" value={form.batch_number} onChange={e => setForm((f: any) => ({ ...f, batch_number: e.target.value }))} placeholder="BATCH-001" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" dir="ltr" />
                    </div>
                  )}
                </div>
              )}
              {features.hasMinQty && (
                <div>
                  <label className="text-sm font-medium mb-1 block">الحد الأدنى للطلب</label>
                  <input type="number" min="1" value={form.min_qty} onChange={e => setForm((f: any) => ({ ...f, min_qty: e.target.value }))} placeholder="1" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              )}

              {/* ── Sizes & Colors ────────────────────────────────────────── */}
              <div className="border border-input rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setForm((f: any) => ({ ...f, showVariants: !f.showVariants }))}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/40 transition-colors text-sm font-medium"
                >
                  <span className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-primary" />
                    المقاسات والألوان
                    {(form.sizes?.length > 0 || form.colors?.length > 0) && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                        {form.sizes?.length + form.colors?.length} مختار
                      </span>
                    )}
                  </span>
                  {form.showVariants ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {form.showVariants && (
                  <div className="p-4 space-y-4 border-t border-input bg-muted/10">

                    {/* Sizes */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Ruler className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-sm font-medium">المقاسات</p>
                      </div>
                      {/* Size group tabs */}
                      <div className="flex gap-1.5 flex-wrap mb-2">
                        {sizeGroups.map((group, idx) => (
                          <button
                            key={idx} type="button"
                            onClick={() => setActiveSizeGroup(idx)}
                            className={cn('text-xs px-2.5 py-1 rounded-lg border transition-all', activeSizeGroup === idx ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-accent')}
                          >
                            {group.label}
                          </button>
                        ))}
                      </div>
                      {/* Size chips */}
                      <div className="flex flex-wrap gap-1.5">
                        {sizeGroups[activeSizeGroup]?.values.map(size => (
                          <button
                            key={size} type="button"
                            onClick={() => setForm((f: any) => ({ ...f, sizes: toggleItem(f.sizes, size) }))}
                            className={cn(
                              'text-xs px-2.5 py-1 rounded-lg border transition-all font-medium',
                              form.sizes?.includes(size)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-input hover:border-primary/40 hover:bg-primary/5'
                            )}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                      {/* Selected sizes display */}
                      {form.sizes?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {form.sizes.map((s: string) => (
                            <span key={s} className="flex items-center gap-1 text-xs bg-primary/10 text-primary pl-1 pr-2 py-0.5 rounded-full">
                              {s}
                              <button type="button" onClick={() => setForm((f: any) => ({ ...f, sizes: f.sizes.filter((x: string) => x !== s) }))} className="hover:bg-primary/20 rounded-full w-3.5 h-3.5 flex items-center justify-center">
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Colors */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-sm font-medium">الألوان</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {COLOR_PRESETS.map(color => {
                          const isSelected = form.colors?.includes(color.label)
                          return (
                            <button
                              key={color.label} type="button"
                              title={color.label}
                              onClick={() => setForm((f: any) => ({ ...f, colors: toggleItem(f.colors, color.label) }))}
                              className={cn(
                                'w-7 h-7 rounded-full border-2 transition-all relative',
                                isSelected ? 'border-primary scale-110 shadow-md' : 'border-transparent hover:border-gray-400',
                                color.hex === '#f9fafb' && 'border-gray-200'
                              )}
                              style={{ backgroundColor: color.hex }}
                            >
                              {isSelected && (
                                <span className="absolute inset-0 flex items-center justify-center">
                                  <Check className={cn('w-3 h-3', color.hex === '#f9fafb' ? 'text-gray-800' : 'text-white')} />
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                      {/* Selected colors labels */}
                      {form.colors?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {form.colors.map((c: string) => (
                            <span key={c} className="flex items-center gap-1 text-xs bg-accent text-foreground pl-1 pr-2 py-0.5 rounded-full border">
                              {c}
                              <button type="button" onClick={() => setForm((f: any) => ({ ...f, colors: f.colors.filter((x: string) => x !== c) }))} className="hover:bg-muted rounded-full w-3.5 h-3.5 flex items-center justify-center">
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Toggles ───────────────────────────────────────────────── */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.track_inventory} onChange={e => setForm((f: any) => ({ ...f, track_inventory: e.target.checked }))} className="w-4 h-4 accent-primary" />
                  تتبع المخزون
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm((f: any) => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 accent-primary" />
                  نشط
                </label>
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
