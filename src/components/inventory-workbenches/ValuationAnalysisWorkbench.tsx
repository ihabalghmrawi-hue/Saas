'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Package, Box, Warehouse, Truck, BarChart3, Search,
  Filter, ArrowUpDown, Plus, Download, CheckCircle2, XCircle,
  AlertTriangle, Eye, Clock, User, FileText, ArrowLeftRight,
  Sparkles, Shield, Activity, TrendingUp, TrendingDown, MapPin,
  Hash, Scale, QrCode, ChevronLeft, ChevronRight,
  Circle, CircleDot, Percent, DollarSign, PieChart,
  LineChart, TrendingUp as TrendingUpIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { WorkbenchShell } from '@/components/workbench/WorkbenchShell'
import { RealtimeValidationBar } from '@/components/workbench/RealtimeValidationBar'
import { AIAssistancePanel } from '@/components/workbench/AIAssistancePanel'
import { AuditOverlay } from '@/components/workbench/AuditOverlay'
import { OperationalCommenting } from '@/components/workbench/OperationalCommenting'
import { CrossEntityInspector } from '@/components/workbench/CrossEntityInspector'
import { WorkbenchMetricCard } from '@/components/workbench/WorkbenchMetricCard'
import type { InventoryItem, ValidationMessage, AIInsight, WorkbenchMetric, InspectorTab } from '@/lib/workbench/types'

const employeeNames = [
  'أحمد محمد', 'سارة خالد', 'فهد العتيبي', 'نورة عبدالله',
  'ماجد الحربي', 'ريم الشهري',
]

const itemNames = [
  'مواد خام أ', 'مواد خام ب', 'عبوات كرتون', 'أكياس بلاستيك',
  'قطع غيار م أ', 'زيوت تشحيم', 'مذيبات كيميائية', 'فلاتر تهوية',
  'أحزمة نقل', 'صمامات تحكم', 'مواسير صلب', 'كوابل كهربائية',
  'مفاتيح كهربائية', 'محولات طاقة', 'مراوح تهوية', 'أجهزة قياس',
  'دهانات صناعية', 'مواد تنظيف', 'قفازات واقية', 'أحذية سلامة',
  'خوذ أمان', 'نظارات واقية', 'معدات لحام', 'أدوات يدوية', 'معدات قياس',
]

const categories = [
  'مواد خام', 'تعبئة وتغليف', 'قطع غيار', 'كيميائيات',
  'كهربائيات', 'معدات سلامة', 'أدوات قياس', 'معدات صناعية',
]

const valuationClasses = ['FIFO', 'المتوسط المرجح', 'التكلفة المعيارية'] as const

interface CostHistoryPoint {
  date: number
  cost: number
}

interface RevaluationEntry {
  id: string
  date: number
  oldCost: number
  newCost: number
  reason: string
  initiatedBy: string
}

