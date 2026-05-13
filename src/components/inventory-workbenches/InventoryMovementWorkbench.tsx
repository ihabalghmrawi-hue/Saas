'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Package, Box, Warehouse, Truck, BarChart3, Search,
  Filter, ArrowUpDown, Plus, Download, CheckCircle2, XCircle,
  AlertTriangle, Eye, Clock, User, FileText, ArrowLeftRight,
  Sparkles, Shield, Activity, TrendingUp, TrendingDown, MapPin,
  Hash, Scale, QrCode, ChevronLeft, ChevronRight,
  Circle, CircleDot, MoreHorizontal,
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
  'ماجد الحربي', 'ريم الشهري', 'خالد القحطاني', 'هند الدوسري',
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

const movementTypes = ['الكل', 'وارد', 'صادر', 'تحويل', 'تسوية'] as const

interface MovementTimelineEntry {
  status: string
  date: number
  actor: string
  icon: string
}

interface StockMovement {
  id: string
  type: 'وارد' | 'صادر' | 'تحويل' | 'تسوية'
  item: string
  sku: string
  quantity: number
  unit: string
  date: number
  fromWarehouse: string
  toWarehouse: string
  reference: string
  referenceType: string
  batch: string
  lot: string
  status: 'مخطط' | 'قيد التنفيذ' | 'مكتمل' | 'ملغي'
  timeline: MovementTimelineEntry[]
  validationMessages: ValidationMessage[]
  initiatedBy: string
  notes: string
  unitCost: number
  totalCost: number
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

function generateMovements(count: number): StockMovement[] {
  const types: StockMovement['type'][] = ['وارد', 'صادر', 'تحويل', 'تسوية']
  return Array.from({ length: count }, () => {
    const type = randomChoice(types)
    const qty = type === 'تسوية' ? randomInt(-50, 50) : randomInt(1, 500)
    const fromWh = randomChoice(warehouses)
    let toWh = randomChoice(warehouses.filter((w) => w !== fromWh))
    if (!toWh) toWh = fromWh
    const statuses: StockMovement['status'][] = ['مخطط', 'قيد التنفيذ', 'مكتمل', 'ملغي']
    const w = [80, 60, 40, 20]
    const totalW = w.reduce((a, b) => a + b, 0)
    let r = Math.random() * totalW
    const status = statuses.find((_, i) => { r -= w[i]; return r <= 0 }) ?? 'مكتمل'

    const timeline: MovementTimelineEntry[] = [
      { status: 'تم الإنشاء', date: randomDate(30), actor: randomChoice(employeeNames), icon: 'FileText' },
      { status: 'قيد المراجعة', date: randomDate(20), actor: randomChoice(employeeNames), icon: 'Eye' },
    ]
    if (status === 'مكتمل' || status === 'قيد التنفيذ') {
      timeline.push({ status: 'تم الاعتماد', date: randomDate(15), actor: randomChoice(employeeNames), icon: 'CheckCircle2' })
    }
    if (status === 'مكتمل') {
      timeline.push({ status: 'تم التنفيذ', date: randomDate(5), actor: randomChoice(employeeNames), icon: 'CheckCircle2' })
    }

    const refTypes = ['أمر شراء', 'أمر بيع', 'أمر تحويل', 'تسوية جرد']
    const refType = refTypes[types.indexOf(type)]
    const unitCost = randomFloat(10, 500)

    return {
      id: generateId('mov'),
      type,
      item: randomChoice(itemNames),
      sku: `SKU-${String(randomInt(1, 999)).padStart(4, '0')}`,
      quantity: qty,
      unit: 'قطعة',
      date: randomDate(30),
      fromWarehouse: type === 'وارد' ? 'المورد' : fromWh,
      toWarehouse: type === 'صادر' ? 'العميل' : toWh,
      reference: `${refType === 'أمر شراء' ? 'PO' : refType === 'أمر بيع' ? 'SO' : refType === 'أمر تحويل' ? 'TO' : 'ADJ'}-${String(randomInt(1000, 9999))}`,
      referenceType: refType,
      batch: `BATCH-${String(randomInt(1, 999)).padStart(4, '0')}`,
      lot: `LOT-${String(randomInt(1, 999)).padStart(4, '0')}`,
      status,
      timeline,
      validationMessages: Math.random() > 0.7 ? [
        { id: generateId('msg'), type: 'warning', message: 'المخزون غير كافي لتلبية الطلب', field: 'الكمية' },
        { id: generateId('msg'), type: 'info', message: 'تم التحقق من المستندات', field: 'المستندات' },
      ] : [],
      initiatedBy: randomChoice(employeeNames),
      notes: randomChoice(['إنتاج', 'مبيعات', 'مشتريات', 'تسوية جرد', 'تالف', 'نقل داخلي']),
      unitCost,
      totalCost: parseFloat((qty * unitCost).toFixed(2)),
    }
  })
}

const typeColors: Record<string, string> = {
  وارد: 'text-green-600 bg-green-50 border-green-200',
  صادر: 'text-red-600 bg-red-50 border-red-200',
  تحويل: 'text-blue-600 bg-blue-50 border-blue-200',
  تسوية: 'text-amber-600 bg-amber-50 border-amber-200',
}

const statusColors: Record<string, string> = {
  مخطط: 'text-gray-600 bg-gray-100',
  'قيد التنفيذ': 'text-blue-600 bg-blue-100',
  مكتمل: 'text-green-600 bg-green-100',
  ملغي: 'text-red-600 bg-red-100',
}

function formatDate(date: number): string {
  return new Date(date).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function formatTime(date: number): string {
  return new Date(date).toLocaleTimeString('ar-SA', {
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDateTime(date: number): string {
  return `${formatDate(date)} ${formatTime(date)}`
}

const timelineIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText, Eye, CheckCircle2, XCircle, Clock,
}

export function InventoryMovementWorkbench() {
  const [movements] = useState<StockMovement[]>(() => generateMovements(30))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('الكل')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [auditOpen, setAuditOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorTab, setInspectorTab] = useState('info')

  const selected = useMemo(
    () => movements.find((m) => m.id === selectedId) ?? null,
    [movements, selectedId],
  )

  const filteredMovements = useMemo(() => {
    let result = movements
    if (typeFilter !== 'الكل') {
      result = result.filter((m) => m.type === typeFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (m) =>
          m.item.toLowerCase().includes(q) ||
          m.sku.toLowerCase().includes(q) ||
          m.reference.toLowerCase().includes(q) ||
          m.batch.toLowerCase().includes(q),
      )
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime()
      result = result.filter((m) => m.date >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000
      result = result.filter((m) => m.date <= to)
    }
    return result.sort((a, b) => b.date - a.date)
  }, [movements, typeFilter, searchQuery, dateFrom, dateTo])

  const metrics: WorkbenchMetric[] = useMemo(() => {
    const total = movements.length
    const وارد = movements.filter((m) => m.type === 'وارد').reduce((s, m) => s + Math.abs(m.quantity), 0)
    const صادر = movements.filter((m) => m.type === 'صادر').reduce((s, m) => s + Math.abs(m.quantity), 0)
    const net = وارد - صادر
    return [
      { id: 'total', label: 'إجمالي الحركات', value: total, icon: 'Package', severity: 'info', change: 12, trend: 'up' },
      { id: 'in', label: 'إجمالي الوارد', value: وارد.toLocaleString('ar-SA'), icon: 'Package', severity: 'success', change: 8, trend: 'up' },
      { id: 'out', label: 'إجمالي الصادر', value: صادر.toLocaleString('ar-SA'), icon: 'Package', severity: 'warning', change: -3, trend: 'down' },
      { id: 'net', label: 'صافي التغير', value: net >= 0 ? `+${net.toLocaleString('ar-SA')}` : net.toLocaleString('ar-SA'), icon: 'BarChart3', severity: net >= 0 ? 'success' : 'critical' },
    ]
  }, [movements])

  const allValidationMessages = useMemo(() => {
    return movements.flatMap((m) => m.validationMessages)
  }, [movements])

  const inspectorTabs: InspectorTab[] = [
    { id: 'info', label: 'معلومات العنصر', icon: 'info' },
    { id: 'movements', label: 'حركات أخرى', icon: 'activity', badge: 3 },
    { id: 'audit', label: 'التدقيق', icon: 'file' },
  ]

  const handleSelect = (id: string) => {
    setSelectedId(id === selectedId ? null : id)
  }

  return (
    <WorkbenchShell
      title="منصة حركة المخزون"
      breadcrumbs={[
        { label: 'المخزون' },
        { label: 'حركة المخزون' },
      ]}
      metrics={metrics}
      sidebarWidth={420}
      sidebar={
        <div className="flex flex-col h-full">
          <div className="p-3 border-b space-y-3">
            <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {movementTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(type)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors',
                    typeFilter === type
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {type}
                  {type !== 'الكل' && (
                    <span className="mr-1.5 text-[10px] opacity-70">
                      ({movements.filter((m) => m.type === type).length})
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
                placeholder="بحث بالصنف أو الكود أو المرجع..."
                className="flex h-9 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="من تاريخ"
                />
              </div>
              <div className="flex-1">
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="إلى تاريخ"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y">
            {filteredMovements.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Package className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">لا توجد حركات مطابقة</p>
              </div>
            )}
            {filteredMovements.map((mov) => {
              const isSelected = mov.id === selectedId
              const typeColor = typeColors[mov.type]
              return (
                <button
                  key={mov.id}
                  type="button"
                  onClick={() => handleSelect(mov.id)}
                  className={cn(
                    'w-full text-right p-3 transition-colors hover:bg-muted/50',
                    isSelected && 'bg-primary/5 border-r-2 border-primary',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('p-2 rounded-lg shrink-0', typeColor)}>
                      {mov.type === 'وارد' ? <ArrowLeftRight className="h-4 w-4" /> :
                       mov.type === 'صادر' ? <ArrowLeftRight className="h-4 w-4" /> :
                       mov.type === 'تحويل' ? <Truck className="h-4 w-4" /> :
                       <Scale className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', typeColor)}>
                          {mov.type}
                        </span>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded', statusColors[mov.status])}>
                          {mov.status}
                        </span>
                      </div>
                      <p className="text-sm font-semibold truncate">{mov.item}</p>
                      <p className="text-xs text-muted-foreground">{mov.sku}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span dir="ltr">{mov.quantity.toLocaleString('ar-SA')} {mov.unit}</span>
                        <span>|</span>
                        <span>{mov.reference}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatDateTime(mov.date)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="p-3 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filteredMovements.length} من {movements.length} حركة
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
        { id: 'new', label: 'تسجيل حركة', type: 'primary', icon: 'Plus', handler: () => {} },
        { id: 'export', label: 'تصدير', type: 'secondary', icon: 'Download', handler: () => {} },
        { id: 'audit', label: 'سجل التدقيق', type: 'ghost', icon: 'Shield', handler: () => setAuditOpen(!auditOpen) },
        { id: 'ai', label: 'تحليل ذكي', type: 'ghost', icon: 'Sparkles', handler: () => setAiOpen(!aiOpen) },
      ]}
      inspectorTabs={inspectorTabs}
      inspectorOpen={inspectorOpen}
      onInspectorToggle={setInspectorOpen}
      inspectorTab={inspectorTab}
      onInspectorTabChange={setInspectorTab}
      inspectorContent={
        <>
          {inspectorTab === 'info' && selected && (
            <div className="space-y-4">
              <CrossEntityInspector
                entityType="inventory"
                entityId={selected.sku}
              />
            </div>
          )}
          {inspectorTab === 'movements' && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">حركات أخرى لنفس الصنف</h4>
              {movements.filter((m) => m.id !== selectedId).slice(0, 5).map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer hover:bg-accent">
                  <div className={cn('p-1.5 rounded-lg', typeColors[m.type])}>
                    {m.type === 'وارد' ? <ArrowLeftRight className="h-3.5 w-3.5" /> :
                     m.type === 'صادر' ? <ArrowLeftRight className="h-3.5 w-3.5" /> :
                     <Truck className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.item}</p>
                    <p className="text-xs text-muted-foreground">{m.type} - {m.quantity} {m.unit}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(m.date)}</span>
                </div>
              ))}
            </div>
          )}
          {inspectorTab === 'audit' && (
            <CrossEntityInspector
              entityType="inventory"
              entityId={selected?.sku ?? ''}
            />
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
                <Package className="h-12 w-12 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-semibold mb-1">اختر حركة من القائمة</h3>
              <p className="text-sm text-muted-foreground">اختر حركة مخزون لعرض تفاصيلها الكاملة</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded', typeColors[selected.type])}>
                    {selected.type}
                  </span>
                  <span className={cn('text-xs px-2 py-0.5 rounded', statusColors[selected.status])}>
                    {selected.status}
                  </span>
                  <span className="text-xs text-muted-foreground">#{selected.id.slice(0, 8)}</span>
                </div>
                <h2 className="text-xl font-bold">{selected.item}</h2>
                <p className="text-sm text-muted-foreground">{selected.sku}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  عرض المستند
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <Download className="h-3.5 w-3.5" />
                  تصدير
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Hash className="h-4 w-4" />
                  <span>الكمية</span>
                </div>
                <p className="text-2xl font-bold" dir="ltr">
                  {selected.quantity.toLocaleString('ar-SA')} {selected.unit}
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Scale className="h-4 w-4" />
                  <span>تكلفة الوحدة</span>
                </div>
                <p className="text-2xl font-bold">{selected.unitCost.toLocaleString('ar-SA')} ريال</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>التكلفة الإجمالية</span>
                </div>
                <p className="text-2xl font-bold">{selected.totalCost.toLocaleString('ar-SA')} ريال</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">مصدر ووجهة الحركة</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">من</p>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{selected.fromWarehouse}</span>
                      </div>
                    </div>
                    <ArrowLeftRight className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">إلى</p>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{selected.toWarehouse}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">معلومات المستند المرجعي</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">النوع</span>
                      <span className="text-sm font-medium">{selected.referenceType}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">الرقم</span>
                      <span className="text-sm font-medium">{selected.reference}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">الدفعة</span>
                      <span className="text-sm font-medium">{selected.batch}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">اللوت</span>
                      <span className="text-sm font-medium">{selected.lot}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">بواسطة</span>
                      <span className="text-sm font-medium">{selected.initiatedBy}</span>
                    </div>
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
              </div>

              <div>
                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-4">الخط الزمني للحركة</h3>
                  <div className="space-y-0">
                    {selected.timeline.map((entry, idx) => {
                      const Icon = timelineIcons[entry.icon] ?? Clock
                      const isLast = idx === selected.timeline.length - 1
                      return (
                        <div key={idx} className="flex items-start gap-3 relative">
                          <div className="flex flex-col items-center">
                            <div className={cn(
                              'p-1 rounded-full',
                              entry.status.includes('تم') ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600',
                            )}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            {!isLast && <div className="w-px flex-1 bg-border min-h-[24px]" />}
                          </div>
                          <div className={cn('pb-4', isLast && 'pb-0')}>
                            <p className="text-sm font-medium">{entry.status}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <User className="h-3 w-3" />
                              <span>{entry.actor}</span>
                              <span>|</span>
                              <Clock className="h-3 w-3" />
                              <span>{formatDateTime(entry.date)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
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
        entityType="حركة مخزون"
      />
    </WorkbenchShell>
  )
}
