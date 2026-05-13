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

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'مسودة', color: 'text-gray-600 bg-gray-100 border-gray-300' },
  pending: { label: 'قيد الانتظار', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  approved: { label: 'مؤكد', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  shipped: { label: 'تم الشحن', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  invoiced: { label: 'تم الفوترة', color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  closed: { label: 'مغلق', color: 'text-green-600 bg-green-50 border-green-200' },
  cancelled: { label: 'ملغي', color: 'text-red-600 bg-red-50 border-red-200' },
}

const pipelineStages = [
  { key: 'draft', label: 'جديد' },
  { key: 'pending', label: 'قيد التأكيد' },
  { key: 'approved', label: 'قيد التجهيز' },
  { key: 'shipped', label: 'تم التعبئة' },
  { key: 'invoiced', label: 'تم الشحن' },
  { key: 'closed', label: 'فوترة' },
]

const orderStatusOrder: Record<string, number> = {
  draft: 0, pending: 1, approved: 2, shipped: 3, invoiced: 4, closed: 5, cancelled: -1,
}

function getPipelineProgress(status: string): number {
  const idx = orderStatusOrder[status]
  if (idx === undefined || idx < 0) return 0
  return Math.round((idx / 5) * 100)
}

function calculateOrderMetrics(orders: SalesOrder[]) {
  const open = orders.filter((o) => o.status === 'draft' || o.status === 'pending').length
  const processing = orders.filter((o) => o.status === 'approved').length
  const readyToShip = orders.filter((o) => o.status === 'shipped').length
  const overdue = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'closed' && o.expectedDate < Date.now()).length
  const todayCount = orders.filter((o) => {
    const d = new Date(o.date)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  }).length
  return { open, processing, readyToShip, overdue, todayCount }
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ar-SA')
}

export function OrderOpsCenter() {
  const [orders] = useState<SalesOrder[]>(() => generateMockSalesOrders(25))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [activeInspectorTab, setActiveInspectorTab] = useState('info')
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [validations, setValidations] = useState<ValidationMessage[]>(() => generateMockValidationMessages('sales'))
  const [aiInsights] = useState<AIInsight[]>(() => generateMockAIInsights('sales'))
  const [auditEntries] = useState<AuditTrailEntry[]>(() => generateMockAuditTrail())
  const [comments] = useState<OperationalComment[]>(() => generateMockOperationalComments())

  const metrics: WorkbenchMetric[] = useMemo(() => {
    const m = calculateOrderMetrics(orders)
    return [
      { id: 'open', label: 'طلبات مفتوحة', value: m.open, change: 12, trend: 'up', icon: 'ShoppingCart', severity: 'info' },
      { id: 'processing', label: 'قيد التجهيز', value: m.processing, change: -5, trend: 'down', icon: 'Package', severity: 'info' },
      { id: 'ready', label: 'جاهز للشحن', value: m.readyToShip, change: 8, trend: 'up', icon: 'Truck', severity: 'success' },
      { id: 'overdue', label: 'متأخرة', value: m.overdue, change: 3, trend: 'up', icon: 'AlertTriangle', severity: 'critical' },
      { id: 'today', label: 'طلبات اليوم', value: m.todayCount, change: 0, trend: 'up', icon: 'Clock', severity: 'info' },
    ]
  }, [orders])

  const filteredOrders = useMemo(() => {
    let result = [...orders]
    if (statusFilter !== 'all') {
      result = result.filter((o) => o.status === statusFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (o) => o.number.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q),
      )
    }
    return result.sort((a, b) => b.date - a.date)
  }, [orders, statusFilter, searchQuery])

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedId) ?? null,
    [orders, selectedId],
  )

  const inspectorTabs: InspectorTab[] = useMemo(
    () => [
      { id: 'info', label: 'معلومات الطلب', icon: 'info', badge: selectedOrder?.items.length },
      { id: 'activity', label: 'النشاط', icon: 'activity' },
      { id: 'file', label: 'المستندات', icon: 'file', badge: 2 },
      { id: 'message', label: 'التعليقات', icon: 'message', badge: comments.length },
    ],
    [selectedOrder, comments],
  )

  const actions: WorkbenchAction[] = useMemo(
    () => [
      { id: 'new-order', label: 'طلب جديد', type: 'primary', icon: 'Plus', handler: () => {} },
      { id: 'refresh', label: 'تحديث', type: 'secondary', icon: 'RefreshCw', handler: () => {} },
      { id: 'export', label: 'تصدير', type: 'ghost', icon: 'Download', handler: () => {} },
    ],
    [],
  )

  const handleDismissValidation = useCallback((id: string) => {
    setValidations((prev) => prev.filter((v) => v.id !== id))
  }, [])

  const handleClearFilter = useCallback(() => {
    setStatusFilter('all')
    setSearchQuery('')
  }, [])

  const orderCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length }
    for (const o of orders) {
      counts[o.status] = (counts[o.status] ?? 0) + 1
    }
    return counts
  }, [orders])

  const statusFilters = [
    { key: 'all', label: 'الكل' },
    { key: 'draft', label: 'مسودة' },
    { key: 'pending', label: 'قيد الانتظار' },
    { key: 'approved', label: 'مؤكد' },
    { key: 'shipped', label: 'تم الشحن' },
    { key: 'invoiced', label: 'فوترة' },
    { key: 'closed', label: 'مغلق' },
    { key: 'cancelled', label: 'ملغي' },
  ]

  return (
    <WorkbenchShell
      title="مركز عمليات المبيعات"
      description="إدارة طلبات المبيعات وتتبع مسار التنفيذ"
      breadcrumbs={[
        { label: 'المبيعات', icon: ShoppingCart },
        { label: 'مركز العمليات' },
      ]}
      metrics={metrics}
      actions={actions}
      inspectorTabs={inspectorTabs}
      inspectorOpen={inspectorOpen}
      onInspectorToggle={setInspectorOpen}
      inspectorTab={activeInspectorTab}
      onInspectorTabChange={setActiveInspectorTab}
      inspectorContent={
        selectedOrder ? (
          <>
            {activeInspectorTab === 'info' && (
              <div className="space-y-4">
                <div className="rounded-xl border p-4">
                  <h4 className="text-sm font-semibold mb-3">تفاصيل الطلب</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">الرقم:</span> <span className="font-medium">{selectedOrder.number}</span></div>
                    <div><span className="text-muted-foreground">العميل:</span> <span className="font-medium">{selectedOrder.customer}</span></div>
                    <div><span className="text-muted-foreground">التاريخ:</span> <span className="font-medium">{formatDate(selectedOrder.date)}</span></div>
                    <div><span className="text-muted-foreground">المبلغ:</span> <span className="font-medium">{formatCurrency(selectedOrder.amount)} ر.س</span></div>
                    <div><span className="text-muted-foreground">تاريخ التسليم:</span> <span className="font-medium">{formatDate(selectedOrder.expectedDate)}</span></div>
                    <div>
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', statusLabels[selectedOrder.status]?.color)}>
                        {statusLabels[selectedOrder.status]?.label}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border p-4">
                  <h4 className="text-sm font-semibold mb-3">بنود الطلب ({selectedOrder.items.length})</h4>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.item}</p>
                          <p className="text-xs text-muted-foreground">الكمية: {item.quantity} | السعر: {formatCurrency(item.unitPrice)} ر.س</p>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold">{formatCurrency(item.amount)} ر.س</p>
                          <p className="text-xs text-muted-foreground">تم الشحن: {item.shipped}/{item.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border p-4">
                  <h4 className="text-sm font-semibold mb-3">مسار الطلب</h4>
                  <div className="relative">
                    <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                      <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${getPipelineProgress(selectedOrder.status)}%` }} />
                    </div>
                    <div className="flex justify-between">
                      {pipelineStages.map((stage, idx) => {
                        const currentIdx = orderStatusOrder[selectedOrder.status] ?? -1
                        const completed = idx <= currentIdx
                        const isCurrent = idx === currentIdx
                        return (
                          <div key={stage.key} className="flex flex-col items-center gap-1">
                            <div className={cn('w-3 h-3 rounded-full border-2', completed ? 'bg-primary border-primary' : 'bg-background border-muted-foreground/30', isCurrent && 'ring-2 ring-primary/30')} />
                            <span className={cn('text-[10px] whitespace-nowrap', completed ? 'text-primary font-medium' : 'text-muted-foreground')}>{stage.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border p-4">
                  <h4 className="text-sm font-semibold mb-3">الإجراءات السريعة</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrder.status === 'draft' && (
                      <Button size="sm" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" />تأكيد الطلب</Button>
                    )}
                    {selectedOrder.status === 'pending' && (
                      <Button size="sm" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" />اعتماد</Button>
                    )}
                    {selectedOrder.status === 'approved' && (
                      <Button size="sm" className="gap-1"><Package className="h-3.5 w-3.5" />تجهيز للشحن</Button>
                    )}
                    {selectedOrder.status === 'shipped' && (
                      <Button size="sm" className="gap-1"><FileText className="h-3.5 w-3.5" />إنشاء فاتورة</Button>
                    )}
                    {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'closed' && (
                      <>
                        <Button size="sm" variant="secondary" className="gap-1"><Ban className="h-3.5 w-3.5" />تعليق</Button>
                        <Button size="sm" variant="destructive" className="gap-1"><X className="h-3.5 w-3.5" />إلغاء</Button>
                      </>
                    )}
                    <Button size="sm" variant="secondary" className="gap-1"><Printer className="h-3.5 w-3.5" />طباعة</Button>
                    <Button size="sm" variant="secondary" className="gap-1"><Send className="h-3.5 w-3.5" />إرسال للعميل</Button>
                  </div>
                </div>
              </div>
            )}
            {activeInspectorTab === 'message' && (
              <OperationalCommenting comments={comments} />
            )}
            {activeInspectorTab === 'activity' && (
              <div className="flex items-center justify-center py-16 text-center">
                <Clock className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">سجل النشاط قيد التطوير</p>
              </div>
            )}
            {activeInspectorTab === 'file' && (
              <div className="space-y-2">
                {generateMockDocuments().map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{(doc.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null
      }
      validationBar={
        <RealtimeValidationBar messages={validations} onDismiss={handleDismissValidation} />
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
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم الطلب أو اسم العميل..."
                className="flex h-9 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {statusFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors',
                    statusFilter === f.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {f.label}
                  <span className="mr-1.5 text-[10px] opacity-70">({orderCounts[f.key] ?? 0})</span>
                </button>
              ))}
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setAiPanelOpen(!aiPanelOpen)} title="المساعدة بالذكاء الاصطناعي">
              <Sparkles className={cn('h-4 w-4', aiPanelOpen && 'text-primary')} />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <ShoppingCart className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-semibold mb-1">لا توجد طلبات</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all' ? 'لا توجد نتائج للبحث المحدد' : 'لم يتم إنشاء أي طلبات مبيعات بعد'}
              </p>
              {(searchQuery || statusFilter !== 'all') && (
                <Button variant="outline" size="sm" onClick={handleClearFilter}>مسح التصفية</Button>
              )}
              {!searchQuery && statusFilter === 'all' && (
                <Button className="gap-1"><Plus className="h-4 w-4" />إنشاء طلب جديد</Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredOrders.map((order) => {
                const sl = statusLabels[order.status]
                const isSelected = order.id === selectedId
                const pipelinePct = getPipelineProgress(order.status)
                return (
                  <div
                    key={order.id}
                    className={cn(
                      'flex items-center gap-4 px-6 py-4 cursor-pointer transition-colors hover:bg-muted/30',
                      isSelected && 'bg-primary/5 border-r-2 border-primary',
                    )}
                    onClick={() => setSelectedId(order.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-bold">{order.number}</span>
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border', sl?.color)}>
                          {sl?.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{order.customer}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(order.date)}</span>
                        <span className="flex items-center gap-1"><Package className="h-3 w-3" />{order.items.length} أصناف</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden max-w-[200px]">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pipelinePct}%` }} />
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="text-sm font-bold">{formatCurrency(order.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">ر.س</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => { e.stopPropagation(); setSelectedId(order.id) }}>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-card px-6 py-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" />{orders.length} طلب</span>
            <span className="flex items-center gap-1">{formatCurrency(orders.reduce((s, o) => s + o.amount, 0))} ر.س</span>
            <span className={cn('flex items-center gap-1', orders.filter((o) => o.status === 'cancelled').length > 0 && 'text-red-600')}>
              <X className="h-3 w-3" />{orders.filter((o) => o.status === 'cancelled').length} ملغي
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setAuditOpen(true)}><Shield className="h-3 w-3" />سجل التدقيق</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><Download className="h-3 w-3" />تصدير</Button>
          </div>
        </div>
      </div>

      <AuditOverlay
        entries={auditEntries}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        entityId={selectedId ?? undefined}
        entityType="أمر مبيعات"
      />
    </WorkbenchShell>
  )
}

const orderPriorities = [
  { value: 'normal', label: 'عادي', color: 'bg-blue-500' },
  { value: 'high', label: 'عالٍ', color: 'bg-amber-500' },
  { value: 'urgent', label: 'عاجل', color: 'bg-red-500' },
]

const paymentTermsOptions = [
  { value: 'cash', label: 'نقداً' },
  { value: '30days', label: '30 يوم' },
  { value: '60days', label: '60 يوم' },
  { value: '90days', label: '90 يوم' },
]


