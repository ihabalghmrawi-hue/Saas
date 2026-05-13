'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Package, Box, Warehouse, Truck, BarChart3, Search,
  Filter, ArrowUpDown, Plus, Download, CheckCircle2, XCircle,
  AlertTriangle, Eye, Clock, User, FileText, ArrowLeftRight,
  Sparkles, Shield, Activity, TrendingUp, TrendingDown, MapPin,
  Hash, Scale, QrCode, ChevronLeft, ChevronRight,
  Circle, CircleDot, Route, Send, RotateCcw,
  ArrowRight, ArrowLeft, CornerDownLeft,
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
  'دهانات صناعية', 'مواد تنظيف', 'قفازات واقية', 'أحذية سلامة',
  'خوذ أمان', 'نظارات واقية', 'معدات لحام', 'أدوات يدوية', 'معدات قياس',
]

const warehouses = [
  'المستودع الرئيسي', 'مستودع المواد الخام', 'مستودع المواد الكيميائية',
  'مستودع التعبئة', 'مستودع الصيانة',
]

const priorityLabels: Record<string, string> = {
  high: 'عالية',
  medium: 'متوسطة',
  low: 'منخفضة',
}

const priorityColors: Record<string, string> = {
  high: 'text-red-600 bg-red-50 border-red-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  low: 'text-green-600 bg-green-50 border-green-200',
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

interface TransferItem {
  id: string
  name: string
  sku: string
  quantity: number
  unit: string
  confirmedPick: boolean
  confirmedShip: boolean
  confirmedReceive: boolean
}

interface TransferTimelineEntry {
  status: string
  date: number
  actor: string
  icon: string
}

interface TransferOrder {
  id: string
  number: string
  fromWarehouse: string
  toWarehouse: string
  items: TransferItem[]
  totalItems: number
  totalQuantity: number
  status: 'نشط' | 'مكتمل' | 'قيد النقل' | 'معلق' | 'ملغي'
  priority: 'high' | 'medium' | 'low'
  pickStatus: 'pending' | 'partial' | 'completed'
  shipStatus: 'pending' | 'partial' | 'completed'
  receiveStatus: 'pending' | 'partial' | 'completed'
  expectedDate: number
  actualDate: number | null
  timeline: TransferTimelineEntry[]
  requestedBy: string
  approvedBy: string | null
  notes: string
  validationMessages: ValidationMessage[]
}

function generateTransferOrders(count: number): TransferOrder[] {
  return Array.from({ length: count }, (_, idx) => {
    const from = randomChoice(warehouses)
    let to = randomChoice(warehouses.filter((w) => w !== from))
    if (!to) to = warehouses[0]

    const statuses: TransferOrder['status'][] = ['نشط', 'مكتمل', 'قيد النقل', 'معلق', 'ملغي']
    const w = [25, 30, 20, 15, 10]
    const totalW = w.reduce((a, b) => a + b, 0)
    let r = Math.random() * totalW
    const status = statuses.find((_, i) => { r -= w[i]; return r <= 0 }) ?? 'مكتمل'
    const priority = randomChoice(['high', 'medium', 'low'] as const)

    const itemCount = randomInt(1, 5)
    const items: TransferItem[] = Array.from({ length: itemCount }, () => ({
      id: generateId('titem'),
      name: randomChoice(itemNames),
      sku: `SKU-${String(randomInt(1, 999)).padStart(4, '0')}`,
      quantity: randomInt(5, 200),
      unit: 'قطعة',
      confirmedPick: Math.random() > 0.4,
      confirmedShip: Math.random() > 0.5,
      confirmedReceive: Math.random() > 0.6,
    }))

    const totalQty = items.reduce((s, i) => s + i.quantity, 0)

    const allPicked = items.every((i) => i.confirmedPick)
    const allShipped = items.every((i) => i.confirmedShip)
    const allReceived = items.every((i) => i.confirmedReceive)

    const pickStatus: TransferOrder['pickStatus'] = allPicked ? 'completed' : items.some((i) => i.confirmedPick) ? 'partial' : 'pending'
    const shipStatus: TransferOrder['shipStatus'] = allShipped ? 'completed' : items.some((i) => i.confirmedShip) ? 'partial' : 'pending'
    const receiveStatus: TransferOrder['receiveStatus'] = allReceived ? 'completed' : items.some((i) => i.confirmedReceive) ? 'partial' : 'pending'

    const timeline: TransferTimelineEntry[] = [
      { status: 'تم إنشاء أمر التحويل', date: randomDate(30), actor: randomChoice(employeeNames), icon: 'FileText' },
    ]
    if (status !== 'ملغي') {
      timeline.push({ status: 'تم اعتماد الأمر', date: randomDate(25), actor: randomChoice(employeeNames), icon: 'CheckCircle2' })
    }
    if (pickStatus !== 'pending') {
      timeline.push({ status: 'تم التأكيد على التعبئة', date: randomDate(20), actor: randomChoice(employeeNames), icon: 'Package' })
    }
    if (shipStatus !== 'pending') {
      timeline.push({ status: 'تم تأكيد الشحن', date: randomDate(15), actor: randomChoice(employeeNames), icon: 'Truck' })
    }
    if (receiveStatus !== 'pending') {
      timeline.push({ status: 'تم تأكيد الاستلام', date: randomDate(5), actor: randomChoice(employeeNames), icon: 'CheckCircle2' })
    }

    return {
      id: generateId('tr'),
      number: `TO-${String(idx + 1).padStart(4, '0')}`,
      fromWarehouse: from,
      toWarehouse: to,
      items,
      totalItems: itemCount,
      totalQuantity: totalQty,
      status,
      priority,
      pickStatus,
      shipStatus,
      receiveStatus,
      expectedDate: randomDate(-5),
      actualDate: status === 'مكتمل' ? randomDate(2) : null,
      timeline,
      requestedBy: randomChoice(employeeNames),
      approvedBy: Math.random() > 0.3 ? randomChoice(employeeNames) : null,
      notes: randomChoice(['نقل لإعادة التوزيع', 'نقل للتخزين', 'تحويل للإنتاج', 'إعادة تموين']),
      validationMessages: Math.random() > 0.6 ? [
        { id: generateId('msg'), type: 'warning', message: 'المخزون في المصدر غير كافٍ لبعض الأصناف', field: 'المخزون' },
        { id: generateId('msg'), type: 'info', message: 'السعة في الوجهة كافية', field: 'السعة' },
      ] : [],
    }
  })
}

const statusColors: Record<string, string> = {
  نشط: 'text-blue-600 bg-blue-100',
  مكتمل: 'text-green-600 bg-green-100',
  'قيد النقل': 'text-purple-600 bg-purple-100',
  معلق: 'text-amber-600 bg-amber-100',
  ملغي: 'text-red-600 bg-red-100',
}

const confirmStatusColors: Record<string, string> = {
  pending: 'text-gray-400 bg-gray-100',
  partial: 'text-amber-600 bg-amber-100',
  completed: 'text-green-600 bg-green-100',
}

const confirmStatusLabels: Record<string, string> = {
  pending: 'معلق',
  partial: 'جزئي',
  completed: 'مكتمل',
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

const timelineIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText, CheckCircle2, Package, Truck,
}

export function TransferOperationsWorkbench() {
  const [transfers] = useState<TransferOrder[]>(() => generateTransferOrders(15))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('الكل')
  const [searchQuery, setSearchQuery] = useState('')
  const [auditOpen, setAuditOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorTab, setInspectorTab] = useState('info')

  const selected = useMemo(
    () => transfers.find((t) => t.id === selectedId) ?? null,
    [transfers, selectedId],
  )

  const filterOptions = ['الكل', 'نشط', 'مكتمل', 'قيد النقل', 'معلق', 'ملغي']

  const filteredTransfers = useMemo(() => {
    let result = transfers
    if (statusFilter !== 'الكل') {
      result = result.filter((t) => t.status === statusFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (t) =>
          t.number.toLowerCase().includes(q) ||
          t.fromWarehouse.toLowerCase().includes(q) ||
          t.toWarehouse.toLowerCase().includes(q) ||
          t.items.some((i) => i.name.toLowerCase().includes(q)),
      )
    }
    return result.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
    })
  }, [transfers, statusFilter, searchQuery])

  const metrics: WorkbenchMetric[] = useMemo(() => {
    const active = transfers.filter((t) => t.status === 'نشط' || t.status === 'قيد النقل').length
    const completed = transfers.filter((t) => t.status === 'مكتمل').length
    const inTransit = transfers.filter((t) => t.status === 'قيد النقل').length
    const pending = transfers.filter((t) => t.status === 'معلق').length
    return [
      { id: 'active', label: 'تحويلات نشطة', value: active, icon: 'Package', severity: 'info' },
      { id: 'completed', label: 'مكتملة اليوم', value: completed, icon: 'Package', severity: 'success', change: 20, trend: 'up' },
      { id: 'transit', label: 'قيد النقل', value: inTransit, icon: 'Package', severity: 'warning' },
      { id: 'pending', label: 'معلقة', value: pending, icon: 'Package', severity: pending > 3 ? 'critical' : 'info' },
    ]
  }, [transfers])

  const allValidationMessages = useMemo(() => {
    return transfers.flatMap((t) => t.validationMessages)
  }, [transfers])

  const inspectorTabs: InspectorTab[] = [
    { id: 'info', label: 'توفر المخزون', icon: 'info' },
    { id: 'history', label: 'استلام سابق', icon: 'activity' },
    { id: 'documents', label: 'المستندات', icon: 'file' },
  ]

  const handleSelect = (id: string) => {
    setSelectedId(id === selectedId ? null : id)
  }

  return (
    <WorkbenchShell
      title="منصة عمليات التحويل"
      breadcrumbs={[
        { label: 'المخزون' },
        { label: 'عمليات التحويل' },
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
                      ({transfers.filter((t) => t.status === opt).length})
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
                placeholder="بحث برقم التحويل أو المستودع..."
                className="flex h-9 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y">
            {filteredTransfers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Truck className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">لا توجد تحويلات مطابقة</p>
              </div>
            )}
            {filteredTransfers.map((tr) => {
              const isSelected = tr.id === selectedId
              return (
                <button
                  key={tr.id}
                  type="button"
                  onClick={() => handleSelect(tr.id)}
                  className={cn(
                    'w-full text-right p-3 transition-colors hover:bg-muted/50',
                    isSelected && 'bg-primary/5 border-r-2 border-primary',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('p-2 rounded-lg shrink-0', priorityColors[tr.priority])}>
                      <Truck className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn('text-xs px-1.5 py-0.5 rounded', statusColors[tr.status])}>
                          {tr.status}
                        </span>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded', priorityColors[tr.priority])}>
                          {priorityLabels[tr.priority]}
                        </span>
                        <span className="text-xs text-muted-foreground">{tr.number}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm mt-1">
                        <span className="font-medium truncate">{tr.fromWarehouse}</span>
                        <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{tr.toWarehouse}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span dir="ltr">{tr.totalQuantity} قطعة</span>
                        <span>|</span>
                        <span>{tr.totalItems} صنف</span>
                        <span>|</span>
                        <span>مطلوب: {formatDate(tr.expectedDate)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded', confirmStatusColors[tr.pickStatus])}>
                          تعبئة: {confirmStatusLabels[tr.pickStatus]}
                        </span>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded', confirmStatusColors[tr.shipStatus])}>
                          شحن: {confirmStatusLabels[tr.shipStatus]}
                        </span>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded', confirmStatusColors[tr.receiveStatus])}>
                          استلام: {confirmStatusLabels[tr.receiveStatus]}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="p-3 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filteredTransfers.length} من {transfers.length} تحويل
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
        { id: 'new', label: 'تحويل جديد', type: 'primary', handler: () => {} },
        { id: 'confirm-ship', label: 'تأكيد الشحن', type: 'secondary', handler: () => {} },
        { id: 'confirm-receive', label: 'تأكيد الاستلام', type: 'secondary', handler: () => {} },
        { id: 'track', label: 'تتبع', type: 'ghost', handler: () => {} },
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
                <div className="space-y-4">
                  <div className="rounded-xl border bg-card p-4">
                    <h4 className="text-sm font-semibold mb-3">توفر المخزون في المصدر</h4>
                    {selected.items.slice(0, 4).map((item) => (
                      <div key={item.id} className="flex items-center gap-3 py-2 border-b last:border-b-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.sku}</p>
                        </div>
                        <span className="text-sm font-medium" dir="ltr">{item.quantity}</span>
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mt-2">
                      جميع الأصناف متوفرة في المخزون
                    </p>
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <h4 className="text-sm font-semibold mb-3">السعة في الوجهة</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">السعة المتاحة</span>
                        <span className="text-sm font-medium">85%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: '85%' }} />
                      </div>
                      <p className="text-xs text-green-600">السعة كافية لاستقبال الشحنة</p>
                    </div>
                  </div>
                </div>
              )}

              {inspectorTab === 'history' && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">استلام سابق في الوجهة</h4>
                  {transfers.filter((t) => t.toWarehouse === selected.toWarehouse && t.id !== selected.id).slice(0, 4).map((t) => (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <div className="p-1.5 rounded-lg bg-green-100">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{t.number}</p>
                        <p className="text-xs text-muted-foreground">{t.fromWarehouse} ← {t.toWarehouse}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(t.expectedDate)}</span>
                    </div>
                  ))}
                </div>
              )}

              {inspectorTab === 'documents' && (
                <CrossEntityInspector
                  entityType="inventory"
                  entityId={selected.number}
                />
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">اختر تحويلاً من القائمة</p>
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
                <Route className="h-12 w-12 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-semibold mb-1">اختر تحويلاً من القائمة</h3>
              <p className="text-sm text-muted-foreground">اختر أمر تحويل لعرض تفاصيله الكاملة</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('text-xs px-2 py-0.5 rounded', statusColors[selected.status])}>
                    {selected.status}
                  </span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded', priorityColors[selected.priority])}>
                    أولوية {priorityLabels[selected.priority]}
                  </span>
                  <span className="text-xs text-muted-foreground">{selected.number}</span>
                </div>
                <div className="flex items-center gap-2 text-lg font-bold">
                  <span>{selected.fromWarehouse}</span>
                  <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                  <span>{selected.toWarehouse}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selected.pickStatus !== 'completed' && (
                  <Button variant="default" size="sm" className="h-8 text-xs gap-1">
                    <Package className="h-3.5 w-3.5" />
                    تأكيد التعبئة
                  </Button>
                )}
                {selected.shipStatus !== 'completed' && selected.pickStatus === 'completed' && (
                  <Button variant="default" size="sm" className="h-8 text-xs gap-1">
                    <Truck className="h-3.5 w-3.5" />
                    تأكيد الشحن
                  </Button>
                )}
                {selected.receiveStatus !== 'completed' && selected.shipStatus === 'completed' && (
                  <Button variant="default" size="sm" className="h-8 text-xs gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    تأكيد الاستلام
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 inline-flex mb-2">
                    <Warehouse className="h-8 w-8 text-blue-600" />
                  </div>
                  <p className="text-sm font-bold">{selected.fromWarehouse}</p>
                  <p className="text-xs text-muted-foreground">المصدر</p>
                </div>

                <div className="flex-1 max-w-[300px]">
                  <div className="relative">
                    <div className="h-1 bg-primary/30 rounded-full mt-8">
                      <div className={cn(
                        'h-1 rounded-full transition-all',
                        selected.status === 'مكتمل' ? 'w-full bg-green-500' :
                        selected.receiveStatus !== 'pending' ? 'w-3/4 bg-blue-500' :
                        selected.shipStatus !== 'pending' ? 'w-1/2 bg-amber-500' :
                        selected.pickStatus !== 'pending' ? 'w-1/4 bg-purple-500' : 'w-0',
                      )} />
                    </div>
                    <div className="flex justify-between mt-2">
                      <div className="text-center">
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded',
                          selected.pickStatus === 'completed' ? 'bg-green-100 text-green-700' :
                          selected.pickStatus === 'partial' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-400',
                        )}>
                          تعبئة
                        </span>
                      </div>
                      <div className="text-center">
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded',
                          selected.shipStatus === 'completed' ? 'bg-green-100 text-green-700' :
                          selected.shipStatus === 'partial' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-400',
                        )}>
                          شحن
                        </span>
                      </div>
                      <div className="text-center">
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded',
                          selected.receiveStatus === 'completed' ? 'bg-green-100 text-green-700' :
                          selected.receiveStatus === 'partial' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-400',
                        )}>
                          استلام
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <div className="p-4 rounded-2xl bg-green-50 border border-green-200 inline-flex mb-2">
                    <Warehouse className="h-8 w-8 text-green-600" />
                  </div>
                  <p className="text-sm font-bold">{selected.toWarehouse}</p>
                  <p className="text-xs text-muted-foreground">الوجهة</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">أصناف التحويل</h3>
                  <div className="space-y-2">
                    {selected.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.sku}</p>
                        </div>
                        <div className="text-left text-sm font-bold" dir="ltr">
                          {item.quantity.toLocaleString('ar-SA')}
                        </div>
                        <div className="flex items-center gap-1">
                          {item.confirmedPick && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                          {item.confirmedShip && <Truck className="h-3.5 w-3.5 text-blue-500" />}
                          {item.confirmedReceive && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">معلومات عامة</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">طلب بواسطة</span>
                      <span className="text-sm font-medium">{selected.requestedBy}</span>
                    </div>
                    {selected.approvedBy && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">اعتمد بواسطة</span>
                        <span className="text-sm font-medium">{selected.approvedBy}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">تاريخ التسليم المتوقع</span>
                      <span className="text-sm font-medium">{formatDate(selected.expectedDate)}</span>
                    </div>
                    {selected.actualDate && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">تاريخ التسليم الفعلي</span>
                        <span className="text-sm font-medium">{formatDate(selected.actualDate)}</span>
                      </div>
                    )}
                    {selected.actualDate && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">فرق الوقت</span>
                        <span className={cn(
                          'text-sm font-medium',
                          selected.actualDate <= selected.expectedDate ? 'text-green-600' : 'text-red-600',
                        )}>
                          {selected.actualDate <= selected.expectedDate ? 'قبل الموعد' : 'بعد الموعد'}
                        </span>
                      </div>
                    )}
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

              <div className="space-y-4">
                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">حالة التأكيد</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">تعبئة</span>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded', confirmStatusColors[selected.pickStatus])}>
                          {confirmStatusLabels[selected.pickStatus]}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={cn(
                          'h-full rounded-full',
                          selected.pickStatus === 'completed' ? 'bg-green-500' :
                          selected.pickStatus === 'partial' ? 'bg-amber-500' : 'bg-gray-300',
                        )} style={{
                          width: selected.pickStatus === 'completed' ? '100%' :
                                 selected.pickStatus === 'partial' ? '50%' : '0%',
                        }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">شحن</span>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded', confirmStatusColors[selected.shipStatus])}>
                          {confirmStatusLabels[selected.shipStatus]}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={cn(
                          'h-full rounded-full',
                          selected.shipStatus === 'completed' ? 'bg-green-500' :
                          selected.shipStatus === 'partial' ? 'bg-amber-500' : 'bg-gray-300',
                        )} style={{
                          width: selected.shipStatus === 'completed' ? '100%' :
                                 selected.shipStatus === 'partial' ? '50%' : '0%',
                        }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">استلام</span>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded', confirmStatusColors[selected.receiveStatus])}>
                          {confirmStatusLabels[selected.receiveStatus]}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={cn(
                          'h-full rounded-full',
                          selected.receiveStatus === 'completed' ? 'bg-green-500' :
                          selected.receiveStatus === 'partial' ? 'bg-amber-500' : 'bg-gray-300',
                        )} style={{
                          width: selected.receiveStatus === 'completed' ? '100%' :
                                 selected.receiveStatus === 'partial' ? '50%' : '0%',
                        }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-4">الخط الزمني للتحويل</h3>
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

                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold mb-3">ملاحظات</h3>
                  <p className="text-sm text-muted-foreground">{selected.notes}</p>
                  <textarea
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none mt-3"
                    rows={2}
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
        entityType="تحويل مخزون"
      />
    </WorkbenchShell>
  )
}
