'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Package, Box, Warehouse, Truck, BarChart3, Search,
  Filter, ArrowUpDown, Plus, Download, CheckCircle2, XCircle,
  AlertTriangle, Eye, Clock, User, FileText, ArrowLeftRight,
  Sparkles, Shield, Activity, TrendingUp, TrendingDown, MapPin,
  Hash, Scale, QrCode, ChevronLeft, ChevronRight,
  Circle, CircleDot, Percent, DollarSign,
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
import { generateMockInventoryItems, generateMockStockMovements, generateMockWarehouseTransfers } from '@/lib/workbench/mock-data'
import type { InventoryItem, ValidationMessage, AIInsight, WorkbenchMetric, InspectorTab } from '@/lib/workbench/types'

const employeeNames = [
  'أحمد محمد', 'سارة خالد', 'فهد العتيبي', 'نورة عبدالله',
  'ماجد الحربي', 'ريم الشهري', 'خالد القحطاني',
]

const itemNames = [
  'مواد خام أ', 'مواد خام ب', 'عبوات كرتون', 'أكياس بلاستيك',
  'قطع غيار م أ', 'زيوت تشحيم', 'مذيبات كيميائية', 'فلاتر تهوية',
  'أحزمة نقل', 'صمامات تحكم', 'مواسير صلب', 'كوابل كهربائية',
  'مفاتيح كهربائية', 'محولات طاقة', 'مراوح تهوية', 'أجهزة قياس',
]

const warehouses = [
  'المستودع الرئيسي', 'مستودع المواد الخام', 'مستودع المواد الكيميائية',
  'مستودع التعبئة', 'مستودع الصيانة',
]

const reasonCodes = [
  'تلف', 'انتهاء صلاحية', 'كسر', 'فقدان', 'خطأ في الجرد',
  'خطأ في الإدخال', 'عينة اختبار', 'هدايا وعينات', 'تسوية مقبوضات',
  'إنتاج', 'مرتجع مشتريات', 'مرتجع مبيعات',
]

const approvalStatuses = [
  'بانتظار الاعتماد', 'معتمد', 'مرفوض',
]

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

interface ApprovalEntry {
  approver: string
  status: string
  date: number
  comment: string
}

interface StockAdjustment {
  id: string
  number: string
  type: 'increase' | 'decrease' | 'write_off'
  item: string
  sku: string
  warehouse: string
  quantity: number
  beforeStock: number
  afterStock: number
  unitCost: number
  totalCostImpact: number
  reasonCode: string
  reasonDescription: string
  date: number
  status: 'مسودة' | 'بانتظار الاعتماد' | 'معتمد' | 'مرحل' | 'مرفوض'
  approvalChain: ApprovalEntry[]
  supportingDocuments: string[]
  validationMessages: ValidationMessage[]
  createdBy: string
  createdAt: number
  approvedBy?: string
  approvedAt?: number
}

