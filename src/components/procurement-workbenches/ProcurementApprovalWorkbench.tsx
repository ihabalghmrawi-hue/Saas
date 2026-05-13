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
import type { PurchaseOrder, ValidationMessage, AIInsight, WorkbenchMetric, InspectorTab } from '@/lib/workbench/types'

interface ApprovalItem {
  id: string
  reference: string
  type: 'أمر شراء' | 'عقد'
  supplier: string
  amount: number
  requester: string
  date: number
  slaEnd: number
  priority: 'منخفض' | 'متوسط' | 'عالي' | 'عاجل'
  status: 'بانتظار الاعتماد' | 'معتمد' | 'مرفوض'
  description: string
  category: string
  budgetCode: string
  budgetAvailable: number
  budgetRequested: number
}

interface ApprovalChainEntry {
  step: number
  name: string
  role: string
  status: 'معتمد' | 'معلق' | 'لم يراجع بعد'
  timestamp?: number
  comment?: string
}

const priorityColors: Record<string, string> = {
  'منخفض': 'bg-gray-100 text-gray-600',
  'متوسط': 'bg-blue-100 text-blue-600',
  'عالي': 'bg-amber-100 text-amber-600',
  'عاجل': 'bg-red-100 text-red-600',
}

const approvalStatusColors: Record<string, string> = {
  'بانتظار الاعتماد': 'text-amber-600 bg-amber-50 border-amber-200',
  'معتمد': 'text-green-600 bg-green-50 border-green-200',
  'مرفوض': 'text-red-600 bg-red-50 border-red-200',
}

const reqStatusColors: Record<string, string> = {
  'لم يراجع بعد': 'text-gray-500 bg-gray-100 border-gray-200',
  'معلق': 'text-amber-600 bg-amber-50 border-amber-200',
  'معتمد': 'text-green-600 bg-green-50 border-green-200',
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTimeRemaining(ms: number): string {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  if (hours > 24) return `${Math.floor(hours / 24)} يوم ${hours % 24} ساعة`
  if (hours > 0) return `${hours} ساعة ${minutes} دقيقة`
  return `${minutes} دقيقة`
}

const supplierNames = [
  'مؤسسة البناء الحديث', 'شركة التوريدات الصناعية', 'مصنع الرياض للحديد',
  'شركة الخليج للخدمات', 'مجموعة الفهد التجارية', 'مؤسسة الجزيرة للتجارة',
  'شركة الواحة للإمدادات', 'الشركة السعودية للطاقة',
]

const requesterNames = ['أحمد محمد', 'سارة خالد', 'فهد العتيبي', 'نورة عبدالله', 'ماجد الحربي', 'ريم الشهري']

function generateMockApprovalItems(poCount: number, contractCount: number): ApprovalItem[] {
  const items: ApprovalItem[] = []
  for (let i = 0; i < poCount; i++) {
    const slaHrs = Math.floor(Math.random() * 48) + 4
    const elapsedHrs = Math.floor(Math.random() * slaHrs)
    const remainingMs = (slaHrs - elapsedHrs) * 3600000
    const priority = i < 2 ? 'عاجل' : i < 4 ? 'عالي' : i < 7 ? 'متوسط' : 'منخفض'
    items.push({
      id: `app-po-${i}`,
      reference: `PO-${String(3001 + i).padStart(4, '0')}`,
      type: 'أمر شراء',
      supplier: supplierNames[i % supplierNames.length],
      amount: Math.floor(Math.random() * 150000) + 10000,
      requester: requesterNames[i % requesterNames.length],
      date: Date.now() - elapsedHrs * 3600000,
      slaEnd: Date.now() + remainingMs,
      priority: priority as any,
      status: 'بانتظار الاعتماد',
      description: `توريد مواد خام للإنتاج - ${i + 1}`,
      category: Math.random() > 0.5 ? 'مواد خام' : 'معدات',
      budgetCode: `BUD-${String(100 + Math.floor(Math.random() * 50)).padStart(3, '0')}`,
      budgetAvailable: Math.floor(Math.random() * 500000) + 50000,
      budgetRequested: Math.floor(Math.random() * 150000) + 10000,
    })
  }
  for (let i = 0; i < contractCount; i++) {
    const slaHrs = Math.floor(Math.random() * 72) + 8
    const elapsedHrs = Math.floor(Math.random() * slaHrs)
    const remainingMs = (slaHrs - elapsedHrs) * 3600000
    items.push({
      id: `app-ctr-${i}`,
      reference: `CTR-${String(5001 + i).padStart(4, '0')}`,
      type: 'عقد',
      supplier: supplierNames[(i + 3) % supplierNames.length],
      amount: Math.floor(Math.random() * 500000) + 50000,
      requester: requesterNames[(i + 2) % requesterNames.length],
      date: Date.now() - elapsedHrs * 3600000,
      slaEnd: Date.now() + remainingMs,
      priority: i === 0 ? 'عاجل' : i < 2 ? 'عالي' : 'متوسط',
      status: 'بانتظار الاعتماد',
      description: `عقد توريد سنوي ${i + 1}`,
      category: 'خدمات',
      budgetCode: `BUD-${String(200 + Math.floor(Math.random() * 30)).padStart(3, '0')}`,
      budgetAvailable: Math.floor(Math.random() * 1000000) + 200000,
      budgetRequested: Math.floor(Math.random() * 500000) + 50000,
    })
  }
  return items
}

function generateApprovalChain(): ApprovalChainEntry[] {
  return [
    { step: 1, name: 'أحمد محمد', role: 'مشرف المشتريات', status: 'معتمد', timestamp: Date.now() - 3 * 3600000 },
    { step: 2, name: 'سارة خالد', role: 'مدير المالية', status: 'معتمد', timestamp: Date.now() - 1 * 3600000 },
    { step: 3, name: 'فهد العتيبي', role: 'المدير التنفيذي', status: 'معلق' },
    { step: 4, name: 'نورة عبدالله', role: 'المراجعة الداخلية', status: 'لم يراجع بعد' },
  ]
}

function StatusBadge({ status, className, colors }: { status: string; className?: string; colors?: Record<string, string> }) {
  const colorMap = colors ?? approvalStatusColors
  const cfg = colorMap[status] ?? 'text-gray-600 bg-gray-100'
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border', cfg, className)}>
      {status}
    </span>
  )
}

