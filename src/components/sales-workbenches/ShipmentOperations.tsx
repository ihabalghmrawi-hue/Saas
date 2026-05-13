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
import type { ValidationMessage, AIInsight, AuditTrailEntry, OperationalComment, InspectorTab, WorkbenchMetric, WorkbenchAction } from '@/lib/workbench/types'

interface Shipment {
  id: string
  trackingNumber: string
  orderNumber: string
  carrier: string
  carrierCode: string
  destination: string
  status: 'label_created' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'delayed' | 'exception'
  estimatedDelivery: number
  actualDelivery?: number
  weight: number
  packages: number
  cost: number
  createdAt: number
  trackingHistory: TrackingEvent[]
}

interface TrackingEvent {
  id: string
  timestamp: number
  location: string
  status: string
  description: string
}

const statusLabels: Record<string, { label: string; color: string }> = {
  label_created: { label: 'تم إنشاء البطاقة', color: 'text-gray-600 bg-gray-100 border-gray-300' },
  picked_up: { label: 'تم الاستلام', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  in_transit: { label: 'قيد النقل', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  out_for_delivery: { label: 'خرج للتسليم', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  delivered: { label: 'تم التسليم', color: 'text-green-600 bg-green-50 border-green-200' },
  delayed: { label: 'متأخر', color: 'text-red-600 bg-red-50 border-red-200' },
  exception: { label: 'استثناء', color: 'text-rose-600 bg-rose-50 border-rose-200' },
}

const carriers = [
  { name: 'البريد السعودي', code: 'SaudiPost' },
  { name: 'دي إتش إل', code: 'DHL' },
  { name: 'فيديكس', code: 'FedEx' },
  { name: 'أرامكس', code: 'Aramex' },
]

const destinations = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة', 'الخبر', 'تبوك', 'أبها', 'حائل', 'القصيم']

const trackingDescriptions = [
  'تم استلام الشحنة في مركز الفرز', 'الشحنة قيد المعالجة', 'غادرت الشحنة مركز التوزيع',
  'الشحنة في طريقها إلى مركز الفرز', 'تم تحميل الشحنة على الشاحنة', 'وصلت الشحنة إلى مركز التوزيع', 'جاري التوصيل إلى العنوان',
]

function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min }

function randomChoice<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

function randomDate(daysAgo: number): number { return Date.now() - randomInt(0, daysAgo * 86400000) }

function generateMockShipments(count: number): Shipment[] {
  return Array.from({ length: count }, (_, idx) => {
    const carrier = randomChoice(carriers)
    const created = randomDate(14)
    const estDelivery = created + randomInt(2, 7) * 86400000
    const statuses: Shipment['status'][] = ['label_created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'delayed', 'exception']
    const status = randomChoice(statuses)
    const numTrackingEvents = randomInt(2, 5)
    const trackingHistory: TrackingEvent[] = Array.from({ length: numTrackingEvents }, (_, ti) => ({
      id: `te-${idx}-${ti}`,
      timestamp: created + ti * 86400000 * 0.5,
      location: randomChoice(destinations),
      status: ['تم الاستلام', 'قيد المعالجة', 'في مركز الفرز', 'قيد النقل', 'خرج للتسليم'][ti] ?? 'قيد النقل',
      description: randomChoice(trackingDescriptions),
    }))
    return {
      id: `shp-${idx}`,
      trackingNumber: `${carrier.code.toUpperCase()}-${String(randomInt(1000000, 9999999))}-SA`,
      orderNumber: `SO-${String(idx + 1).padStart(4, '0')}`,
      carrier: carrier.name,
      carrierCode: carrier.code,
      destination: randomChoice(destinations),
      status,
      estimatedDelivery: estDelivery,
      actualDelivery: status === 'delivered' ? randomDate(0) : undefined,
      weight: randomInt(1, 50),
      packages: randomInt(1, 5),
      cost: randomInt(50, 500),
      createdAt: created,
      trackingHistory,
    }
  })
}

function formatDate(ts: number): string { return new Date(ts).toLocaleDateString('ar-SA') }

function formatCurrency(amount: number): string { return amount.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) }

export function ShipmentOperations() {
  const [shipments] = useState<Shipment[]>(() => generateMockShipments(20))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [carrierFilter, setCarrierFilter] = useState<string>('all')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [activeInspectorTab, setActiveInspectorTab] = useState('info')
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [validations] = useState<ValidationMessage[]>(() => generateMockValidationMessages('sales'))
  const [aiInsights] = useState<AIInsight[]>(() => generateMockAIInsights('sales'))
  const [auditEntries] = useState<AuditTrailEntry[]>(() => generateMockAuditTrail())
  const [comments] = useState<OperationalComment[]>(() => generateMockOperationalComments())

  const metrics: WorkbenchMetric[] = useMemo(() => {
    const pending = shipments.filter((s) => s.status === 'label_created' || s.status === 'picked_up').length
    const inTransit = shipments.filter((s) => s.status === 'in_transit' || s.status === 'out_for_delivery').length
    const deliveredToday = shipments.filter((s) => s.status === 'delivered' && s.actualDelivery && new Date(s.actualDelivery).toDateString() === new Date().toDateString()).length
    const delayed = shipments.filter((s) => s.status === 'delayed' || s.status === 'exception').length
    return [
      { id: 'pending', label: 'قيد الانتظار', value: pending, change: -10, trend: 'down', icon: 'Package', severity: 'info' },
      { id: 'in_transit', label: 'قيد النقل', value: inTransit, change: 18, trend: 'up', icon: 'Truck', severity: 'info' },
      { id: 'delivered', label: 'تم التسليم اليوم', value: deliveredToday, change: 25, trend: 'up', icon: 'CheckCircle2', severity: 'success' },
      { id: 'delayed', label: 'متأخرة', value: delayed, change: 5, trend: 'up', icon: 'AlertTriangle', severity: 'critical' },
    ]
  }, [shipments])

  const filteredShipments = useMemo(() => {
    let result = [...shipments]
    if (statusFilter !== 'all') result = result.filter((s) => s.status === statusFilter)
    if (carrierFilter !== 'all') result = result.filter((s) => s.carrierCode === carrierFilter)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((s) => s.trackingNumber.toLowerCase().includes(q) || s.orderNumber.toLowerCase().includes(q) || s.destination.toLowerCase().includes(q))
    }
    return result.sort((a, b) => b.createdAt - a.createdAt)
  }, [shipments, statusFilter, carrierFilter, searchQuery])

  const selectedShipment = useMemo(() => shipments.find((s) => s.id === selectedId) ?? null, [shipments, selectedId])

  const inspectorTabs: InspectorTab[] = useMemo(() => [
    { id: 'info', label: 'تفاصيل الشحنة', icon: 'info' },
    { id: 'activity', label: 'سجل التتبع', icon: 'activity', badge: selectedShipment?.trackingHistory.length },
    { id: 'message', label: 'التعليقات', icon: 'message', badge: comments.length },
  ], [selectedShipment, comments])

  const actions: WorkbenchAction[] = useMemo(() => [
    { id: 'create', label: 'شحنة جديدة', type: 'primary', icon: 'Plus', handler: () => {} },
    { id: 'refresh', label: 'تحديث', type: 'secondary', icon: 'RefreshCw', handler: () => {} },
    { id: 'export', label: 'تصدير', type: 'ghost', icon: 'Download', handler: () => {} },
  ], [])

  const statusFilters = [
    { key: 'all', label: 'الكل' }, { key: 'label_created', label: 'بطاقة' }, { key: 'picked_up', label: 'استلام' },
    { key: 'in_transit', label: 'نقل' }, { key: 'out_for_delivery', label: 'تسليم' }, { key: 'delivered', label: 'تم' },
    { key: 'delayed', label: 'متأخر' }, { key: 'exception', label: 'استثناء' },
  ]

  const carrierFilters = [
    { key: 'all', label: 'جميع الناقلين' },
    ...carriers.map((c) => ({ key: c.code, label: c.name })),
  ]

  return (
    <WorkbenchShell
      title="عمليات الشحن"
      description="تتبع وإدارة الشحنات عبر الناقلين المتعددين"
      breadcrumbs={[{ label: 'المبيعات', icon: ShoppingCart }, { label: 'الشحن' }]}
      metrics={metrics}
      actions={actions}
      inspectorTabs={inspectorTabs}
      inspectorOpen={inspectorOpen}
      onInspectorToggle={setInspectorOpen}
      inspectorTab={activeInspectorTab}
      onInspectorTabChange={setActiveInspectorTab}
      inspectorContent={selectedShipment ? (
        <>
          {activeInspectorTab === 'info' && (
            <div className="space-y-4">
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">معلومات الشحنة</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">رقم التتبع:</span> <span className="font-medium">{selectedShipment.trackingNumber}</span></div>
                  <div><span className="text-muted-foreground">أمر التوريد:</span> <span className="font-medium">{selectedShipment.orderNumber}</span></div>
                  <div><span className="text-muted-foreground">الناقل:</span> <span className="font-medium">{selectedShipment.carrier}</span></div>
                  <div><span className="text-muted-foreground">الوجهة:</span> <span className="font-medium">{selectedShipment.destination}</span></div>
                  <div><span className="text-muted-foreground">الوزن:</span> <span className="font-medium">{selectedShipment.weight} كجم</span></div>
                  <div><span className="text-muted-foreground">الطرود:</span> <span className="font-medium">{selectedShipment.packages}</span></div>
                  <div><span className="text-muted-foreground">تكلفة الشحن:</span> <span className="font-medium">{formatCurrency(selectedShipment.cost)} ر.س</span></div>
                  <div><span className="text-muted-foreground">التسليم المتوقع:</span> <span className="font-medium">{formatDate(selectedShipment.estimatedDelivery)}</span></div>
                  <div className="col-span-2">
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', statusLabels[selectedShipment.status]?.color)}>
                      {statusLabels[selectedShipment.status]?.label}
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">تفاصيل التوصيل</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{selectedShipment.destination}، المملكة العربية السعودية</span></div>
                  <div className="flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground" /><span>{selectedShipment.packages} طرد بوزن إجمالي {selectedShipment.weight} كجم</span></div>
                  <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span>تاريخ الشحن: {formatDate(selectedShipment.createdAt)}</span></div>
                  {selectedShipment.actualDelivery && (
                    <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /><span className="text-green-600">تم التسليم: {formatDate(selectedShipment.actualDelivery)}</span></div>
                  )}
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">معلومات الناقل</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground" /><span>{selectedShipment.carrier}</span></div>
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span>رقم التتبع: {selectedShipment.trackingNumber}</span></div>
                  <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" /><span>تكلفة الشحن: {formatCurrency(selectedShipment.cost)} ر.س</span></div>
                  <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /><span>تتبع عبر الموقع: {selectedShipment.carrierCode === 'SaudiPost' ? 'https://track.sp.com.sa' : selectedShipment.carrierCode === 'DHL' ? 'https://www.dhl.com' : 'https://www.fedex.com'}</span></div>
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">الإجراءات</h4>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="gap-1"><Printer className="h-3.5 w-3.5" />طباعة البطاقة</Button>
                  {selectedShipment.status !== 'delivered' && (
                    <Button size="sm" variant="secondary" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" />تحديث الحالة</Button>
                  )}
                  <Button size="sm" variant="secondary" className="gap-1"><Eye className="h-3.5 w-3.5" />تتبع الشحنة</Button>
                  <Button size="sm" variant="ghost" className="gap-1"><AlertTriangle className="h-3.5 w-3.5" />الإبلاغ عن مشكلة</Button>
                </div>
              </div>
            </div>
          )}
          {activeInspectorTab === 'activity' && (
            <div className="space-y-3">
              {selectedShipment.trackingHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Truck className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">لا توجد أحداث تتبع متاحة</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">أحداث التتبع ({selectedShipment.trackingHistory.length})</h4>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><RefreshCw className="h-3 w-3" />تحديث</Button>
                  </div>
                  {selectedShipment.trackingHistory.map((event, idx) => (
                    <div key={event.id} className="relative pr-6">
                      {idx < selectedShipment.trackingHistory.length - 1 && (
                        <div className="absolute right-2 top-4 bottom-0 w-0.5 bg-muted-foreground/20" />
                      )}
                      <div className={cn('absolute right-0 top-1 w-4 h-4 rounded-full border-2', idx === 0 ? 'bg-primary border-primary' : 'bg-background border-muted-foreground/30')} />
                      <div className={cn('pb-4 rounded-lg p-3', idx === 0 && 'bg-primary/5 border border-primary/10')}>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium">{event.status}</p>
                          {idx === 0 && <span className="text-[10px] text-primary font-medium">آخر تحديث</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3" /><span>{event.location}</span>
                          <Clock className="h-3 w-3 mr-1" /><span>{formatDate(event.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="mt-4 p-3 rounded-lg bg-muted/30 border text-center">
                    <p className="text-xs text-muted-foreground">آخر تحديث: {formatDate(selectedShipment.trackingHistory[0]?.timestamp ?? selectedShipment.createdAt)}</p>
                  </div>
                </>
              )}
            </div>
          )}
          {activeInspectorTab === 'message' && (
            <OperationalCommenting comments={comments} />
          )}
        </>
      ) : null}
      validationBar={<RealtimeValidationBar messages={validations} />}
      aiPanel={<AIAssistancePanel open={aiPanelOpen} onClose={() => setAiPanelOpen(false)} domain="sales" entityId={selectedId ?? undefined} insights={aiInsights} />}
      className="rtl"
    >
      <div className="flex flex-col h-full overflow-hidden">
        <div className="border-b bg-muted/30 px-6 py-2 shrink-0">
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">إجمالي الشحنات:</span>
              <span className="font-semibold">{shipments.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">إجمالي الوزن:</span>
              <span className="font-semibold">{shipments.reduce((s, sh) => s + sh.weight, 0)} كجم</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">تكلفة الشحن:</span>
              <span className="font-semibold">{formatCurrency(shipments.reduce((s, sh) => s + sh.cost, 0))} ر.س</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">الناقلون:</span>
              <span className="font-semibold">{new Set(shipments.map((s) => s.carrierCode)).size}</span>
            </div>
          </div>
        </div>
        <div className="border-b bg-card px-6 py-3 shrink-0">
          <div className="flex gap-3 items-center flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="بحث برقم التتبع أو الأمر..." className="flex h-9 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {carrierFilters.map((f) => (
                <button key={f.key} type="button" onClick={() => setCarrierFilter(f.key)} className={cn('px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors', carrierFilter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>{f.label}</button>
              ))}
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {statusFilters.slice(0, 5).map((f) => (
                <button key={f.key} type="button" onClick={() => setStatusFilter(f.key)} className={cn('px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors', statusFilter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>{f.label}</button>
              ))}
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setAiPanelOpen(!aiPanelOpen)}>
              <Sparkles className={cn('h-4 w-4', aiPanelOpen && 'text-primary')} />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredShipments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Truck className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-semibold mb-1">لا توجد شحنات</h3>
              <p className="text-sm text-muted-foreground">لم يتم العثور على شحنات تطابق معايير البحث</p>
              {(searchQuery || statusFilter !== 'all' || carrierFilter !== 'all') && (
                <Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setStatusFilter('all'); setCarrierFilter('all') }}>مسح التصفية</Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredShipments.map((shipment) => {
                const sl = statusLabels[shipment.status]
                const isSelected = shipment.id === selectedId
                const isDelayed = shipment.status === 'delayed' || shipment.status === 'exception'
                return (
                  <div key={shipment.id} className={cn('flex items-center gap-4 px-6 py-4 cursor-pointer transition-colors hover:bg-muted/30', isSelected && 'bg-primary/5 border-r-2 border-primary', isDelayed && 'bg-red-50/30')} onClick={() => setSelectedId(shipment.id)}>
                    <div className="flex items-center gap-3 shrink-0">
                      <Truck className={cn('h-8 w-8 p-1.5 rounded-lg', isDelayed ? 'text-red-500 bg-red-50' : 'text-primary bg-primary/10')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-bold">{shipment.trackingNumber}</span>
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border', sl?.color)}>{sl?.label}</span>
                        <span className="text-xs text-muted-foreground">{shipment.carrier}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{shipment.destination}</span>
                        <span className="flex items-center gap-1"><Package className="h-3 w-3" />{shipment.packages} طرود</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(shipment.estimatedDelivery)}</span>
                        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{formatCurrency(shipment.cost)} ر.س</span>
                      </div>
                      <div className="mt-2 flex items-center gap-1">
                        {['label_created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'].map((stage, sIdx) => {
                          const stageOrder = ['label_created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered']
                          const currentIdx = stageOrder.indexOf(shipment.status)
                          const completed = sIdx <= currentIdx
                          const isCurrent = sIdx === currentIdx
                          return (
                            <div key={stage} className="flex items-center">
                              <div className={cn('w-2 h-2 rounded-full', completed ? (shipment.status === 'delayed' || shipment.status === 'exception' ? 'bg-red-400' : 'bg-primary') : 'bg-muted-foreground/20', isCurrent && 'ring-2 ring-primary/30')} />
                              {sIdx < stageOrder.length - 1 && <div className={cn('w-4 h-0.5', completed ? (shipment.status === 'delayed' || shipment.status === 'exception' ? 'bg-red-400' : 'bg-primary') : 'bg-muted-foreground/20')} />}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <div className="text-left shrink-0"><p className="text-xs text-muted-foreground">{shipment.orderNumber}</p></div>
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
            <span className="flex items-center gap-1"><Truck className="h-3 w-3" />{shipments.length} شحنة</span>
            <span className="flex items-center gap-1"><Package className="h-3 w-3" />{shipments.reduce((s, sh) => s + sh.packages, 0)} طرد</span>
            <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{formatCurrency(shipments.reduce((s, sh) => s + sh.cost, 0))} ر.س</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setAuditOpen(true)}><Shield className="h-3 w-3" />سجل التدقيق</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><Download className="h-3 w-3" />تصدير</Button>
          </div>
        </div>
      </div>

      <AuditOverlay entries={auditEntries} open={auditOpen} onClose={() => setAuditOpen(false)} entityId={selectedId ?? undefined} entityType="شحنة" />
    </WorkbenchShell>
  )
}

const carrierOptions = [
  { id: '1', name: 'البريد السعودي (Saudi Post)', code: 'SP', deliveryDays: '3-5', coverage: 'جميع المناطق', maxWeight: '30 كجم', tracking: true, costRating: 'منخفضة' },
  { id: '2', name: 'دي إتش إل (DHL)', code: 'DHL', deliveryDays: '1-2', coverage: 'دولي', maxWeight: '70 كجم', tracking: true, costRating: 'عالية' },
  { id: '3', name: 'فيديكس (FedEx)', code: 'FX', deliveryDays: '1-3', coverage: 'دولي', maxWeight: '68 كجم', tracking: true, costRating: 'عالية' },
  { id: '4', name: 'أرامكس (Aramex)', code: 'AR', deliveryDays: '2-4', coverage: 'جميع المناطق', maxWeight: '50 كجم', tracking: true, costRating: 'متوسطة' },
]

const shipmentTypes = [
  { code: 'EXPRESS', label: 'شحن سريع', description: 'توصيل خلال 24 ساعة', multiplier: 1.5 },
  { code: 'STANDARD', label: 'شحن عادي', description: 'توصيل خلال 3-5 أيام', multiplier: 1.0 },
  { code: 'ECONOMY', label: 'شحن اقتصادي', description: 'توصيل خلال 5-7 أيام', multiplier: 0.7 },
  { code: 'SAME_DAY', label: 'نفس اليوم', description: 'توصيل خلال ساعات', multiplier: 2.0 },
]

const packageTypes = [
  { code: 'BOX', label: 'صندوق كرتون', maxWeight: '30 كجم', dimensions: 'متغير' },
  { code: 'PALLET', label: 'منصة نقالة', maxWeight: '1000 كجم', dimensions: '120x100 سم' },
  { code: 'ENVELOPE', label: 'ظرف', maxWeight: '1 كجم', dimensions: 'A4' },
  { code: 'DRUM', label: 'برميل', maxWeight: '200 كجم', dimensions: 'قطر 60 سم' },
]