function generateAdjustments(count: number): StockAdjustment[] {
  return Array.from({ length: count }, (_, idx) => {
    const type = randomChoice(['increase', 'decrease', 'write_off'] as const)
    const statuses: StockAdjustment['status'][] = ['مسودة', 'بانتظار الاعتماد', 'معتمد', 'مرحل', 'مرفوض']
    const w = [15, 25, 30, 20, 10]
    const totalW = w.reduce((a, b) => a + b, 0)
    let r = Math.random() * totalW
    const status = statuses.find((_, i) => { r -= w[i]; return r <= 0 }) ?? 'معتمد'

    const beforeStock = randomInt(10, 500)
    const qty = type === 'increase' ? randomInt(1, 100) : randomInt(-100, -1)
    const afterStock = beforeStock + qty
    const unitCost = randomFloat(10, 500)

    const approvalChain: ApprovalEntry[] = [
      { approver: randomChoice(employeeNames), status: randomChoice(approvalStatuses), date: randomDate(10), comment: 'تمت المراجعة والموافقة' },
    ]
    if (status === 'معتمد' || status === 'مرحل') {
      approvalChain.push({ approver: randomChoice(employeeNames), status: 'معتمد', date: randomDate(5), comment: 'موافق على التسوية' })
    }
    if (status === 'مرحل') {
      approvalChain.push({ approver: randomChoice(employeeNames), status: 'معتمد', date: randomDate(2), comment: 'تم الترحيل' })
    }

    return {
      id: generateId('adj'),
      number: `ADJ-${String(idx + 1).padStart(4, '0')}`,
      type,
      item: randomChoice(itemNames),
      sku: `SKU-${String(randomInt(1, 999)).padStart(4, '0')}`,
      warehouse: randomChoice(warehouses),
      quantity: qty,
      beforeStock,
      afterStock: Math.max(0, afterStock),
      unitCost,
      totalCostImpact: parseFloat((qty * unitCost).toFixed(2)),
      reasonCode: randomChoice(reasonCodes),
      reasonDescription: randomChoice(['تسوية جرد دوري', 'تلف أثناء الإنتاج', 'انتهاء صلاحية المنتج', 'خطأ في الجرد السابق', 'فقدان في المخزون']),
      date: randomDate(30),
      status,
      approvalChain,
      supportingDocuments: Math.random() > 0.5 ? ['تقرير الجرد.pdf', 'محضر التلف.pdf', 'إذن التسوية.pdf'] : [],
      validationMessages: Math.random() > 0.6 ? [
        { id: generateId('msg'), type: qty < -50 ? 'error' : 'warning', message: qty < -50 ? 'الكمية كبيرة جداً، يرجى المراجعة' : 'هناك اختلاف مع سجل الجرد السابق', field: 'الكمية' },
        { id: generateId('msg'), type: 'info', message: 'الأثر المالي سيتم ترحيله لحساب التسويات', field: 'التكلفة' },
      ] : [],
      createdBy: randomChoice(employeeNames),
      createdAt: randomDate(30),
      approvedBy: status === 'معتمد' || status === 'مرحل' ? randomChoice(employeeNames) : undefined,
      approvedAt: status === 'معتمد' || status === 'مرحل' ? randomDate(5) : undefined,
    }
  })
}

const typeLabels: Record<string, string> = {
  increase: 'زيادة',
  decrease: 'نقص',
  write_off: 'إعدام',
}

const typeColors: Record<string, string> = {
  increase: 'text-green-600 bg-green-50 border-green-200',
  decrease: 'text-red-600 bg-red-50 border-red-200',
  write_off: 'text-gray-600 bg-gray-50 border-gray-200',
}

const statusColors: Record<string, string> = {
  مسودة: 'text-gray-600 bg-gray-100',
  'بانتظار الاعتماد': 'text-blue-600 bg-blue-100',
  معتمد: 'text-green-600 bg-green-100',
  مرحل: 'text-purple-600 bg-purple-100',
  مرفوض: 'text-red-600 bg-red-100',
}

const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  مسودة: FileText,
  'بانتظار الاعتماد': Clock,
  معتمد: CheckCircle2,
  مرحل: ArrowUpDown,
  مرفوض: XCircle,
}

