'use client'

import { useState, useMemo } from 'react'
import { Search, ArrowUpDown, TrendingUp, TrendingDown, Package } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface MovementsClientProps {
  movements: any[]
  products: any[]
  warehouses: any[]
  companyId: string
  currency: string
}

const TYPE_LABELS: Record<string, { label: string; color: string; dir: 'in' | 'out' }> = {
  purchase: { label: 'شراء', color: 'text-green-600 bg-green-50 dark:bg-green-900/20', dir: 'in' },
  sale: { label: 'بيع', color: 'text-red-600 bg-red-50 dark:bg-red-900/20', dir: 'out' },
  return_sale: { label: 'مرتجع بيع', color: 'text-green-600 bg-green-50 dark:bg-green-900/20', dir: 'in' },
  return_purchase: { label: 'مرتجع شراء', color: 'text-red-600 bg-red-50 dark:bg-red-900/20', dir: 'out' },
  adjustment: { label: 'تسوية', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20', dir: 'in' },
  transfer_in: { label: 'تحويل وارد', color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20', dir: 'in' },
  transfer_out: { label: 'تحويل صادر', color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20', dir: 'out' },
  opening: { label: 'رصيد افتتاحي', color: 'text-gray-600 bg-gray-50 dark:bg-gray-900/20', dir: 'in' },
}

export function MovementsClient({ movements, products, warehouses, companyId, currency }: MovementsClientProps) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterProduct, setFilterProduct] = useState('')
  const [filterWarehouse, setFilterWarehouse] = useState('')

  const filtered = useMemo(() => movements.filter(m => {
    const productName = (m.products?.name_ar || m.products?.name || '').toLowerCase()
    const matchSearch = !search || productName.includes(search.toLowerCase())
    const matchType = !filterType || m.type === filterType
    const matchProduct = !filterProduct || m.product_id === filterProduct
    const matchWarehouse = !filterWarehouse || m.warehouse_id === filterWarehouse
    return matchSearch && matchType && matchProduct && matchWarehouse
  }), [movements, search, filterType, filterProduct, filterWarehouse])

  const totalIn = filtered.filter(m => TYPE_LABELS[m.type]?.dir === 'in').reduce((s, m) => s + Math.abs(m.quantity), 0)
  const totalOut = filtered.filter(m => TYPE_LABELS[m.type]?.dir === 'out').reduce((s, m) => s + Math.abs(m.quantity), 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">حركة المخزون</h1>
        <p className="text-sm text-muted-foreground">{movements.length} حركة</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <p className="text-xs text-green-600">إجمالي الوارد</p>
          </div>
          <p className="text-xl font-bold text-green-700">{totalIn.toLocaleString('ar')}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <p className="text-xs text-red-600">إجمالي الصادر</p>
          </div>
          <p className="text-xl font-bold text-red-700">{totalOut.toLocaleString('ar')}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpDown className="w-4 h-4 text-blue-600" />
            <p className="text-xs text-blue-600">عدد الحركات</p>
          </div>
          <p className="text-xl font-bold text-blue-700">{filtered.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالمنتج..." className="w-full border border-input rounded-lg px-3 py-2 pr-9 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
          <option value="">كل الأنواع</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)} className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
          <option value="">كل المنتجات</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name_ar || p.name}</option>)}
        </select>
        <select value={filterWarehouse} onChange={e => setFilterWarehouse(e.target.value)} className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none">
          <option value="">كل المستودعات</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_ar || w.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">المنتج</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">النوع</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">المستودع</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الكمية</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">قبل</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">بعد</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">لا توجد حركات مخزون</td></tr>
              ) : (
                filtered.map(m => {
                  const typeInfo = TYPE_LABELS[m.type]
                  const isIn = typeInfo?.dir === 'in'
                  return (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">{m.products?.name_ar || m.products?.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', typeInfo?.color)}>
                          {typeInfo?.label || m.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm">
                        {m.warehouses?.name_ar || m.warehouses?.name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('font-bold', isIn ? 'text-green-600' : 'text-red-600')}>
                          {isIn ? '+' : '-'}{Math.abs(m.quantity)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.quantity_before}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.quantity_after}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(m.created_at)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
