'use client'
import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { ShoppingCart, FileText, CheckCircle2, AlertTriangle, Clock, User, Search, Filter, ArrowUpDown, RefreshCw, Download, Printer, Plus, Eye, Edit3, X, Ban, Send, Sparkles, TrendingUp, TrendingDown, DollarSign, ArrowRight, PanelRightOpen, PanelRightClose, Loader2, MoreHorizontal, CheckSquare, Shield, MessageSquare, Paperclip, History, Truck, Building2, Package, Box, MapPin, CreditCard, Receipt, Percent, Phone, Mail, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { WorkbenchShell } from '@/components/workbench/WorkbenchShell'
import { InspectorPanel } from '@/components/workbench/InspectorPanel'
import { RealtimeValidationBar } from '@/components/workbench/RealtimeValidationBar'
import { AIAssistancePanel } from '@/components/workbench/AIAssistancePanel'
import { CrossEntityInspector } from '@/components/workbench/CrossEntityInspector'
import { AuditOverlay } from '@/components/workbench/AuditOverlay'
import { OperationalCommenting } from '@/components/workbench/OperationalCommenting'
import { WorkbenchMetricCard } from '@/components/workbench/WorkbenchMetricCard'
import { generateMockSalesOrders, generateMockCustomers, generateMockInvoices, generateMockInventoryItems, generateMockValidationMessages, generateMockAIInsights, generateMockAuditTrail, generateMockDocuments, generateMockOperationalComments } from '@/lib/workbench/mock-data'
import type { SalesOrder, SalesOrderLine, ValidationMessage, AIInsight, AuditTrailEntry, OperationalComment, InspectorTab, WorkbenchMetric, WorkbenchAction } from '@/lib/workbench/types'

interface FulfillmentTask {
  id: string
  orderNumber: string
  customer: string
  status: 'pending_pick' | 'picking' | 'picked' | 'packing' | 'packed' | 'ready'
  priority: 'high' | 'normal' | 'low'
  zone: string
  warehouse: string
  items: FulfillmentItem[]
  createdAt: number
  dueDate: number
}

interface FulfillmentItem {
  id: string
  name: string
  quantity: number
  picked: number
  bin: string
  warehouse: string
  zone: string
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending_pick: { label: 'بانتظار السحب', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  picking: { label: 'جاري السحب', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  picked: { label: 'تم السحب', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  packing: { label: 'جاري التعبئة', color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  packed: { label: 'تم التعبئة', color: 'text-green-600 bg-green-50 border-green-200' },
  ready: { label: 'جاهز للشحن', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
}

const priorityLabels: Record<string, { label: string; color: string }> = {
  high: { label: 'عاجل', color: 'text-red-600 bg-red-50' },
  normal: { label: 'عادي', color: 'text-blue-600 bg-blue-50' },
  low: { label: 'منخفض', color: 'text-gray-600 bg-gray-50' },
}

const zones = ['منطقة أ', 'منطقة ب', 'منطقة ج', 'منطقة د']
const warehouses = ['المستودع الرئيسي', 'مستودع المواد', 'مستودع التعبئة']

const itemNames = [
  'منتج نهائي أ', 'منتج نهائي ب', 'كرتون تغليف', 'مواد تعبئة',
  'زيوت تشحيم معبأة', 'مذيبات مخففة', 'فلاتر هواء', 'أحزمة ناقلة',
  'صمامات تحكم', 'وصلات مواسير', 'كوابل طاقة', 'مفاتيح كهربائية',
]

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomDate(daysAgo: number): number {
  return Date.now() - randomInt(0, daysAgo * 86400000)
}

function generateMockFulfillmentTasks(count: number): FulfillmentTask[] {
  return Array.from({ length: count }, (_, idx) => {
    const numItems = randomInt(1, 5)
    const warehouse = randomChoice(warehouses)
    const zone = randomChoice(zones)
    const items: FulfillmentItem[] = Array.from({ length: numItems }, (_, li) => ({
      id: `fi-${idx}-${li}`,
      name: randomChoice(itemNames),
      quantity: randomInt(5, 100),
      picked: Math.random() > 0.6 ? randomInt(0, 50) : 0,
      bin: `BIN-${String(randomInt(1, 50)).padStart(3, '0')}`,
      warehouse,
      zone,
    }))
    const statuses: FulfillmentTask['status'][] = ['pending_pick', 'picking', 'picked', 'packing', 'packed', 'ready']
    return {
      id: `ft-${idx}`,
      orderNumber: `SO-${String(idx + 1).padStart(4, '0')}`,
      customer: randomChoice(['شركة الأمل', 'مؤسسة النور', 'شركة الفيصلية', 'مجموعة السلام', 'شركة الوادي الأخضر']),
      status: randomChoice(statuses),
      priority: randomChoice(['high', 'normal', 'low'] as const),
      zone,
      warehouse,
      items,
      createdAt: randomDate(7),
      dueDate: randomDate(-2),
    }
  })
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ar-SA', { minimumFractionDigits: 2 })
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ar-SA')
}

export function FulfillmentWorkbench() {
  const [tasks] = useState<FulfillmentTask[]>(() => generateMockFulfillmentTasks(20))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [zoneFilter, setZoneFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [activeInspectorTab, setActiveInspectorTab] = useState('info')
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [validations] = useState<ValidationMessage[]>(() => generateMockValidationMessages('sales'))
  const [aiInsights] = useState<AIInsight[]>(() => generateMockAIInsights('sales'))
  const [auditEntries] = useState<AuditTrailEntry[]>(() => generateMockAuditTrail())
  const [comments] = useState<OperationalComment[]>(() => generateMockOperationalComments())

  const metrics: WorkbenchMetric[] = useMemo(() => {
    const pendingPick = tasks.filter((t) => t.status === 'pending_pick').length
    const picking = tasks.filter((t) => t.status === 'picking').length
    const packed = tasks.filter((t) => t.status === 'packed').length
    const ready = tasks.filter((t) => t.status === 'ready').length
    const priority = tasks.filter((t) => t.priority === 'high').length
    return [
      { id: 'pending_pick', label: 'بانتظار السحب', value: pendingPick, change: -8, trend: 'down', icon: 'Package', severity: 'info' },
      { id: 'picking', label: 'قيد السحب', value: picking, change: 15, trend: 'up', icon: 'Package', severity: 'info' },
      { id: 'packed', label: 'تم التعبئة', value: packed, change: 5, trend: 'up', icon: 'CheckSquare', severity: 'success' },
      { id: 'ready', label: 'جاهز للشحن', value: ready, change: 10, trend: 'up', icon: 'Truck', severity: 'success' },
      { id: 'priority', label: 'طلبات عاجلة', value: priority, change: 2, trend: 'up', icon: 'AlertTriangle', severity: 'critical' },
    ]
  }, [tasks])

  const filteredTasks = useMemo(() => {
    let result = [...tasks]
    if (statusFilter !== 'all') result = result.filter((t) => t.status === statusFilter)
    if (zoneFilter !== 'all') result = result.filter((t) => t.zone === zoneFilter)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((t) => t.orderNumber.toLowerCase().includes(q) || t.customer.toLowerCase().includes(q))
    }
    const priorityOrder = { high: 0, normal: 1, low: 2 }
    return result.sort((a, b) => {
      const pa = priorityOrder[a.priority]
      const pb = priorityOrder[b.priority]
      return pa - pb || b.createdAt - a.createdAt
    })
  }, [tasks, statusFilter, zoneFilter, searchQuery])

  const selectedTask = useMemo(() => tasks.find((t) => t.id === selectedId) ?? null, [tasks, selectedId])

  const groupedByZone = useMemo(() => {
    const groups: Record<string, FulfillmentTask[]> = {}
    for (const t of filteredTasks) {
      if (!groups[t.zone]) groups[t.zone] = []
      groups[t.zone].push(t)
    }
    return groups
  }, [filteredTasks])

  const inspectorTabs: InspectorTab[] = useMemo(() => [
    { id: 'info', label: 'التفاصيل', icon: 'info', badge: selectedTask?.items.length },
    { id: 'activity', label: 'النشاط', icon: 'activity' },
    { id: 'message', label: 'التعليقات', icon: 'message', badge: comments.length },
  ], [selectedTask, comments])

  const actions: WorkbenchAction[] = useMemo(() => [
    { id: 'print', label: 'طباعة قائمة السحب', type: 'secondary', icon: 'Printer', handler: () => {} },
    { id: 'refresh', label: 'تحديث', type: 'secondary', icon: 'RefreshCw', handler: () => {} },
    { id: 'export', label: 'تصدير', type: 'ghost', icon: 'Download', handler: () => {} },
  ], [])

  const handleDismissValidation = useCallback((id: string) => {}, [])

  const statusFilters = [
    { key: 'all', label: 'الكل' },
    { key: 'pending_pick', label: 'بانتظار السحب' },
    { key: 'picking', label: 'جاري السحب' },
    { key: 'picked', label: 'تم السحب' },
    { key: 'packing', label: 'جاري التعبئة' },
    { key: 'packed', label: 'تم التعبئة' },
    { key: 'ready', label: 'جاهز للشحن' },
  ]

  const zoneFilters = [
    { key: 'all', label: 'جميع المناطق' },
    ...zones.map((z) => ({ key: z, label: z })),
  ]

  const pickedPercent = (item: FulfillmentItem) => Math.round((item.picked / item.quantity) * 100)

  return (
    <WorkbenchShell
      title="منصة التجهيز والتعبئة"
      description="إدارة عمليات السحب والتعبئة والتجهيز للشحن"
      breadcrumbs={[
        { label: 'المبيعات', icon: ShoppingCart },
        { label: 'التجهيز والتعبئة' },
      ]}
      metrics={metrics}
      actions={actions}
      inspectorTabs={inspectorTabs}
      inspectorOpen={inspectorOpen}
      onInspectorToggle={setInspectorOpen}
      inspectorTab={activeInspectorTab}
      onInspectorTabChange={setActiveInspectorTab}
      inspectorContent={selectedTask ? (
        <>
          {activeInspectorTab === 'info' && (
            <div className="space-y-4">
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">مهمة التجهيز</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">أمر التوريد:</span> <span className="font-medium">{selectedTask.orderNumber}</span></div>
                  <div><span className="text-muted-foreground">العميل:</span> <span className="font-medium">{selectedTask.customer}</span></div>
                  <div><span className="text-muted-foreground">المستودع:</span> <span className="font-medium">{selectedTask.warehouse}</span></div>
                  <div><span className="text-muted-foreground">المنطقة:</span> <span className="font-medium">{selectedTask.zone}</span></div>
                  <div><span className="text-muted-foreground">تاريخ الإنشاء:</span> <span className="font-medium">{formatDate(selectedTask.createdAt)}</span></div>
                  <div><span className="text-muted-foreground">تاريخ التسليم:</span> <span className="font-medium">{formatDate(selectedTask.dueDate)}</span></div>
                  <div>
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', statusLabels[selectedTask.status]?.color)}>
                      {statusLabels[selectedTask.status]?.label}
                    </span>
                  </div>
                  <div>
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', priorityLabels[selectedTask.priority]?.color)}>
                      {priorityLabels[selectedTask.priority]?.label}
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">أصناف السحب ({selectedTask.items.length})</h4>
                <div className="space-y-3">
                  {selectedTask.items.map((item) => (
                    <div key={item.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">{item.name}</p>
                        <span className="text-xs text-muted-foreground">{item.bin}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                        <span>المطلوب: <strong className="text-foreground">{item.quantity}</strong></span>
                        <span>تم السحب: <strong className="text-foreground">{item.picked}</strong></span>
                        <span>المتبقي: <strong className={cn(item.quantity - item.picked > 0 ? 'text-amber-600' : 'text-green-600')}>{item.quantity - item.picked}</strong></span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', pickedPercent(item) >= 100 ? 'bg-green-500' : 'bg-primary')} style={{ width: `${pickedPercent(item)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">الإجراءات</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedTask.status === 'pending_pick' && (
                    <Button size="sm" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" />بدء السحب</Button>
                  )}
                  {selectedTask.status === 'picking' && (
                    <Button size="sm" className="gap-1"><CheckSquare className="h-3.5 w-3.5" />إكمال السحب</Button>
                  )}
                  {selectedTask.status === 'picked' && (
                    <Button size="sm" className="gap-1"><Package className="h-3.5 w-3.5" />بدء التعبئة</Button>
                  )}
                  {selectedTask.status === 'packing' && (
                    <Button size="sm" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" />إكمال التعبئة</Button>
                  )}
                  {selectedTask.status === 'packed' && (
                    <Button size="sm" className="gap-1"><Truck className="h-3.5 w-3.5" />تأكيد الجاهزية</Button>
                  )}
                  <Button size="sm" variant="secondary" className="gap-1"><Printer className="h-3.5 w-3.5" />طباعة قائمة التعبئة</Button>
                </div>
              </div>
            </div>
          )}
          {activeInspectorTab === 'activity' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">سجل النشاط غير متاح</p>
            </div>
          )}
          {activeInspectorTab === 'message' && (
            <OperationalCommenting comments={comments} />
          )}
        </>
      ) : null}
      validationBar={
        <RealtimeValidationBar messages={validations} />
      }
      aiPanel={
        <AIAssistancePanel
          open={aiPanelOpen}
          onClose={() => setAiPanelOpen(false)}
          domain="sales"
          entityId={selectedId ?? undefined}
          insights={aiInsights}
        />
      }
      className="rtl"
    >
      <div className="flex flex-col h-full overflow-hidden">
        <div className="border-b bg-card px-6 py-3 shrink-0">
          <div className="flex gap-3 items-center flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="بحث..." className="flex h-9 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {zoneFilters.map((f) => (
                <button key={f.key} type="button" onClick={() => setZoneFilter(f.key)} className={cn('px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors', zoneFilter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>{f.label}</button>
              ))}
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {statusFilters.slice(0, 4).map((f) => (
                <button key={f.key} type="button" onClick={() => setStatusFilter(f.key)} className={cn('px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors', statusFilter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>{f.label}</button>
              ))}
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setAiPanelOpen(!aiPanelOpen)}>
              <Sparkles className={cn('h-4 w-4', aiPanelOpen && 'text-primary')} />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {Object.keys(groupedByZone).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Package className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-semibold mb-1">لا توجد مهام تجهيز</h3>
              <p className="text-sm text-muted-foreground">جميع الطلبات تم تجهيزها أو لا توجد طلبات حالياً</p>
            </div>
          ) : (
            <div className="divide-y">
              {Object.entries(groupedByZone).map(([zone, zoneTasks]) => (
                <div key={zone}>
                  <div className="px-6 py-2 bg-muted/30 border-b flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{zone}</span>
                    <span className="text-xs text-muted-foreground">({zoneTasks.length} {zoneTasks.length === 1 ? 'مهمة' : 'مهام'})</span>
                  </div>
                  {zoneTasks.map((task) => {
                    const sl = statusLabels[task.status]
                    const pl = priorityLabels[task.priority]
                    const totalQty = task.items.reduce((s, i) => s + i.quantity, 0)
                    const totalPicked = task.items.reduce((s, i) => s + i.picked, 0)
                    const overallPct = Math.round((totalPicked / totalQty) * 100)
                    const isOverdue = task.dueDate < Date.now() && task.status !== 'ready'
                    return (
                      <div key={task.id} className={cn('flex items-center gap-4 px-6 py-4 cursor-pointer transition-colors hover:bg-muted/30', task.id === selectedId && 'bg-primary/5 border-r-2 border-primary', isOverdue && 'bg-red-50/30')} onClick={() => setSelectedId(task.id)}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-sm font-bold">{task.orderNumber}</span>
                            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border', sl?.color)}>{sl?.label}</span>
                            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', pl?.color)}>{pl?.label}</span>
                            {isOverdue && <span className="flex items-center gap-1 text-[10px] text-red-600 font-medium"><AlertTriangle className="h-3 w-3" />متأخر</span>}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><User className="h-3 w-3" />{task.customer}</span>
                            <span className="flex items-center gap-1"><Package className="h-3 w-3" />{task.items.length} أصناف</span>
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{task.warehouse}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-3">
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden flex-1 max-w-[300px]">
                              <div className={cn('h-full rounded-full transition-all', overallPct >= 100 ? 'bg-green-500' : 'bg-primary')} style={{ width: `${overallPct}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{totalPicked}/{totalQty}</span>
                          </div>
                        </div>
                        <div className="text-left shrink-0">
                          <p className="text-[10px] text-muted-foreground">{formatDate(task.dueDate)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-card px-6 py-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Package className="h-3 w-3" />{tasks.length} مهمة</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{tasks.filter((t) => t.status === 'ready').length} جاهزة</span>
            <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{tasks.filter((t) => t.dueDate < Date.now() && t.status !== 'ready').length} متأخرة</span>
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{Object.keys(groupedByZone).length} منطقة</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setAuditOpen(true)}><Shield className="h-3 w-3" />سجل التدقيق</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><Printer className="h-3 w-3" />طباعة</Button>
          </div>
        </div>
      </div>

      <AuditOverlay
        entries={auditEntries}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        entityId={selectedId ?? undefined}
        entityType="مهمة تجهيز"
      />
    </WorkbenchShell>
  )
}

const warehouseZones = [
  { name: 'منطقة أ', description: 'منتجات نهائية - مواد غذائية', bins: 'A01-A50' },
  { name: 'منطقة ب', description: 'منتجات نهائية - صناعية', bins: 'B01-B50' },
  { name: 'منطقة ج', description: 'مواد تعبئة وتغليف', bins: 'C01-C30' },
  { name: 'منطقة د', description: 'معدات وقطع غيار', bins: 'D01-D20' },
]

const pickMethods = [
  { id: 'wave', label: 'السحب الموجي', description: 'تجميع طلبات متعددة في موجة واحدة' },
  { id: 'single', label: 'السحب الفردي', description: 'سحب كل طلب على حدة' },
  { id: 'batch', label: 'السحب الدفعي', description: 'سحب أصناف متشابهة لعدة طلبات' },
  { id: 'zone', label: 'السحب المناطقي', description: 'توزيع السحب حسب المناطق' },
]

const packingMethods = [
  { id: 'standard', label: 'تعبئة قياسية', materials: 'كرتون - شريط لاصق' },
  { id: 'fragile', label: 'تعبئة مواد قابلة للكسر', materials: 'كرتون مموج - فقاعات هوائية' },
  { id: 'pallet', label: 'تعبئة على منصة نقالة', materials: 'منصة - شدادات' },
  { id: 'cold', label: 'تعبئة مواد مبردة', materials: 'صندوق عازل - ثلج جاف' },
]
