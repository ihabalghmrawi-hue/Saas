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

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'مسودة', color: 'text-gray-600 bg-gray-100 border-gray-300' },
  pending: { label: 'معلق', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  approved: { label: 'معتمد', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  received: { label: 'مستلم', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  closed: { label: 'مغلق', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  cancelled: { label: 'ملغي', color: 'text-red-600 bg-red-50 border-red-200' },
}

const priorityLabels: Record<string, { label: string; color: string }> = {
  normal: { label: 'عادي', color: 'bg-gray-100 text-gray-600' },
  medium: { label: 'متوسط', color: 'bg-blue-100 text-blue-600' },
  high: { label: 'عالي', color: 'bg-amber-100 text-amber-600' },
  urgent: { label: 'عاجل', color: 'bg-red-100 text-red-600' },
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ProgressBar({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden w-24">
      <div className={cn('h-full rounded-full transition-all', color ?? 'bg-primary')} style={{ width: `${pct}%` }} />
    </div>
  )
}

interface StatusBadgeProps {
  status: string
  className?: string
}

function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = statusConfig[status] ?? { label: status, color: 'text-gray-600 bg-gray-100' }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border', cfg.color, className)}>
      {cfg.label}
    </span>
  )
}

export function ProcurementOpsCenter() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('الكل')
  const [sortBy, setSortBy] = useState('date')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('نظرة عامة')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [inspectorTab, setInspectorTab] = useState('info')
  const [validationDismissed, setValidationDismissed] = useState<Record<string, boolean>>({})
  const [aiOpen, setAiOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)

  const allPOs = useMemo(() => generateMockPurchaseOrders(20), [])
  const allSuppliers = useMemo(() => generateMockSuppliers(), [])
  const allMockMessages = useMemo(() => generateMockValidationMessages('procurement'), [])
  const allAIInsights = useMemo(() => generateMockAIInsights('procurement'), [])
  const allAuditEntries = useMemo(() => generateMockAuditTrail(), [])
  const allComments = useMemo(() => generateMockOperationalComments(), [])

  const activeCount = allPOs.filter((po) => po.status === 'pending' || po.status === 'approved').length
  const suppliers = allSuppliers.length
  const thisMonthPurchases = allPOs.reduce((sum, po) => sum + po.amount, 0)
  const overdueCount = allPOs.filter((po) => po.expectedDate < Date.now() && po.status !== 'received' && po.status !== 'closed').length

  const metrics: WorkbenchMetric[] = [
    { id: 'm1', label: 'أوامر شراء نشطة', value: activeCount, icon: 'ShoppingCart', severity: 'info' },
    { id: 'm2', label: 'موردون', value: suppliers, icon: 'Users', severity: 'success' },
    { id: 'm3', label: 'قيمة المشتريات هذا الشهر', value: formatCurrency(thisMonthPurchases), icon: 'DollarSign', severity: 'info' },
    { id: 'm4', label: 'أوامر متأخرة عن التسليم', value: overdueCount, icon: 'AlertTriangle', severity: overdueCount > 0 ? 'warning' : 'success' },
  ]

  const statusFilters = ['الكل', 'معلق', 'معتمد', 'مستلم', 'مغلق']
  const statusMap: Record<string, string> = { 'الكل': '', 'معلق': 'pending', 'معتمد': 'approved', 'مستلم': 'received', 'مغلق': 'closed' }

  const filteredPOs = useMemo(() => {
    let list = [...allPOs]
    const statusKey = statusMap[statusFilter]
    if (statusKey) list = list.filter((po) => po.status === statusKey)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((po) => po.number.toLowerCase().includes(q) || po.supplier.toLowerCase().includes(q))
    }
    list.sort((a, b) => {
      if (sortBy === 'amount') return b.amount - a.amount
      if (sortBy === 'date') return b.date - a.date
      return b.date - a.date
    })
    return list
  }, [allPOs, statusFilter, searchQuery, sortBy])

  const selectedPO = useMemo(() => {
    if (!selectedId) return null
    return allPOs.find((po) => po.id === selectedId) ?? null
  }, [selectedId, allPOs])

  const activeMessages = allMockMessages.filter((m) => !validationDismissed[m.id])

  const handleDismissValidation = useCallback((id: string) => {
    setValidationDismissed((prev) => ({ ...prev, [id]: true }))
  }, [])

  const inspectorTabs: InspectorTab[] = [
    { id: 'info', label: 'معلومات المورد', icon: 'info' },
    { id: 'activity', label: 'سجل أوامر الشراء', icon: 'activity' },
    { id: 'file', label: 'استخدام الميزانية', icon: 'file' },
  ]

  const topTabs = ['نظرة عامة', 'أوامر شراء نشطة', 'الموردون']

  function getTabContent(tab: string) {
    switch (tab) {
      case 'info':
        return selectedPO ? (
          <div className="space-y-3">
            <div className="rounded-lg border bg-card p-4">
              <h4 className="text-sm font-semibold mb-3">بيانات المورد</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">الاسم</span>
                  <span className="font-medium">{selectedPO.supplier}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">إجمالي المشتريات</span>
                  <span className="font-medium">{formatCurrency(selectedPO.amount)} ريال</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">آخر أمر شراء</span>
                  <span className="font-medium">{formatDate(selectedPO.date)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">عدد الأصناف</span>
                  <span className="font-medium">{selectedPO.items.length}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">اختر أمر شراء لعرض التفاصيل</p>
        )
      case 'activity':
        return (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold mb-2">آخر أوامر الشراء</h4>
            {allPOs.slice(0, 5).map((po) => (
              <div key={po.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{po.number}</p>
                  <p className="text-xs text-muted-foreground">{po.supplier}</p>
                </div>
                <span className="text-sm font-medium">{formatCurrency(po.amount)} ريال</span>
              </div>
            ))}
          </div>
        )
      case 'file':
        return (
          <div className="space-y-3">
            <div className="rounded-lg border bg-card p-4">
              <h4 className="text-sm font-semibold mb-3">استخدام الميزانية</h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>المستخدم</span>
                    <span>{formatCurrency(thisMonthPurchases * 0.6)} ريال</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: '60%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>المتبقي</span>
                    <span>{formatCurrency(thisMonthPurchases * 0.4)} ريال</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: '40%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <WorkbenchShell
      title="مركز عمليات المشتريات"
      description="لوحة تحكم شاملة لإدارة المشتريات وأوامر الشراء"
      breadcrumbs={[
        { label: 'المشتريات' },
        { label: 'مركز العمليات' },
      ]}
      metrics={metrics}
      actions={[
        { id: 'a1', label: 'إنشاء أمر شراء', type: 'primary', icon: 'Plus', handler: () => {} },
        { id: 'a2', label: 'تحديث', type: 'secondary', icon: 'RefreshCw', handler: () => {} },
        { id: 'a3', label: 'سجل التدقيق', type: 'ghost', icon: 'Shield', handler: () => setAuditOpen(true) },
        { id: 'a5', label: 'المساعد الذكي', type: 'ghost', icon: 'Sparkles', handler: () => setAiOpen(!aiOpen) },
      ]}
      inspectorTabs={inspectorTabs}
      inspectorContent={getTabContent(inspectorTab)}
      inspectorOpen={inspectorOpen}
      onInspectorToggle={setInspectorOpen}
      inspectorTab={inspectorTab}
      onInspectorTabChange={setInspectorTab}
      validationBar={
        <RealtimeValidationBar
          messages={activeMessages}
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
            <div className="flex gap-1 mb-3">
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
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث عن أمر شراء..."
                  className="flex h-9 w-full rounded-lg border border-input bg-background pr-9 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="date">التاريخ</option>
                <option value="amount">المبلغ</option>
              </select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredPOs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">عند عدم وجود بيانات</p>
                <Button variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={() => { setStatusFilter('الكل'); setSearchQuery('') }}>
                  إعادة تعيين التصفية
                </Button>
              </div>
            ) : (
              filteredPOs.map((po) => {
                const isSelected = po.id === selectedId
                const priority = po.amount > 100000 ? 'urgent' : po.amount > 50000 ? 'high' : po.amount > 10000 ? 'medium' : 'normal'
                const priorityCfg = priorityLabels[priority]
                const isOverdue = po.expectedDate < Date.now() && po.status !== 'received' && po.status !== 'closed'
                return (
                  <button
                    key={po.id}
                    type="button"
                    onClick={() => setSelectedId(po.id)}
                    className={cn(
                      'w-full text-right p-4 border-b hover:bg-muted/30 transition-colors',
                      isSelected && 'bg-primary/5 border-r-2 border-r-primary',
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{po.number}</span>
                      <StatusBadge status={po.status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Building2 className="h-3 w-3" />
                      <span>{po.supplier}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">{formatCurrency(po.amount)} ريال</span>
                      <div className="flex items-center gap-2">
                        {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', priorityCfg.color)}>
                          {priorityCfg.label}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(po.date)}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-background">
          {!selectedPO ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingCart className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">اختر أمر شراء من القائمة</p>
              <p className="text-sm text-muted-foreground mt-1">لعرض التفاصيل وإدارة أمر الشراء</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold">{selectedPO.number}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{selectedPO.supplier}</p>
                  </div>
                  <StatusBadge status={selectedPO.status} className="text-sm px-3 py-1" />
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">تاريخ الإنشاء</span>
                    <p className="font-medium">{formatDate(selectedPO.date)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">تاريخ التسليم المتوقع</span>
                    <p className="font-medium">{formatDate(selectedPO.expectedDate)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">الإجمالي</span>
                    <p className="font-bold text-lg">{formatCurrency(selectedPO.amount)} ريال</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-card">
                <div className="flex items-center gap-2 px-5 py-3 border-b bg-muted/20">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">بنود أمر الشراء</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/10">
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الصنف</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الكمية المطلوبة</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الكمية المستلمة</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">سعر الوحدة</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الإجمالي</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">نسبة الاستلام</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPO.items.map((item) => {
                        const receivePct = item.quantity > 0 ? Math.min((item.received / item.quantity) * 100, 100) : 0
                        const isComplete = item.received >= item.quantity
                        return (
                          <tr key={item.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium">{item.item}</p>
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            </td>
                            <td className="px-4 py-3">{item.quantity}</td>
                            <td className="px-4 py-3">{item.received}</td>
                            <td className="px-4 py-3">{formatCurrency(item.unitPrice)}</td>
                            <td className="px-4 py-3 font-medium">{formatCurrency(item.amount)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <ProgressBar value={item.received} max={item.quantity} color={isComplete ? 'bg-green-500' : 'bg-primary'} />
                                <span className="text-xs text-muted-foreground">{Math.round(receivePct)}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">الجدول الزمني للتسليم</span>
                </div>
                <div className="space-y-0">
                  {[
                    { label: 'تاريخ الأمر', date: selectedPO.date, done: true },
                    { label: 'تاريخ الاعتماد', date: selectedPO.date + 86400000, done: selectedPO.status !== 'draft' },
                    { label: 'تاريخ التسليم المتوقع', date: selectedPO.expectedDate, done: selectedPO.status === 'received' || selectedPO.status === 'closed' },
                    { label: 'تاريخ الإغلاق', date: selectedPO.expectedDate + 86400000 * 3, done: selectedPO.status === 'closed' },
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={cn('h-3 w-3 rounded-full border-2', step.done ? 'border-green-500 bg-green-500' : 'border-gray-300')} />
                        {i < 3 && <div className={cn('w-px h-6', step.done ? 'bg-green-300' : 'bg-border')} />}
                      </div>
                      <div className="pb-4">
                        <p className={cn('text-sm font-medium', step.done ? 'text-foreground' : 'text-muted-foreground')}>{step.label}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(step.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">سير الاعتماد</span>
                </div>
                <div className="flex items-center gap-2">
                  {[
                    { name: 'أحمد محمد', status: 'معتمد' },
                    { name: 'سارة خالد', status: 'معتمد' },
                    { name: 'فهد العتيبي', status: selectedPO.status === 'approved' || selectedPO.status === 'received' || selectedPO.status === 'closed' ? 'معتمد' : 'معلق' },
                  ].map((approver, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm',
                        approver.status === 'معتمد' ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50',
                      )}>
                        <div className={cn('h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold', approver.status === 'معتمد' ? 'bg-green-200 text-green-700' : 'bg-amber-200 text-amber-700')}>
                          {approver.name[0]}
                        </div>
                        <div>
                          <p className="text-xs font-medium">{approver.name}</p>
                          <p className={cn('text-[10px]', approver.status === 'معتمد' ? 'text-green-600' : 'text-amber-600')}>{approver.status}</p>
                        </div>
                      </div>
                      {i < 2 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">فحص الميزانية</span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'الميزانية المعتمدة', value: 500000 },
                    { label: 'المصروف حتى الآن', value: 325000 },
                    { label: 'قيمة أمر الشراء هذا', value: selectedPO.amount },
                    { label: 'المتبقي من الميزانية', value: 500000 - 325000 - selectedPO.amount },
                  ].map((row) => {
                    const isOver = row.value < 0
                    return (
                      <div key={row.label} className={cn('flex justify-between py-1.5 border-b last:border-b-0 text-sm', isOver && 'text-red-600')}>
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-medium">{formatCurrency(Math.abs(row.value))} ريال {isOver ? '(تجاوز)' : ''}</span>
                      </div>
                    )
                  })}
                </div>
                {activeMessages.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-2 text-sm text-amber-700">
                      <AlertTriangle className="h-4 w-4" />
                      <span>تحذير: تجاوز الميزانية المتوقعة</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 pb-4 flex-wrap">
                <Button className="h-9 text-xs gap-1.5"><CheckCircle2 className="h-4 w-4" />اعتماد</Button>
                <Button variant="secondary" className="h-9 text-xs gap-1.5"><Ban className="h-4 w-4" />إيقاف مؤقت</Button>
                <Button variant="outline" className="h-9 text-xs gap-1.5"><Printer className="h-4 w-4" />طباعة</Button>
                <Button variant="outline" className="h-9 text-xs gap-1.5"><Send className="h-4 w-4" />إرسال للبريد</Button>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCommentsOpen(!commentsOpen)} title="التعليقات">
                  <MessageSquare className="h-4 w-4" />
                </Button>
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
        entityId={selectedPO?.id}
        entityType="أمر شراء"
      />
    </WorkbenchShell>
  )
}