interface ValuationItem {
  id: string
  sku: string
  name: string
  category: string
  valuationClass: string
  currentCost: number
  standardCost: number
  quantity: number
  totalValue: number
  reorderPoint: number
  costHistory: CostHistoryPoint[]
  revaluationHistory: RevaluationEntry[]
  pendingRevaluation: boolean
  marginPercentage: number
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstock'
  warehouse: string
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomDate(daysAgo: number): number {
  return randomInt(Date.now() - daysAgo * 86400000, Date.now())
}

function generateCostHistory(): CostHistoryPoint[] {
  return Array.from({ length: 12 }, (_, i) => ({
    date: Date.now() - (11 - i) * 30 * 86400000,
    cost: randomFloat(20, 400),
  }))
}

function generateValuationItems(count: number): ValuationItem[] {
  return Array.from({ length: count }, (_, idx) => {
    const currentCost = randomFloat(20, 400)
    const standardCost = randomFloat(20, 400)
    const quantity = randomInt(0, 500)
    const valuationClass = randomChoice([...valuationClasses])
    const marginDiff = ((currentCost - standardCost) / standardCost) * 100
    const revaluationCount = randomInt(0, 4)

    const revaluationHistory: RevaluationEntry[] = Array.from({ length: revaluationCount }, () => ({
      id: generateId('rev'),
      date: randomDate(180),
      oldCost: randomFloat(15, 350),
      newCost: randomFloat(20, 400),
      reason: randomChoice(['تعديل تكلفة', 'تسوية مخزون', 'إعادة تقييم دوري', 'تحديث سعر الشراء']),
      initiatedBy: randomChoice(employeeNames),
    }))

    let status: ValuationItem['status']
    if (quantity === 0) status = 'out_of_stock'
    else if (quantity <= 20) status = 'low_stock'
    else if (quantity > 300) status = 'overstock'
    else status = 'in_stock'

    return {
      id: generateId('val'),
      sku: `SKU-${String(idx + 1).padStart(4, '0')}`,
      name: itemNames[idx % itemNames.length],
      category: categories[idx % categories.length],
      valuationClass,
      currentCost,
      standardCost,
      quantity,
      totalValue: parseFloat((quantity * currentCost).toFixed(2)),
      reorderPoint: randomInt(10, 50),
      costHistory: generateCostHistory(),
      revaluationHistory,
      pendingRevaluation: Math.random() > 0.8,
      marginPercentage: parseFloat(marginDiff.toFixed(1)),
      status,
      warehouse: randomChoice(['المستودع الرئيسي', 'مستودع المواد الخام', 'مستودع المواد الكيميائية', 'مستودع التعبئة', 'مستودع الصيانة']),
    }
  })
}

const statusColors: Record<string, string> = {
  in_stock: 'text-green-600 bg-green-50',
  low_stock: 'text-amber-600 bg-amber-50',
  out_of_stock: 'text-red-600 bg-red-50',
  overstock: 'text-blue-600 bg-blue-50',
}

const statusLabels: Record<string, string> = {
  in_stock: 'متوفر',
  low_stock: 'منخفض',
  out_of_stock: 'نفذ',
  overstock: 'فائض',
}

const classColors: Record<string, string> = {
  FIFO: 'text-blue-600 bg-blue-50 border-blue-200',
  'المتوسط المرجح': 'text-purple-600 bg-purple-50 border-purple-200',
  'التكلفة المعيارية': 'text-green-600 bg-green-50 border-green-200',
}

function formatDate(date: number): string {
  return new Date(date).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function formatCurrency(value: number): string {
  return value.toLocaleString('ar-SA') + ' ريال'
}

export function ValuationAnalysisWorkbench() {
  const [items] = useState<ValuationItem[]>(() => generateValuationItems(25))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [classFilter, setClassFilter] = useState<string>('الكل')
  const [searchQuery, setSearchQuery] = useState('')
  const [auditOpen, setAuditOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorTab, setInspectorTab] = useState('info')

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  )

  const groupedByClass = useMemo(() => {
    const groups: Record<string, ValuationItem[]> = {}
    for (const item of items) {
      const cls = item.valuationClass
      if (!groups[cls]) groups[cls] = []
      groups[cls].push(item)
    }
    return groups
  }, [items])

  const filteredItems = useMemo(() => {
    let result = items
    if (classFilter !== 'الكل') {
      result = result.filter((i) => i.valuationClass === classFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q),
      )
    }
    return result
  }, [items, classFilter, searchQuery])

  const metrics: WorkbenchMetric[] = useMemo(() => {
    const totalValue = items.reduce((s, i) => s + i.totalValue, 0)
    const avgCost = items.length > 0
      ? items.reduce((s, i) => s + i.currentCost, 0) / items.length
      : 0
    const varianceCount = items.filter((i) => Math.abs(i.marginPercentage) > 10).length
    return [
      { id: 'total', label: 'إجمالي قيمة المخزون', value: formatCurrency(totalValue), icon: 'Package', severity: 'info', change: 8, trend: 'up' },
      { id: 'avg', label: 'متوسط التكلفة', value: avgCost.toLocaleString('ar-SA') + ' ريال', icon: 'Package', severity: 'info' },
      { id: 'count', label: 'عدد الأصناف', value: items.length, icon: 'Package', severity: 'info' },
      { id: 'variance', label: 'قيمة الفروقات', value: varianceCount, icon: 'Package', severity: varianceCount > 5 ? 'warning' : 'info' },
    ]
  }, [items])

  const allValidationMessages: ValidationMessage[] = useMemo(() => {
    const msgs: ValidationMessage[] = []
    for (const item of items) {
      if (item.currentCost <= 0) {
        msgs.push({ id: generateId('msg'), type: 'error', message: `${item.name}: التكلفة الحالية صفر أو سالبة`, field: 'currentCost' })
      }
      if (Math.abs(item.marginPercentage) > 20) {
        msgs.push({
          id: generateId('msg'), type: 'warning',
          message: `${item.name}: فرق كبير بين التكلفة الحالية والمعيارية (${item.marginPercentage}%)`,
          field: 'margin',
        })
      }
      if (item.totalValue < 0) {
        msgs.push({ id: generateId('msg'), type: 'error', message: `${item.name}: قيمة مخزون سالبة`, field: 'totalValue' })
      }
    }
    return msgs.slice(0, 10)
  }, [items])