function formatDate(date: number): string {
  return new Date(date).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function formatDateTime(date: number): string {
  return new Date(date).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function StockAdjustmentWorkbench() {
  const [adjustments] = useState<StockAdjustment[]>(() => generateAdjustments(15))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('الكل')
  const [searchQuery, setSearchQuery] = useState('')
  const [auditOpen, setAuditOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorTab, setInspectorTab] = useState('info')

  const selected = useMemo(
    () => adjustments.find((a) => a.id === selectedId) ?? null,
    [adjustments, selectedId],
  )

  const filterOptions = ['الكل', 'مسودة', 'بانتظار الاعتماد', 'معتمد', 'مرحل', 'مرفوض']

  const filteredAdjustments = useMemo(() => {
    let result = adjustments
    if (statusFilter !== 'الكل') {
      result = result.filter((a) => a.status === statusFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (a) =>
          a.item.toLowerCase().includes(q) ||
          a.sku.toLowerCase().includes(q) ||
          a.number.toLowerCase().includes(q) ||
          a.reasonCode.includes(q),
      )
    }
    return result.sort((a, b) => b.date - a.date)
  }, [adjustments, statusFilter, searchQuery])

  const todayAdjustments = useMemo(
    () => adjustments.filter((a) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return a.date >= today.getTime()
    }),
    [adjustments],
  )

  const metrics: WorkbenchMetric[] = useMemo(() => {
    const totalValue = adjustments.reduce((s, a) => s + Math.abs(a.totalCostImpact), 0)
    const pendingCount = adjustments.filter((a) => a.status === 'بانتظار الاعتماد').length
    const countVariance = adjustments.filter((a) => a.type === 'write_off').length
    return [
      { id: 'today', label: 'تسويات اليوم', value: todayAdjustments.length, icon: 'Package', severity: 'info' },
      { id: 'value', label: 'القيمة الإجمالية', value: totalValue.toLocaleString('ar-SA') + ' ريال', icon: 'Package', severity: 'info', change: 15, trend: 'up' },
      { id: 'pending', label: 'موافقات معلقة', value: pendingCount, icon: 'Package', severity: pendingCount > 3 ? 'warning' : 'info' },
      { id: 'writeoff', label: 'إعدام', value: countVariance, icon: 'Package', severity: countVariance > 2 ? 'warning' : 'info' },
    ]
  }, [adjustments, todayAdjustments])

  const allValidationMessages = useMemo(() => {
    return adjustments.flatMap((a) => a.validationMessages)
  }, [adjustments])

  const inspectorTabs: InspectorTab[] = [
    { id: 'info', label: 'تكاليف العنصر', icon: 'info' },
    { id: 'history', label: 'تسويات سابقة', icon: 'activity' },
    { id: 'audit', label: 'تدقيق', icon: 'file' },
  ]

  const handleSelect = (id: string) => {
    setSelectedId(id === selectedId ? null : id)
  }

  return (
    <WorkbenchShell
      title="منصة تسويات المخزون"
      breadcrumbs={[
        { label: 'المخزون' },
        { label: 'تسويات المخزون' },
      ]}
      metrics={metrics}
      sidebarWidth={420}
      sidebar={
        <div className="flex flex-col h-full">
          <div className="p-3 border-b space-y-3">
            <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {filterOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setStatusFilter(opt)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors',
                    statusFilter === opt
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {opt}
                  {opt !== 'الكل' && (
                    <span className="mr-1 text-[10px] opacity-70">
                      ({adjustments.filter((a) => a.status === opt).length})
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
                placeholder="بحث برقم التسوية أو الصنف..."
                className="flex h-9 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y">
            {filteredAdjustments.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Scale className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">لا توجد تسويات مطابقة</p>
              </div>
            )}
            {filteredAdjustments.map((adj) => {
              const isSelected = adj.id === selectedId
              const StatusIcon = statusIcons[adj.status]
              return (
                <button
                  key={adj.id}
                  type="button"
                  onClick={() => handleSelect(adj.id)}
                  className={cn(
                    'w-full text-right p-3 transition-colors hover:bg-muted/50',
                    isSelected && 'bg-primary/5 border-r-2 border-primary',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('p-2 rounded-lg shrink-0', typeColors[adj.type])}>
                      {adj.type === 'increase' ? <TrendingUp className="h-4 w-4" /> :
                       adj.type === 'decrease' ? <TrendingDown className="h-4 w-4" /> :
                       <XCircle className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', typeColors[adj.type])}>
                          {typeLabels[adj.type]}
                        </span>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1', statusColors[adj.status])}>
                          {StatusIcon && <StatusIcon className="h-3 w-3" />}
                          {adj.status}
                        </span>
                      </div>
                      <p className="text-sm font-semibold truncate">{adj.item}</p>
                      <p className="text-xs text-muted-foreground">{adj.sku}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span dir="ltr">{adj.quantity > 0 ? '+' : ''}{adj.quantity.toLocaleString('ar-SA')}</span>
                        <span>|</span>
                        <span>{adj.reasonCode}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatDateTime(adj.date)}</span>
                        <span className="mr-1">|</span>
                        <User className="h-3 w-3" />
                        <span>{adj.createdBy}</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="p-3 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filteredAdjustments.length} من {adjustments.length} تسوية
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      }
      actions={[
        { id: 'new', label: 'إنشاء تسوية', type: 'primary', handler: () => {} },
        { id: 'approve', label: 'اعتماد', type: 'secondary', handler: () => {} },
        { id: 'post', label: 'ترحيل', type: 'secondary', handler: () => {} },
        { id: 'cancel', label: 'إلغاء', type: 'danger', handler: () => {} },
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
                <CrossEntityInspector
                  entityType="inventory"
                  entityId={selected.sku}
                />
              )}
              {inspectorTab === 'history' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">تسويات سابقة لنفس الصنف</h4>
                  {adjustments.filter((a) => a.sku === selected.sku && a.id !== selected.id).slice(0, 5).map((a) => (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <div className={cn('p-1.5 rounded-lg', typeColors[a.type])}>
                        {a.type === 'increase' ? <TrendingUp className="h-3.5 w-3.5" /> :
                         a.type === 'decrease' ? <TrendingDown className="h-3.5 w-3.5" /> :
                         <XCircle className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{typeLabels[a.type]}</p>
                        <p className="text-xs text-muted-foreground">{a.reasonCode} - {a.quantity > 0 ? '+' : ''}{a.quantity}</p>
                      </div>
                      <div className="text-left">
                        <span className={cn('text-xs px-1.5 py-0.5 rounded', statusColors[a.status])}>{a.status}</span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(a.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {inspectorTab === 'audit' && (
                <CrossEntityInspector
                  entityType="inventory"
                  entityId={selected.sku}
                />
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">اختر تسوية من القائمة</p>
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
                <Scale className="h-12 w-12 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-semibold mb-1">اختر تسوية من القائمة</h3>
              <p className="text-sm text-muted-foreground">اختر تسوية مخزون لعرض تفاصيلها الكاملة</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded', typeColors[selected.type])}>
                    {typeLabels[selected.type]}
                  </span>
                  <span className={cn('text-xs px-2 py-0.5 rounded', statusColors[selected.status])}>
                    {selected.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{selected.number}</span>
                </div>
                <h2 className="text-xl font-bold">{selected.item}</h2>
                <p className="text-sm text-muted-foreground">{selected.sku}</p>
              </div>
              <div className="flex items-center gap-2">
                {selected.status === 'بانتظار الاعتماد' && (
                  <>
                    <Button variant="default" size="sm" className="h-8 text-xs gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      اعتماد
                    </Button>
                    <Button variant="destructive" size="sm" className="h-8 text-xs gap-1">
                      <XCircle className="h-3.5 w-3.5" />
                      رفض
                    </Button>
                  </>
                )}
                {selected.status === 'معتمد' && (
                  <Button variant="default" size="sm" className="h-8 text-xs gap-1">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    ترحيل
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Hash className="h-4 w-4" />
                  <span>الكمية</span>
                </div>
                <p className="text-2xl font-bold" dir="ltr">
                  {selected.quantity > 0 ? '+' : ''}{selected.quantity.toLocaleString('ar-SA')}
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <DollarSign className="h-4 w-4" />
                  <span>تكلفة الوحدة</span>
                </div>
                <p className="text-2xl font-bold">{selected.unitCost.toLocaleString('ar-SA')} ريال</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>الأثر المالي</span>
                </div>
                <p className={cn('text-2xl font-bold', selected.totalCostImpact < 0 ? 'text-red-600' : 'text-green-600')} dir="ltr">
                  {selected.totalCostImpact > 0 ? '+' : ''}{selected.totalCostImpact.toLocaleString('ar-SA')} ريال
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <MapPin className="h-4 w-4" />
                  <span>المستودع</span>
                </div>
                <p className="text-lg font-bold">{selected.warehouse}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">مقارنة المخزون قبل وبعد</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">قبل التسوية</span>
                        <span className="font-bold" dir="ltr">{selected.beforeStock.toLocaleString('ar-SA')}</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (selected.beforeStock / 500) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <ArrowDown className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">بعد التسوية</span>
                        <span className="font-bold" dir="ltr">{selected.afterStock.toLocaleString('ar-SA')}</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', selected.afterStock >= selected.beforeStock ? 'bg-green-500' : 'bg-red-500')}
                          style={{ width: `${Math.min(100, (selected.afterStock / 500) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">معلومات التسوية</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">رمز السبب</span>
                      <span className="text-sm font-medium">{selected.reasonCode}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">الوصف</span>
                      <span className="text-sm font-medium">{selected.reasonDescription}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">تم الإنشاء بواسطة</span>
                      <span className="text-sm font-medium">{selected.createdBy}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">تاريخ الإنشاء</span>
                      <span className="text-sm font-medium">{formatDateTime(selected.createdAt)}</span>
                    </div>
                    {selected.approvedBy && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">تم الاعتماد بواسطة</span>
                        <span className="text-sm font-medium">{selected.approvedBy}</span>
                      </div>
                    )}
                    {selected.approvedAt && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">تاريخ الاعتماد</span>
                        <span className="text-sm font-medium">{formatDateTime(selected.approvedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {selected.supportingDocuments.length > 0 && (
                  <div className="rounded-xl border bg-card p-4">
                    <h3 className="text-sm font-semibold mb-3">المستندات الداعمة</h3>
                    <div className="space-y-2">
                      {selected.supportingDocuments.map((doc, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-accent transition-colors">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{doc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-4">سلسلة الاعتماد</h3>
                  <div className="space-y-0">
                    {selected.approvalChain.map((entry, idx) => {
                      const isLast = idx === selected.approvalChain.length - 1
                      return (
                        <div key={idx} className="flex items-start gap-3 relative">
                          <div className="flex flex-col items-center">
                            <div className={cn(
                              'p-1 rounded-full',
                              entry.status === 'معتمد' ? 'bg-green-100 text-green-600' :
                              entry.status === 'مرفوض' ? 'bg-red-100 text-red-600' :
                              'bg-blue-100 text-blue-600',
                            )}>
                              {entry.status === 'معتمد' ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                               entry.status === 'مرفوض' ? <XCircle className="h-3.5 w-3.5" /> :
                               <Clock className="h-3.5 w-3.5" />}
                            </div>
                            {!isLast && <div className="w-px flex-1 bg-border min-h-[24px]" />}
                          </div>
                          <div className={cn('pb-4', isLast && 'pb-0')}>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{entry.approver}</span>
                              <span className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded',
                                entry.status === 'معتمد' ? 'bg-green-100 text-green-700' :
                                entry.status === 'مرفوض' ? 'bg-red-100 text-red-700' :
                                'bg-blue-100 text-blue-700',
                              )}>
                                {entry.status}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{entry.comment}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(entry.date)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {selected.validationMessages.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <h3 className="text-sm font-semibold text-amber-800">رسائل التحقق</h3>
                    </div>
                    <div className="space-y-2">
                      {selected.validationMessages.map((msg) => (
                        <div key={msg.id} className="flex items-center gap-2 text-sm text-amber-700">
                          <CircleDot className="h-3 w-3 shrink-0" />
                          <span>{msg.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">ملاحظات</h3>
                  <textarea
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    rows={3}
                    placeholder="أضف ملاحظة..."
                  />
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
        entityType="تسوية مخزون"
      />
    </WorkbenchShell>
  )
}

function ArrowDown(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  )
}
