'use client'
import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { ShoppingCart, FileText, CheckCircle2, AlertTriangle, Clock, User, Search, Filter, ArrowUpDown, RefreshCw, Download, Printer, Plus, Eye, Edit3, X, Ban, Send, Sparkles, TrendingUp, TrendingDown, DollarSign, ArrowRight, PanelRightOpen, PanelRightClose, Loader2, MoreHorizontal, CheckSquare, Shield, MessageSquare, Paperclip, History, Truck, Building2, Package, ClipboardCheck, Percent, Scale, Users, Box } from 'lucide-react'
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
import { generateMockPurchaseOrders, generateMockSuppliers, generateMockInvoices, generateMockInventoryItems, generateMockValidationMessages, generateMockAIInsights, generateMockAuditTrail, generateMockDocuments, generateMockOperationalComments } from '@/lib/workbench/mock-data'
import type { PurchaseOrder, PurchaseOrderLine, ValidationMessage, AIInsight, WorkbenchMetric, InspectorTab } from '@/lib/workbench/types'

interface ReceivingLine {
  id: string
  item: string
  orderedQty: number
  previouslyReceived: number
  nowReceiving: number
  condition: 'جيد' | 'تالف'
  accepted: boolean
  location: string
}

const deliveryStatuses: Record<string, { label: string; color: string }> = {
  'قادم': { label: 'قادم', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  'في الطريق': { label: 'في الطريق', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  'متأخر': { label: 'متأخر', color: 'text-red-600 bg-red-50 border-red-200' },
  'مستلم': { label: 'مستلم', color: 'text-green-600 bg-green-50 border-green-200' },
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function StatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = deliveryStatuses[status] ?? { label: status, color: 'text-gray-600 bg-gray-100' }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border', cfg.color, className)}>
      {cfg.label}
    </span>
  )
}

const itemNames = [
  'مواد خام أ', 'مواد خام ب', 'عبوات كرتون', 'أكياس بلاستيك',
  'قطع غيار م أ', 'زيوت تشحيم', 'مذيبات كيميائية', 'فلاتر تهوية',
  'أحزمة نقل', 'صمامات تحكم', 'مواسير صلب', 'كوابل كهربائية',
]

const locations = ['A-01', 'A-02', 'B-01', 'B-02', 'C-01', 'مستودع عام']

function generateDeliveryLines(count: number): ReceivingLine[] {
  return Array.from({ length: count }, (_, i) => {
    const ordered = Math.floor(Math.random() * 150) + 20
    const prevReceived = Math.random() > 0.5 ? Math.floor(Math.random() * ordered * 0.5) : 0
    const nowReceiving = Math.floor(Math.random() * (ordered - prevReceived)) + 1
    const isDamaged = Math.random() > 0.85
    return {
      id: `rl-${i}`,
      item: itemNames[i % itemNames.length],
      orderedQty: ordered,
      previouslyReceived: prevReceived,
      nowReceiving,
      condition: isDamaged ? 'تالف' : 'جيد',
      accepted: !isDamaged,
      location: locations[Math.floor(Math.random() * locations.length)],
    }
  })
}

interface DeliveryData {
  id: string
  poNumber: string
  supplier: string
  itemCount: number
  expectedDate: number
  status: string
  orderDate: number
  lines: ReceivingLine[]
}

function generateMockDeliveries(count: number): DeliveryData[] {
  const supplierNames = [
    'مؤسسة البناء الحديث', 'شركة التوريدات الصناعية', 'مصنع الرياض للحديد',
    'شركة الخليج للخدمات', 'مجموعة الفهد التجارية', 'مؤسسة الجزيرة للتجارة',
    'شركة الواحة للإمدادات', 'الشركة السعودية للطاقة',
  ]
  const statuses = ['قادم', 'في الطريق', 'متأخر', 'مستلم']
  return Array.from({ length: count }, (_, i) => {
    const lineCount = Math.floor(Math.random() * 4) + 2
    return {
      id: `del-${i}`,
      poNumber: `PO-${String(1001 + i).padStart(4, '0')}`,
      supplier: supplierNames[i % supplierNames.length],
      itemCount: lineCount,
      expectedDate: Date.now() + (i < 3 ? -i * 86400000 : (i - 2) * 86400000),
      status: statuses[i % statuses.length],
      orderDate: Date.now() - (10 + i * 3) * 86400000,
      lines: generateDeliveryLines(lineCount),
    }
  })
}

export function ReceivingWorkbench() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('الكل')
  const [editingLines, setEditingLines] = useState<Record<string, Partial<ReceivingLine>>>({})
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [inspectorTab, setInspectorTab] = useState('info')
  const [validationDismissed, setValidationDismissed] = useState<Record<string, boolean>>({})
  const [aiOpen, setAiOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)

  const allDeliveries = useMemo(() => generateMockDeliveries(12), [])
  const allMockMessages = useMemo(() => generateMockValidationMessages('procurement'), [])
  const allAIInsights = useMemo(() => generateMockAIInsights('procurement'), [])
  const allAuditEntries = useMemo(() => generateMockAuditTrail(), [])
  const allComments = useMemo(() => generateMockOperationalComments(), [])

  const incomingCount = allDeliveries.filter((d) => d.status === 'قادم' || d.status === 'في الطريق').length
  const receivedToday = allDeliveries.filter((d) => d.status === 'مستلم' && d.expectedDate > Date.now() - 86400000).length
  const pendingInspection = allDeliveries.filter((d) => d.status === 'مستلم').length
  const overdueCount = allDeliveries.filter((d) => d.status === 'متأخر').length

  const metrics: WorkbenchMetric[] = [
    { id: 'm1', label: 'شحنات قادمة', value: incomingCount, icon: 'Truck', severity: 'info' },
    { id: 'm2', label: 'تم الاستلام اليوم', value: receivedToday, icon: 'Package', severity: 'success' },
    { id: 'm3', label: 'بانتظار الفحص', value: pendingInspection, icon: 'ClipboardCheck', severity: 'info' },
    { id: 'm4', label: 'متأخرة عن الموعد', value: overdueCount, icon: 'AlertTriangle', severity: overdueCount > 0 ? 'warning' : 'success' },
  ]

  const statusFilters = ['الكل', 'قادم', 'في الطريق', 'متأخر', 'مستلم']

  const filteredDeliveries = useMemo(() => {
    let list = [...allDeliveries]
    if (statusFilter !== 'الكل') list = list.filter((d) => d.status === statusFilter)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((d) => d.poNumber.toLowerCase().includes(q) || d.supplier.toLowerCase().includes(q))
    }
    return list
  }, [allDeliveries, statusFilter, searchQuery])

  const selectedDelivery = useMemo(() => {
    if (!selectedId) return null
    return allDeliveries.find((d) => d.id === selectedId) ?? null
  }, [selectedId, allDeliveries])

  const lines = selectedDelivery?.lines ?? []

  const handleLineEdit = (lineId: string, updates: Partial<ReceivingLine>) => {
    setEditingLines((prev) => ({ ...prev, [lineId]: { ...(prev[lineId] ?? {}), ...updates } }))
  }

  const totalNowReceiving = lines.reduce((sum, l) => {
    const edited = editingLines[l.id]
    return sum + (edited.nowReceiving ?? l.nowReceiving)
  }, 0)

  const totalRejected = lines.filter((l) => {
    const edited = editingLines[l.id]
    const accepted = edited.accepted ?? l.accepted
    return !accepted
  }).length

  const acceptedLines = lines.filter((l) => {
    const edited = editingLines[l.id]
    return edited.accepted ?? l.accepted
  }).length

  const qualityPct = lines.length > 0 ? Math.round((acceptedLines / lines.length) * 100) : 0

  const activeMessages = useMemo(() => {
    const msgs = [...allMockMessages]
    if (selectedDelivery) {
      lines.forEach((l) => {
        const edited = editingLines[l.id]
        const receiving = edited.nowReceiving ?? l.nowReceiving
        const maxAllowed = l.orderedQty - l.previouslyReceived + Math.round(l.orderedQty * 0.1)
        if (receiving > maxAllowed) {
          msgs.push({
            id: `over-${l.id}`,
            type: 'error',
            message: `استلام زائد للصنف "${l.item}" - الكمية المسموحة ${maxAllowed}`,
            field: 'الكمية',
            action: { label: 'تصحيح', handler: () => {} },
          })
        }
      })
    }
    return msgs
  }, [allMockMessages, selectedDelivery, lines, editingLines])

  const handleDismissValidation = useCallback((id: string) => {
    setValidationDismissed((prev) => ({ ...prev, [id]: true }))
  }, [])

  const inspectorTabs: InspectorTab[] = [
    { id: 'info', label: 'تحليل الاستلام', icon: 'info' },
    { id: 'activity', label: 'سجل الاستلام', icon: 'activity' },
    { id: 'file', label: 'مستندات', icon: 'file' },
  ]

  function getTabContent(tab: string) {
    switch (tab) {
      case 'info':
        return (
          <div className="space-y-3">
            <div className="rounded-lg border bg-card p-4">
              <h4 className="text-sm font-semibold mb-3">تحليل الاستلام</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>نسبة الاستلام</span>
                    <span>{lines.length > 0 ? Math.round((acceptedLines / lines.length) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', qualityPct >= 90 ? 'bg-green-500' : qualityPct >= 70 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${qualityPct}%` }} />
                  </div>
                </div>
                <div className="pt-2 border-t space-y-1">
                  <div className="flex justify-between"><span>عدد الأصناف</span><span>{lines.length}</span></div>
                  <div className="flex justify-between"><span>المقبول</span><span className="text-green-600">{acceptedLines}</span></div>
                  <div className="flex justify-between"><span>المرفوض</span><span className="text-red-600">{totalRejected}</span></div>
                </div>
              </div>
            </div>
          </div>
        )
      case 'activity':
        return (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold mb-2">سجل الاستلام</h4>
            {allDeliveries.filter((d) => d.status === 'مستلم').slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{d.poNumber}</p>
                  <p className="text-xs text-muted-foreground">{d.supplier}</p>
                </div>
                <span className="text-xs text-green-600">{formatDate(d.expectedDate)}</span>
              </div>
            ))}
          </div>
        )
      case 'file':
        return (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold mb-2">المستندات المرفقة</h4>
            {generateMockDocuments().map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer hover:bg-accent transition-colors">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{doc.uploadedBy}</p>
                </div>
              </div>
            ))}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <WorkbenchShell
      title="منصة استلام البضائع"
      description="إدارة عمليات استلام البضائع والفحص"
      breadcrumbs={[
        { label: 'المشتريات' },
        { label: 'استلام البضائع' },
      ]}
      metrics={metrics}
      actions={[
        { id: 'a1', label: 'استلام الكل', type: 'primary', icon: 'CheckCircle2', handler: () => {} },
        { id: 'a2', label: 'تأكيد الاستلام', type: 'secondary', icon: 'ClipboardCheck', handler: () => {} },
        { id: 'a3', label: 'طباعة إذن استلام', type: 'ghost', icon: 'Printer', handler: () => {} },
        { id: 'a4', label: 'المساعد الذكي', type: 'ghost', icon: 'Sparkles', handler: () => setAiOpen(!aiOpen) },
      ]}
      inspectorTabs={inspectorTabs}
      inspectorContent={getTabContent(inspectorTab)}
      inspectorOpen={inspectorOpen}
      onInspectorToggle={setInspectorOpen}
      inspectorTab={inspectorTab}
      onInspectorTabChange={setInspectorTab}
      validationBar={
        <RealtimeValidationBar
          messages={activeMessages.filter((m) => !validationDismissed[m.id])}
          onDismiss={handleDismissValidation}
        />
      }
      aiPanel={
        aiOpen && (
          <div className="fixed inset-y-0 left-0 z-40 w-[420px] border-l shadow-xl bg-background">
            <AIAssistancePanel
              open={true}
              onClose={() => setAiOpen(false)}
              domain="procurement"
              insights={allAIInsights}
            />
          </div>
        )
      }
    >
      <div className="flex h-full" dir="rtl">
        <div className="w-[420px] border-l flex flex-col shrink-0 bg-card">
          <div className="p-3 border-b">
            <div className="flex gap-1 mb-3 flex-wrap">
              {statusFilters.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                    statusFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث عن شحنة..."
                className="flex h-9 w-full rounded-lg border border-input bg-background pr-9 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredDeliveries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Truck className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">عند عدم وجود بيانات</p>
                <Button variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={() => { setStatusFilter('الكل'); setSearchQuery('') }}>
                  إعادة تعيين التصفية
                </Button>
              </div>
            ) : (
              filteredDeliveries.map((del) => {
                const isSelected = del.id === selectedId
                const isOverdue = del.status === 'متأخر'
                return (
                  <button
                    key={del.id}
                    type="button"
                    onClick={() => setSelectedId(del.id)}
                    className={cn(
                      'w-full text-right p-4 border-b hover:bg-muted/30 transition-colors',
                      isSelected && 'bg-primary/5 border-r-2 border-r-primary',
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{del.poNumber}</span>
                      <StatusBadge status={del.status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Building2 className="h-3 w-3" />
                      <span>{del.supplier}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {del.itemCount} صنف
                      </span>
                      <span className={cn('flex items-center gap-1', isOverdue && 'text-red-600 font-medium')}>
                        <Clock className="h-3 w-3" />
                        {formatDate(del.expectedDate)}
                        {isOverdue && '(متأخر)'}
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-background">
          {!selectedDelivery ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Truck className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">اختر شحنة من القائمة</p>
              <p className="text-sm text-muted-foreground mt-1">لبدء عملية استلام البضائع</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold">{selectedDelivery.poNumber}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{selectedDelivery.supplier}</p>
                  </div>
                  <StatusBadge status={selectedDelivery.status} className="text-sm px-3 py-1" />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">تاريخ الطلب</span>
                    <p className="font-medium">{formatDate(selectedDelivery.orderDate)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">تاريخ التسليم المتوقع</span>
                    <p className={cn('font-medium', selectedDelivery.status === 'متأخر' && 'text-red-600')}>
                      {formatDate(selectedDelivery.expectedDate)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-card">
                <div className="flex items-center gap-2 px-5 py-3 border-b bg-muted/20">
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">شاشة الاستلام</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/10">
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الصنف</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الكمية المطلوبة</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">المستلم سابقاً</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الاستلام الآن</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الحالة</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">قبول/رفض</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">موقع التخزين</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => {
                        const edited = editingLines[line.id] ?? {}
                        const nowReceiving = edited.nowReceiving ?? line.nowReceiving
                        const condition = edited.condition ?? line.condition
                        const accepted = edited.accepted ?? line.accepted
                        const location = edited.location ?? line.location
                        const maxAllowed = line.orderedQty - line.previouslyReceived + Math.round(line.orderedQty * 0.1)
                        const isOverReceipt = nowReceiving > maxAllowed
                        return (
                          <tr key={line.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-medium">{line.item}</td>
                            <td className="px-4 py-3">{line.orderedQty}</td>
                            <td className="px-4 py-3">{line.previouslyReceived}</td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={nowReceiving}
                                min={0}
                                max={line.orderedQty - line.previouslyReceived}
                                onChange={(e) => handleLineEdit(line.id, { nowReceiving: parseInt(e.target.value) || 0 })}
                                className={cn(
                                  'w-20 h-8 rounded border px-2 text-sm text-center',
                                  isOverReceipt ? 'border-red-300 bg-red-50' : 'border-input bg-background',
                                )}
                              />
                              {isOverReceipt && <p className="text-[10px] text-red-500 mt-0.5">تجاوز المسموح</p>}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={condition}
                                onChange={(e) => handleLineEdit(line.id, { condition: e.target.value as 'جيد' | 'تالف' })}
                                className="h-8 rounded border border-input bg-background px-2 text-sm"
                              >
                                <option value="جيد">جيد</option>
                                <option value="تالف">تالف</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleLineEdit(line.id, { accepted: true })}
                                  className={cn(
                                    'px-2 py-1 rounded text-xs font-medium transition-colors',
                                    accepted ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground',
                                  )}
                                >
                                  قبول
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleLineEdit(line.id, { accepted: false })}
                                  className={cn(
                                    'px-2 py-1 rounded text-xs font-medium transition-colors',
                                    !accepted ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground',
                                  )}
                                >
                                  رفض
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={location}
                                onChange={(e) => handleLineEdit(line.id, { location: e.target.value })}
                                className="h-8 rounded border border-input bg-background px-2 text-sm"
                              >
                                {locations.map((loc) => (
                                  <option key={loc} value={loc}>{loc}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/20 border-t-2">
                        <td className="px-4 py-3 font-medium" colSpan={3}>الإجمالي</td>
                        <td className="px-4 py-3 font-medium">{totalNowReceiving}</td>
                        <td className="px-4 py-3" colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border bg-card p-5 text-center">
                  <span className="text-2xl font-bold text-green-600">{acceptedLines}</span>
                  <p className="text-xs text-muted-foreground mt-1">عدد المقبول</p>
                </div>
                <div className="rounded-xl border bg-card p-5 text-center">
                  <span className="text-2xl font-bold text-red-600">{totalRejected}</span>
                  <p className="text-xs text-muted-foreground mt-1">عدد المرفوض</p>
                </div>
                <div className="rounded-xl border bg-card p-5 text-center">
                  <span className={cn('text-2xl font-bold', qualityPct >= 90 ? 'text-green-600' : qualityPct >= 70 ? 'text-amber-600' : 'text-red-600')}>
                    {qualityPct}%
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">نسبة الجودة</p>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">مرفقات إذن التسليم</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
                    <Paperclip className="h-4 w-4" />
                    إرفاق مذكرة تسليم
                  </Button>
                  {generateMockDocuments().slice(0, 2).map((doc) => (
                    <div key={doc.id} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-muted/30 text-xs cursor-pointer hover:bg-accent transition-colors">
                      <FileText className="h-3.5 w-3.5" />
                      <span>{doc.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Box className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">موقع التخزين</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="أدخل موقع التخزين..."
                    className="flex h-9 w-64 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Button variant="outline" size="sm" className="h-9 text-xs">تطبيق للكل</Button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 pb-4 flex-wrap">
                <Button className="h-9 text-xs gap-1.5"><CheckCircle2 className="h-4 w-4" />استلام الكل</Button>
                <Button variant="secondary" className="h-9 text-xs gap-1.5"><Package className="h-4 w-4" />استلام جزئي</Button>
                <Button variant="destructive" className="h-9 text-xs gap-1.5"><X className="h-4 w-4" />رفض الكل</Button>
                <Button variant="outline" className="h-9 text-xs gap-1.5"><Printer className="h-4 w-4" />طباعة إذن استلام</Button>
                <Button variant="default" className="h-9 text-xs gap-1.5"><ClipboardCheck className="h-4 w-4" />تأكيد الاستلام</Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setAuditOpen(true)} title="سجل التدقيق">
                  <Shield className="h-4 w-4" />
                </Button>
              </div>

              {commentsOpen && (
                <div className="rounded-xl border bg-card">
                  <OperationalCommenting comments={allComments} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AuditOverlay
        entries={allAuditEntries}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        entityId={selectedDelivery?.id}
        entityType="استلام"
      />
    </WorkbenchShell>
  )
}
