'use client'

import { useState } from 'react'
import { EnterpriseDataGrid } from '@/components/enterprise/DataGrid/DataGrid'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { Package, Search, Filter, Plus, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

const MOCK_PRODUCTS = Array.from({ length: 100 }, (_, i) => ({
  id: String(i + 1),
  sku: `PRD-${String(i + 1).padStart(4, '0')}`,
  name: ['لابتوب HP ProBook', 'شاشة Dell 27"', 'ماوس لاسلكي', 'لوحة مفاتيح', 'طابعة HP'][i % 5],
  category: ['إلكترونيات', 'أجهزة كمبيوتر', 'ملحقات', 'ملحقات', 'أجهزة مكتبية'][i % 5],
  warehouse: ['المستودع الرئيسي', 'مستودع الرياض', 'مستودع جدة'][i % 3],
  quantity: Math.floor(Math.random() * 500),
  minQuantity: 20,
  unitPrice: Math.random() * 5000 + 50,
  totalValue: 0,
  status: ['متوفر', 'منخفض', 'ناقص'][i % 3],
})).map(p => ({ ...p, totalValue: p.quantity * p.unitPrice }))

const COLUMNS = [
  { id: 'sku', title: 'رمز المنتج', dataType: 'text' as const, width: 130, sortable: true, filterable: true },
  { id: 'name', title: 'اسم المنتج', dataType: 'text' as const, minWidth: 200, sortable: true, filterable: true },
  { id: 'category', title: 'التصنيف', dataType: 'text' as const, width: 130, sortable: true, filterable: true },
  { id: 'warehouse', title: 'المستودع', dataType: 'text' as const, width: 150, sortable: true, filterable: true },
  { id: 'quantity', title: 'الكمية', dataType: 'number' as const, width: 100, sortable: true },
  { id: 'unitPrice', title: 'سعر الوحدة', dataType: 'currency' as const, width: 140, sortable: true, align: 'left' as const },
  { id: 'totalValue', title: 'القيمة الإجمالية', dataType: 'currency' as const, width: 160, sortable: true, align: 'left' as const },
  {
    id: 'status', title: 'الحالة', dataType: 'badge' as const, width: 110, sortable: true, filterable: true,
    render: (value: string) => {
      const styles: Record<string, string> = {
        'متوفر': 'bg-success/10 text-success',
        'منخفض': 'bg-warning/10 text-warning',
        'ناقص': 'bg-destructive/10 text-destructive',
      }
      return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[value] || ''}`}>{value}</span>
    },
  },
]

export function InventoryControlCenter() {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  const totalItems = MOCK_PRODUCTS.length
  const totalValue = MOCK_PRODUCTS.reduce((s, p) => s + p.totalValue, 0)
  const lowStock = MOCK_PRODUCTS.filter(p => p.status === 'منخفض' || p.status === 'ناقص').length

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b bg-card">
        <EnterpriseBreadcrumbs items={[{ label: 'المخزون', icon: Package }, { label: 'مركز التحكم بالمخزون' }]} />
        <div className="flex items-center justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold">مركز التحكم بالمخزون</h1>
            <p className="text-sm text-muted-foreground">إدارة المنتجات والمستودعات ورصد المستويات</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm"><Filter className="h-4 w-4 ml-1" /> فلتر</Button>
            <Button size="sm"><Plus className="h-4 w-4 ml-1" /> إضافة منتج</Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="finance-card !p-4">
            <div className="text-xs text-muted-foreground">إجمالي المنتجات</div>
            <div className="text-xl font-bold">{totalItems}</div>
          </div>
          <div className="finance-card !p-4">
            <div className="text-xs text-muted-foreground">قيمة المخزون</div>
            <div className="text-xl font-bold">{totalValue.toLocaleString('ar-SA', { maximumFractionDigits: 0 })} ر.س</div>
          </div>
          <div className="finance-card !p-4 border-warning/20">
            <div className="text-xs text-muted-foreground">منتجات منخفضة</div>
            <div className="text-xl font-bold text-warning">{lowStock} <span className="text-xs font-normal text-muted-foreground">تحتاج إعادة طلب</span></div>
          </div>
          <div className="finance-card !p-4">
            <div className="text-xs text-muted-foreground">المستودعات</div>
            <div className="text-xl font-bold">3</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <EnterpriseDataGrid
          columns={COLUMNS}
          data={MOCK_PRODUCTS}
          selectable
          selectedRows={selectedRows}
          onSelectionChange={setSelectedRows}
          groupable
          groupBy="category"
          pagination={{ page: 1, pageSize: 20, total: MOCK_PRODUCTS.length }}
          stickyHeader
          bulkActions={
            selectedRows.size > 0 ? (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline"><TrendingUp className="h-4 w-4 ml-1" /> إضافة مخزون</Button>
                <Button size="sm" variant="outline"><TrendingDown className="h-4 w-4 ml-1" /> تخفيض مخزون</Button>
                <Button size="sm" variant="outline"><AlertTriangle className="h-4 w-4 ml-1" /> جرد</Button>
              </div>
            ) : undefined
          }
        />
      </div>
    </div>
  )
}