export function ProcurementApprovalWorkbench() {
  const [itemType, setItemType] = useState<'أوامر شراء' | 'العقود'>('أوامر شراء')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [inspectorTab, setInspectorTab] = useState('info')
  const [validationDismissed, setValidationDismissed] = useState<Record<string, boolean>>({})
  const [aiOpen, setAiOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)

  const allItems = useMemo(() => generateMockApprovalItems(15, 5), [])
  const allMockMessages = useMemo(() => generateMockValidationMessages('procurement'), [])
  const allAIInsights = useMemo(() => generateMockAIInsights('approval'), [])
  const allAuditEntries = useMemo(() => generateMockAuditTrail(), [])
  const allComments = useMemo(() => generateMockOperationalComments(), [])

  const filteredItems = useMemo(() => {
    const type = itemType === 'أوامر شراء' ? 'أمر شراء' : 'عقد'
    let list = allItems.filter((i) => i.type === type)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((i) => i.reference.toLowerCase().includes(q) || i.supplier.toLowerCase().includes(q))
    }
    return list
  }, [allItems, itemType, searchQuery])

  const pendingCount = allItems.filter((i) => i.status === 'بانتظار الاعتماد').length
  const approvedToday = allItems.filter((i) => i.status === 'معتمد').length
  const rejectedCount = allItems.filter((i) => i.status === 'مرفوض').length
  const avgApprovalHours = 18

  const metrics: WorkbenchMetric[] = [
    { id: 'm1', label: 'بانتظار الاعتماد', value: pendingCount, icon: 'Clock', severity: 'info' },
    { id: 'm2', label: 'تم الاعتماد اليوم', value: approvedToday, icon: 'CheckCircle2', severity: 'success' },
    { id: 'm3', label: 'مرفوض', value: rejectedCount, icon: 'X', severity: 'warning' },
    { id: 'm4', label: 'متوسط وقت الاعتماد', value: `${avgApprovalHours} ساعة`, icon: 'Clock', severity: avgApprovalHours > 24 ? 'warning' : 'info' },
  ]

  const selectedItem = useMemo(() => {
    if (!selectedId) return null
    return allItems.find((i) => i.id === selectedId) ?? null
  }, [selectedId, allItems])

  const approvalChain = useMemo(() => selectedItem ? generateApprovalChain() : [], [selectedItem])

  const slaRemaining = selectedItem ? selectedItem.slaEnd - Date.now() : 0
  const slaTotal = selectedItem ? selectedItem.slaEnd - selectedItem.date : 1
  const slaPct = slaTotal > 0 ? Math.min(Math.max(((slaTotal - slaRemaining) / slaTotal) * 100, 0), 100) : 0
  const slaBreach = slaRemaining < 3600000

  const activeMessages = useMemo(() => {
    const msgs = [...allMockMessages]
    if (selectedItem) {
      if (selectedItem.budgetRequested > selectedItem.budgetAvailable) {
        msgs.push({
          id: 'budget-over',
          type: 'error',
          message: `الميزانية غير كافية! المطلوب: ${formatCurrency(selectedItem.budgetRequested)} ريال، المتاح: ${formatCurrency(selectedItem.budgetAvailable)} ريال`,
          field: 'الميزانية',
          action: { label: 'مراجعة', handler: () => {} },
        })
      }
      if (slaBreach) {
        msgs.push({
          id: 'sla-breach',
          type: 'warning',
          message: `متبقي أقل من ساعة على انتهاء مدة الاعتماد - يرجى السرعة`,
          field: 'SLA',
          action: { label: 'تصعيد', handler: () => {} },
        })
      }
    }
    return msgs
  }, [allMockMessages, selectedItem, slaBreach])

  const handleDismissValidation = useCallback((id: string) => {
    setValidationDismissed((prev) => ({ ...prev, [id]: true }))
  }, [])

  const inspectorTabs: InspectorTab[] = [
    { id: 'info', label: 'ملف مقدم الطلب', icon: 'info' },
    { id: 'activity', label: 'استخدام الميزانية', icon: 'activity' },
    { id: 'file', label: 'سجل الموافقات', icon: 'file' },
  ]

  function getTabContent(tab: string) {
    switch (tab) {
      case 'info':
        return (
          <div className="space-y-3">
            <div className="rounded-lg border bg-card p-4">
              <h4 className="text-sm font-semibold mb-3">مقدم الطلب</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">الاسم</span>
                  <span className="font-medium">{selectedItem?.requester ?? '---'}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">القسم</span>
                  <span className="font-medium">المشتريات</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">عدد الطلبات السابقة</span>
                  <span className="font-medium">23</span>
                </div>
              </div>
            </div>
          </div>
        )
      case 'activity':
        return (
          <div className="space-y-3">
            <div className="rounded-lg border bg-card p-4">
              <h4 className="text-sm font-semibold mb-3">استخدام الميزانية</h4>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>المتاح</span>
                    <span>{selectedItem ? formatCurrency(selectedItem.budgetAvailable) : '---'} ريال</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: '45%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>المطلوب لهذا الطلب</span>
                    <span>{selectedItem ? formatCurrency(selectedItem.budgetRequested) : '---'} ريال</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', selectedItem && selectedItem.budgetRequested > selectedItem.budgetAvailable ? 'bg-red-500' : 'bg-amber-500')} style={{ width: selectedItem ? Math.min((selectedItem.budgetRequested / selectedItem.budgetAvailable) * 100, 100) : 0 }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      case 'file':
        return (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold mb-2">سجل الموافقات</h4>
            <div className="space-y-2">
              {allItems.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.reference}</p>
                    <p className="text-xs text-muted-foreground">{item.supplier}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              ))}
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <WorkbenchShell
      title="منصة اعتماد المشتريات"
      description="اعتماد أوامر الشراء والعقود"
      breadcrumbs={[
        { label: 'المشتريات' },
        { label: 'الاعتمادات' },
      ]}
      metrics={metrics}
      actions={[
        { id: 'a1', label: 'تصدير التقرير', type: 'ghost', icon: 'Download', handler: () => {} },
        { id: 'a2', label: 'سجل التدقيق', type: 'ghost', icon: 'Shield', handler: () => setAuditOpen(true) },
        { id: 'a3', label: 'المساعد الذكي', type: 'ghost', icon: 'Sparkles', handler: () => setAiOpen(!aiOpen) },
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
              domain="approval"
              insights={allAIInsights}
            />
          </div>
        )
      }
    >
      <div className="flex h-full" dir="rtl">
        <div className="w-[420px] border-l flex flex-col shrink-0 bg-card">
          <div className="p-3 border-b">
            <div className="flex gap-1 mb-3 bg-muted rounded-lg p-0.5">
              {(['أوامر شراء', 'العقود'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setItemType(tab); setSelectedId(null) }}
                  className={cn(
                    'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                    itemType === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث..."
                className="flex h-9 w-full rounded-lg border border-input bg-background pr-9 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <ClipboardCheck className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">عند عدم وجود بيانات</p>
                <Button variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={() => setSearchQuery('')}>
                  إعادة تعيين التصفية
                </Button>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.id === selectedId
                const remaining = item.slaEnd - Date.now()
                const total = item.slaEnd - item.date
                const pct = total > 0 ? Math.min(Math.max(((total - remaining) / total) * 100, 0), 100) : 0
                const isUrgent = remaining < 3600000
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      'w-full text-right p-4 border-b hover:bg-muted/30 transition-colors',
                      isSelected && 'bg-primary/5 border-r-2 border-r-primary',
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{item.reference}</span>
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', priorityColors[item.priority])}>
                        {item.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Building2 className="h-3 w-3" />
                      <span>{item.supplier}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{formatCurrency(item.amount)} ريال</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {item.requester}
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span className={cn('flex items-center gap-1', isUrgent && 'text-red-600 font-medium')}>
                          <Clock className="h-3 w-3" />
                          {remaining > 0 ? formatTimeRemaining(remaining) : 'متجاوز'}
                        </span>
                        <span>{Math.round(pct)}%</span>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className={cn(
                          'h-full rounded-full',
                          isUrgent ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-primary',
                        )} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="mt-1.5 text-[11px] text-muted-foreground">
                      {formatDate(item.date)}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-background">
          {!selectedItem ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ClipboardCheck className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">اختر طلباً من القائمة</p>
              <p className="text-sm text-muted-foreground mt-1">لعرض التفاصيل واتخاذ قرار الاعتماد</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-12 w-12 rounded-xl flex items-center justify-center',
                      selectedItem.type === 'أمر شراء' ? 'bg-blue-100' : 'bg-purple-100',
                    )}>
                      {selectedItem.type === 'أمر شراء' ? <ShoppingCart className="h-6 w-6 text-blue-600" /> : <FileText className="h-6 w-6 text-purple-600" />}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{selectedItem.reference}</h2>
                      <p className="text-sm text-muted-foreground">{selectedItem.supplier}</p>
                    </div>
                  </div>
                  <StatusBadge status={selectedItem.status} />
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm p-4 rounded-lg bg-muted/20 mb-4">
                  <div>
                    <span className="text-muted-foreground">النوع</span>
                    <p className="font-medium">{selectedItem.type}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">مقدم الطلب</span>
                    <p className="font-medium">{selectedItem.requester}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">التصنيف</span>
                    <p className="font-medium">{selectedItem.category}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">ملخص الطلب</h4>
                  <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border bg-card p-5">
                  <h4 className="text-sm font-medium mb-3">معلومات الميزانية</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">رمز الميزانية</span>
                      <span className="font-medium">{selectedItem.budgetCode}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">المتاح</span>
                      <span className="font-medium text-green-600">{formatCurrency(selectedItem.budgetAvailable)} ريال</span>
                    </div>
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">المطلوب</span>
                      <span className={cn('font-medium', selectedItem.budgetRequested > selectedItem.budgetAvailable ? 'text-red-600' : 'text-foreground')}>
                        {formatCurrency(selectedItem.budgetRequested)} ريال
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">المتبقي بعد الطلب</span>
                      <span className={cn('font-medium', (selectedItem.budgetAvailable - selectedItem.budgetRequested) < 0 ? 'text-red-600' : 'text-foreground')}>
                        {formatCurrency(selectedItem.budgetAvailable - selectedItem.budgetRequested)} ريال
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-5">
                  <h4 className="text-sm font-medium mb-3">مؤشر مستوى الخدمة (SLA)</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={cn('font-medium', slaBreach ? 'text-red-600' : 'text-foreground')}>
                          {slaRemaining > 0 ? formatTimeRemaining(slaRemaining) : 'منتهي'}
                        </span>
                        <span className="text-muted-foreground">{Math.round(slaPct)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={cn(
                          'h-full rounded-full',
                          slaBreach ? 'bg-red-500' : slaPct > 70 ? 'bg-amber-500' : 'bg-primary',
                        )} style={{ width: `${slaPct}%` }} />
                      </div>
                    </div>
                    {slaBreach && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="text-xs text-red-600">اقتراب تجاوز مدة الاعتماد - يرجى التصعيد</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">سلسلة الاعتماد</span>
                </div>
                <div className="flex items-start gap-2 overflow-x-auto pb-2">
                  {approvalChain.map((entry, i) => (
                    <div key={entry.step} className="flex items-center gap-2 shrink-0">
                      <div className={cn(
                        'flex flex-col items-center p-3 rounded-xl border min-w-[140px]',
                        entry.status === 'معتمد' ? 'border-green-200 bg-green-50' :
                        entry.status === 'معلق' ? 'border-amber-200 bg-amber-50' :
                        'border-gray-200 bg-gray-50',
                      )}>
                        <div className={cn(
                          'h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold mb-1',
                          entry.status === 'معتمد' ? 'bg-green-200 text-green-700' :
                          entry.status === 'معلق' ? 'bg-amber-200 text-amber-700' :
                          'bg-gray-200 text-gray-500',
                        )}>
                          {entry.name[0]}
                        </div>
                        <p className="text-xs font-medium">{entry.name}</p>
                        <p className="text-[10px] text-muted-foreground">{entry.role}</p>
                        <span className={cn(
                          'mt-1.5 px-2 py-0.5 rounded text-[10px] font-medium border',
                          reqStatusColors[entry.status],
                        )}>
                          {entry.status}
                        </span>
                        {entry.timestamp && (
                          <span className="text-[9px] text-muted-foreground mt-1">{formatDate(entry.timestamp)}</span>
                        )}
                      </div>
                      {i < approvalChain.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    (selectedItem.budgetRequested > selectedItem.budgetAvailable)
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : 'bg-blue-50 text-blue-600 border border-blue-200',
                  )}>
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">ملخص الميزانية</h4>
                    <div className="mt-2 space-y-1 text-sm">
                      <p>المتاح: <span className="font-medium text-green-600">{formatCurrency(selectedItem.budgetAvailable)} ريال</span></p>
                      <p>المطلوب: <span className="font-medium">{formatCurrency(selectedItem.budgetRequested)} ريال</span></p>
                      <p>المتبقي: <span className={cn('font-medium', (selectedItem.budgetAvailable - selectedItem.budgetRequested) >= 0 ? 'text-green-600' : 'text-red-600')}>
                        {formatCurrency(selectedItem.budgetAvailable - selectedItem.budgetRequested)} ريال
                      </span></p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 pb-4 flex-wrap">
                <Button className="h-9 text-xs gap-1.5"><CheckCircle2 className="h-4 w-4" />اعتماد</Button>
                <Button variant="destructive" className="h-9 text-xs gap-1.5" onClick={() => setShowRejectDialog(true)}>
                  <X className="h-4 w-4" />رفض
                </Button>
                <Button variant="secondary" className="h-9 text-xs gap-1.5"><Send className="h-4 w-4" />إعادة للمراجعة</Button>
                <Button variant="outline" className="h-9 text-xs gap-1.5"><Users className="h-4 w-4" />تفويض</Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCommentsOpen(!commentsOpen)} title="التعليقات">
                  <MessageSquare className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setAuditOpen(true)} title="سجل التدقيق">
                  <Shield className="h-4 w-4" />
                </Button>
              </div>

              {showRejectDialog && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-5">
                  <h4 className="text-sm font-medium text-red-700 mb-3">سبب الرفض</h4>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="يرجى توضيح سبب الرفض..."
                    rows={3}
                    className="flex w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 resize-none"
                  />
                  <div className="flex items-center gap-2 mt-3">
                    <Button size="sm" variant="destructive" className="h-8 text-xs" disabled={!rejectReason.trim()}>
                      تأكيد الرفض
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowRejectDialog(false)}>
                      إلغاء
                    </Button>
                  </div>
                </div>
              )}

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
        entityId={selectedItem?.id}
        entityType="اعتماد"
      />
    </WorkbenchShell>
  )
}