  const inspectorTabs: InspectorTab[] = [
    { id: 'info', label: 'تحليل التكلفة', icon: 'info' },
    { id: 'margin', label: 'تحليل الهامش', icon: 'activity' },
    { id: 'documents', label: 'المستندات', icon: 'file' },
  ]

  const handleSelect = (id: string) => {
    setSelectedId(id === selectedId ? null : id)
  }

  const maxCost = useMemo(() => {
    if (!selected) return 1
    return Math.max(...selected.costHistory.map((c) => c.cost), selected.currentCost, selected.standardCost)
  }, [selected])

  return (
    <WorkbenchShell
      title="منصة تحليل تقييم المخزون"
      breadcrumbs={[
        { label: 'المخزون' },
        { label: 'تحليل تقييم المخزون' },
      ]}
      metrics={metrics}
      sidebarWidth={420}
      sidebar={
        <div className="flex flex-col h-full">
          <div className="p-3 border-b space-y-3">
            <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {['الكل', ...valuationClasses].map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setClassFilter(cls)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors',
                    classFilter === cls
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {cls}
                  {cls !== 'الكل' && (
                    <span className="mr-1 text-[10px] opacity-70">
                      ({groupedByClass[cls]?.length ?? 0})
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالصنف أو الكود..."
                className="flex h-9 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y">
            {filteredItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">لا توجد عناصر مطابقة</p>
              </div>
            )}
            {filteredItems.map((item) => {
              const isSelected = item.id === selectedId
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={cn(
                    'w-full text-right p-3 transition-colors hover:bg-muted/50',
                    isSelected && 'bg-primary/5 border-r-2 border-primary',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('p-2 rounded-lg shrink-0', classColors[item.valuationClass])}>
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', classColors[item.valuationClass])}>
                          {item.valuationClass}
                        </span>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded', statusColors[item.status])}>
                          {statusLabels[item.status]}
                        </span>
                      </div>
                      <p className="text-sm font-semibold truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.sku} - {item.category}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span dir="ltr">{item.quantity.toLocaleString('ar-SA')} وحدة</span>
                        <span>|</span>
                        <span>{item.currentCost.toLocaleString('ar-SA')} ريال/وحدة</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs">
                        <span className="text-muted-foreground">القيمة:</span>
                        <span className="font-medium">{item.totalValue.toLocaleString('ar-SA')} ريال</span>
                        {Math.abs(item.marginPercentage) > 5 && (
                          <span className={cn(
                            'flex items-center gap-0.5 text-[10px]',
                            item.marginPercentage > 0 ? 'text-green-600' : 'text-red-600',
                          )}>
                            {item.marginPercentage > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {item.marginPercentage > 0 ? '+' : ''}{item.marginPercentage}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="p-3 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filteredItems.length} من {items.length} صنف
            </span>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
              <Download className="h-3.5 w-3.5" />
              تصدير
            </Button>
          </div>
        </div>
      }
      actions={[
        { id: 'reevaluate', label: 'إعادة تقييم', type: 'primary', handler: () => {} },
        { id: 'export', label: 'تصدير تقرير', type: 'secondary', handler: () => {} },
        { id: 'audit', label: 'سجل التدقيق', type: 'ghost', handler: () => setAuditOpen(!auditOpen) },
        { id: 'ai', label: 'تحليل ذكي', type: 'ghost', handler: () => setAiOpen(!aiOpen) },
      ]}
      inspectorTabs={inspectorTabs}
      inspectorOpen={inspectorOpen}
      onInspectorToggle={setInspectorOpen}
      inspectorTab={inspectorTab}
      onInspectorTabChange={setInspectorTab}
      inspectorContent={
        <>
          {selected ? (
            <>
              {inspectorTab === 'info' && (
                <div className="space-y-4">
                  <div className="rounded-xl border bg-card p-4">
                    <h4 className="text-sm font-semibold mb-3">تحليل التكلفة</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">التكلفة الحالية</span>
                        <span className="text-sm font-bold">{selected.currentCost.toLocaleString('ar-SA')} ريال</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">التكلفة المعيارية</span>
                        <span className="text-sm font-bold">{selected.standardCost.toLocaleString('ar-SA')} ريال</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">الفرق</span>
                        <span className={cn(
                          'text-sm font-bold',
                          (selected.currentCost - selected.standardCost) > 0 ? 'text-green-600' : 'text-red-600',
                        )}>
                          {(selected.currentCost - selected.standardCost) > 0 ? '+' : ''}
                          {(selected.currentCost - selected.standardCost).toLocaleString('ar-SA')} ريال
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-4">
                    <h4 className="text-sm font-semibold mb-3">الكمية × التكلفة</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">الكمية</span>
                        <span className="font-medium" dir="ltr">{selected.quantity.toLocaleString('ar-SA')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">القيمة الدفترية</span>
                        <span className="font-medium">{selected.totalValue.toLocaleString('ar-SA')} ريال</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">طريقة التقييم</span>
                        <span className={cn('text-xs font-bold px-2 py-0.5 rounded', classColors[selected.valuationClass])}>
                          {selected.valuationClass}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">المستودع</span>
                        <span className="text-sm font-medium">{selected.warehouse}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {inspectorTab === 'margin' && (
                <div className="space-y-4">
                  <div className="rounded-xl border bg-card p-4">
                    <h4 className="text-sm font-semibold mb-3">تحليل الهامش</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">هامش الفرق</span>
                        <span className={cn(
                          'text-sm font-bold',
                          selected.marginPercentage > 0 ? 'text-green-600' : 'text-red-600',
                        )}>
                          {selected.marginPercentage > 0 ? '+' : ''}{selected.marginPercentage}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">أصناف بطيئة الحركة</span>
                        <span className="text-sm font-medium">{selected.quantity > 200 ? 'نعم' : 'لا'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">إعادة تقييم معلقة</span>
                        <span className={cn('text-sm font-medium', selected.pendingRevaluation ? 'text-amber-600' : 'text-green-600')}>
                          {selected.pendingRevaluation ? 'نعم' : 'لا'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selected.revaluationHistory.length > 0 && (
                    <div className="rounded-xl border bg-card p-4">
                      <h4 className="text-sm font-semibold mb-3">سجل إعادة التقييم</h4>
                      <div className="space-y-3">
                        {selected.revaluationHistory.map((rev) => (
                          <div key={rev.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                            <div className="p-1.5 rounded-full bg-purple-100">
                              <TrendingUpIcon className="h-3.5 w-3.5 text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{rev.reason}</p>
                              <p className="text-xs text-muted-foreground">
                                {rev.oldCost.toLocaleString('ar-SA')} ريال ← {rev.newCost.toLocaleString('ar-SA')} ريال
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {rev.initiatedBy} - {formatDate(rev.date)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selected.pendingRevaluation && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-800">إعادة تقييم معلقة</span>
                      </div>
                      <p className="text-xs text-amber-700 mt-1">
                        هذا الصنف لديه إعادة تقييم معلقة. يرجى مراجعة التكلفة الحالية.
                      </p>
                      <Button variant="outline" size="sm" className="mt-2 h-8 text-xs">
                        عرض تفاصيل إعادة التقييم
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {inspectorTab === 'documents' && (
                <CrossEntityInspector
                  entityType="inventory"
                  entityId={selected.sku}
                />
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">اختر صنفاً من القائمة</p>
            </div>
          )}
        </>
      }
      validationBar={
        <RealtimeValidationBar
          messages={allValidationMessages}
          onDismiss={(id) => {}}
        />
      }
      aiPanel={
        <AIAssistancePanel
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          domain="inventory"
          entityId={selectedId ?? undefined}
        />
      }
    >
      <div className="flex flex-col h-full">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="p-4 rounded-2xl bg-muted inline-flex mb-4">
                <BarChart3 className="h-12 w-12 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-semibold mb-1">اختر صنفاً للتحليل</h3>
              <p className="text-sm text-muted-foreground">اختر صنفاً من القائمة لعرض تحليل التقييم الكامل</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded', classColors[selected.valuationClass])}>
                    {selected.valuationClass}
                  </span>
                  <span className={cn('text-xs px-2 py-0.5 rounded', statusColors[selected.status])}>
                    {statusLabels[selected.status]}
                  </span>
                  <span className="text-xs text-muted-foreground">{selected.sku}</span>
                </div>
                <h2 className="text-xl font-bold">{selected.name}</h2>
                <p className="text-sm text-muted-foreground">{selected.category}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="default" size="sm" className="h-8 text-xs gap-1">
                  <TrendingUpIcon className="h-3.5 w-3.5" />
                  إعادة تقييم
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <Download className="h-3.5 w-3.5" />
                  تصدير
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">التكلفة الحالية</p>
                <p className="text-2xl font-bold">{selected.currentCost.toLocaleString('ar-SA')} ريال</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">التكلفة المعيارية</p>
                <p className="text-2xl font-bold">{selected.standardCost.toLocaleString('ar-SA')} ريال</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">الكمية</p>
                <p className="text-2xl font-bold" dir="ltr">{selected.quantity.toLocaleString('ar-SA')}</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">القيمة الإجمالية</p>
                <p className="text-2xl font-bold">{selected.totalValue.toLocaleString('ar-SA')} ريال</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">مقارنة التكلفة</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">التكلفة الحالية</span>
                        <span className="font-bold">{selected.currentCost.toLocaleString('ar-SA')} ريال</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(selected.currentCost / maxCost) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">التكلفة المعيارية</span>
                        <span className="font-bold">{selected.standardCost.toLocaleString('ar-SA')} ريال</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${(selected.standardCost / maxCost) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">الفارق</span>
                      <span className={cn(
                        'text-lg font-bold',
                        selected.marginPercentage > 0 ? 'text-green-600' : 'text-red-600',
                      )}>
                        {selected.marginPercentage > 0 ? '+' : ''}{selected.marginPercentage}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">الكمية × التكلفة</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">الكمية × التكلفة الحالية</span>
                      <span className="text-sm font-bold">{selected.totalValue.toLocaleString('ar-SA')} ريال</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">الكمية × التكلفة المعيارية</span>
                      <span className="text-sm font-bold">{(selected.quantity * selected.standardCost).toLocaleString('ar-SA')} ريال</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-sm text-muted-foreground">فرق القيمة</span>
                      <span className={cn(
                        'text-sm font-bold',
                        (selected.totalValue - selected.quantity * selected.standardCost) > 0 ? 'text-green-600' : 'text-red-600',
                      )}>
                        {(selected.totalValue - selected.quantity * selected.standardCost).toLocaleString('ar-SA')} ريال
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">تاريخ التكلفة (آخر 12 شهر)</h3>
                  <div className="space-y-1">
                    {selected.costHistory.map((point, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-16 shrink-0">
                          {new Date(point.date).toLocaleDateString('ar-SA', { month: 'short' })}
                        </span>
                        <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden relative">
                          <div
                            className="h-full bg-primary/70 rounded-sm transition-all"
                            style={{ width: `${(point.cost / maxCost) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-medium w-12 text-left" dir="ltr">
                          {point.cost.toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t text-[10px] text-muted-foreground">
                    <span>الأقدم</span>
                    <span>الأحدث</span>
                  </div>
                </div>

                {selected.revaluationHistory.length > 0 && (
                  <div className="rounded-xl border bg-card p-4">
                    <h3 className="text-sm font-semibold mb-3">سجل إعادة التقييم</h3>
                    <div className="space-y-3">
                      {selected.revaluationHistory.slice(-3).map((rev) => (
                        <div key={rev.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                          <div className="p-1.5 rounded-full bg-purple-100">
                            <TrendingUpIcon className="h-3.5 w-3.5 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{rev.reason}</p>
                            <p className="text-xs text-muted-foreground">
                              {rev.oldCost.toLocaleString('ar-SA')} ← {rev.newCost.toLocaleString('ar-SA')} ريال
                            </p>
                            <p className="text-[10px] text-muted-foreground">{formatDate(rev.date)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selected.pendingRevaluation && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <h3 className="text-sm font-semibold text-amber-800">إعادة تقييم معلقة</h3>
                    </div>
                    <p className="text-xs text-amber-700">
                      هذا الصنف لديه إعادة تقييم معلقة في سير العمل. يرجى مراجعة التفاصيل واعتماد إعادة التقييم.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button variant="default" size="sm" className="h-8 text-xs">
                        عرض التفاصيل
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs">
                        تجاهل
                      </Button>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">تحليل الحركة</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">نقطة إعادة الطلب</span>
                      <span className="text-sm font-medium" dir="ltr">{selected.reorderPoint}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">المخزون الحالي</span>
                      <span className="text-sm font-medium" dir="ltr">{selected.quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">حالة الصنف</span>
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded', statusColors[selected.status])}>
                        {statusLabels[selected.status]}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t">
                    {selected.quantity <= selected.reorderPoint && selected.quantity > 0 && (
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 text-amber-700">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span className="text-xs">المخزون أقل من نقطة إعادة الطلب، يوصى بإعادة التموين</span>
                      </div>
                    )}
                    {selected.quantity === 0 && (
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 text-red-700">
                        <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span className="text-xs">المخزون صفر - نفذ بالكامل</span>
                      </div>
                    )}
                    {selected.quantity > selected.reorderPoint * 5 && (
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 text-blue-700">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span className="text-xs">المخزون فائض - قد يكون هناك مخزون راكد</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <OperationalCommenting
              comments={[]}
            />
          </div>
        )}
      </div>

      <AuditOverlay
        entries={[]}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        entityId={selected?.id}
        entityType="تحليل تقييم"
      />
    </WorkbenchShell>
  )
}
