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
import type { PurchaseOrder, PurchaseOrderLine, Invoice, InvoiceLine, ValidationMessage, AIInsight, WorkbenchMetric, InspectorTab } from '@/lib/workbench/types'

interface MatchLine {
  id: string
  item: string
  orderedQty: number
  unitPrice: number
  receivedQty: number
  receivedDate: number
  billedQty: number
  billedUnitPrice: number
  billedAmount: number
  matchStatus: 'مطابق' | 'فرق كمية' | 'فرق سعر' | 'غير موجود'
}

const mockSuppliers = [
  'مؤسسة البناء الحديث', 'شركة التوريدات الصناعية', 'مصنع الرياض للحديد',
  'شركة الخليج للخدمات', 'مجموعة الفهد التجارية', 'مؤسسة الجزيرة للتجارة',
  'شركة الواحة للإمدادات', 'الشركة السعودية للطاقة',
]

const matchStatusColors: Record<string, string> = {
  'مطابق': 'text-green-600 bg-green-50 border-green-200',
  'فرق كمية': 'text-amber-600 bg-amber-50 border-amber-200',
  'فرق سعر': 'text-red-600 bg-red-50 border-red-200',
  'غير موجود': 'text-gray-600 bg-gray-100 border-gray-200',
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function generateMatchLines(count: number): MatchLine[] {
  const items = [
    'مواد خام أ', 'مواد خام ب', 'عبوات كرتون', 'أكياس بلاستيك',
    'قطع غيار م أ', 'زيوت تشحيم', 'مذيبات كيميائية', 'فلاتر تهوية',
    'أحزمة نقل', 'صمامات تحكم', 'مواسير صلب', 'كوابل كهربائية',
  ]
  const statuses: MatchLine['matchStatus'][] = ['مطابق', 'فرق كمية', 'فرق سعر', 'غير موجود']
  return Array.from({ length: count }, (_, i) => {
    const ordered = Math.floor(Math.random() * 100) + 10
    const unitPrice = Math.floor(Math.random() * 150) + 10
    const received = Math.floor(Math.random() * ordered)
    const billed = Math.floor(Math.random() * ordered)
    const billedPrice = Math.random() > 0.6 ? unitPrice + Math.floor(Math.random() * 20) - 10 : unitPrice
    const statusWeights = [0.4, 0.25, 0.2, 0.15]
    const rand = Math.random()
    let matchStatus: MatchLine['matchStatus']
    if (rand < statusWeights[0]) matchStatus = 'مطابق'
    else if (rand < statusWeights[0] + statusWeights[1]) matchStatus = 'فرق كمية'
    else if (rand < statusWeights[0] + statusWeights[1] + statusWeights[2]) matchStatus = 'فرق سعر'
    else matchStatus = 'غير موجود'
    return {
      id: `ml-${i}`,
      item: items[i % items.length],
      orderedQty: ordered,
      unitPrice,
      receivedQty: received,
      receivedDate: Date.now() - Math.floor(Math.random() * 20) * 86400000,
      billedQty: billed,
      billedUnitPrice: billedPrice,
      billedAmount: billed * billedPrice,
      matchStatus,
    }
  })
}

interface InvoiceMatch {
  id: string
  invoiceNumber: string
  supplier: string
  amount: number
  status: 'بانتظار المطابقة' | 'تمت المطابقة' | 'غير متطابق' | 'قيد النزاع'
  date: number
  poReference: string
  lines: MatchLine[]
}

function generateMockInvoiceMatches(count: number): InvoiceMatch[] {
  const matchStatuses: InvoiceMatch['status'][] = ['بانتظار المطابقة', 'تمت المطابقة', 'غير متطابق', 'قيد النزاع']
  return Array.from({ length: count }, (_, i) => {
    const lineCount = Math.floor(Math.random() * 4) + 2
    const lines = generateMatchLines(lineCount)
    const totalAmount = lines.reduce((s, l) => s + l.billedAmount, 0)
    const hasMismatch = lines.some((l) => l.matchStatus !== 'مطابق')
    let status: InvoiceMatch['status']
    if (hasMismatch && Math.random() > 0.6) status = 'غير متطابق'
    else if (hasMismatch && Math.random() > 0.5) status = 'قيد النزاع'
    else if (Math.random() > 0.4) status = 'تمت المطابقة'
    else status = 'بانتظار المطابقة'
    return {
      id: `im-${i}`,
      invoiceNumber: `INV-${String(2001 + i).padStart(4, '0')}`,
      supplier: mockSuppliers[i % mockSuppliers.length],
      amount: totalAmount,
      status,
      date: Date.now() - Math.floor(Math.random() * 30) * 86400000,
      poReference: `PO-${String(1001 + Math.floor(Math.random() * 20)).padStart(4, '0')}`,
      lines,
    }
  })
}

const matchStatusStyle: Record<string, { label: string; color: string }> = {
  'بانتظار المطابقة': { label: 'بانتظار المطابقة', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  'تمت المطابقة': { label: 'تمت المطابقة', color: 'text-green-600 bg-green-50 border-green-200' },
  'غير متطابق': { label: 'غير متطابق', color: 'text-red-600 bg-red-50 border-red-200' },
  'قيد النزاع': { label: 'قيد النزاع', color: 'text-purple-600 bg-purple-50 border-purple-200' },
}

function InvoiceStatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = matchStatusStyle[status] ?? { label: status, color: 'text-gray-600 bg-gray-100' }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border', cfg.color, className)}>
      {cfg.label}
    </span>
  )
}

function MatchStatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = matchStatusColors[status] ?? { label: status, color: 'text-gray-600 bg-gray-100' }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border', cfg, className)}>
      {status}
    </span>
  )
}

export function APMatchingWorkbench() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [inspectorTab, setInspectorTab] = useState('info')
  const [validationDismissed, setValidationDismissed] = useState<Record<string, boolean>>({})
  const [aiOpen, setAiOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)

  const allMatches = useMemo(() => generateMockInvoiceMatches(15), [])
  const allMockMessages = useMemo(() => generateMockValidationMessages('procurement'), [])
  const allAIInsights = useMemo(() => generateMockAIInsights('procurement'), [])
  const allAuditEntries = useMemo(() => generateMockAuditTrail(), [])
  const allComments = useMemo(() => generateMockOperationalComments(), [])

  const pendingCount = allMatches.filter((m) => m.status === 'بانتظار المطابقة').length
  const matchedCount = allMatches.filter((m) => m.status === 'تمت المطابقة').length
  const unmatchedCount = allMatches.filter((m) => m.status === 'غير متطابق').length
  const disputeCount = allMatches.filter((m) => m.status === 'قيد النزاع').length

  const metrics: WorkbenchMetric[] = [
    { id: 'm1', label: 'بانتظار المطابقة', value: pendingCount, icon: 'Clock', severity: 'info' },
    { id: 'm2', label: 'تمت المطابقة', value: matchedCount, icon: 'CheckCircle2', severity: 'success' },
    { id: 'm3', label: 'غير متطابق', value: unmatchedCount, icon: 'AlertTriangle', severity: 'warning' },
    { id: 'm4', label: 'قيد النزاع', value: disputeCount, icon: 'Scale', severity: disputeCount > 0 ? 'critical' : 'info' },
  ]

  const filteredMatches = useMemo(() => {
    let list = [...allMatches]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((m) => m.invoiceNumber.toLowerCase().includes(q) || m.supplier.toLowerCase().includes(q))
    }
    return list
  }, [allMatches, searchQuery])

  const selectedMatch = useMemo(() => {
    if (!selectedId) return null
    return allMatches.find((m) => m.id === selectedId) ?? null
  }, [selectedId, allMatches])

  const selectedLines = selectedMatch?.lines ?? []

  const matchedTotal = selectedLines.filter((l) => l.matchStatus === 'مطابق').reduce((s, l) => s + l.billedAmount, 0)
  const unmatchedTotal = selectedLines.filter((l) => l.matchStatus !== 'مطابق').reduce((s, l) => s + l.billedAmount, 0)

  const activeMessages = useMemo(() => {
    const msgs = [...allMockMessages]
    if (selectedMatch) {
      const priceVarianceLines = selectedLines.filter((l) => l.matchStatus === 'فرق سعر')
      if (priceVarianceLines.length > 0) {
        msgs.push({
          id: 'price-var',
          type: 'warning',
          message: `توجد ${priceVarianceLines.length} بنود بفروق في سعر الوحدة تتجاوز نسبة التسامح المسموح بها`,
          field: 'سعر الوحدة',
          action: { label: 'مراجعة', handler: () => {} },
        })
      }
      const qtyMismatchLines = selectedLines.filter((l) => l.matchStatus === 'فرق كمية')
      if (qtyMismatchLines.length > 0) {
        msgs.push({
          id: 'qty-var',
          type: 'error',
          message: `توجد ${qtyMismatchLines.length} بنود بفروق في الكميات - يرجى التحقق من الإيصال`,
          field: 'الكمية',
          action: { label: 'تصحيح', handler: () => {} },
        })
      }
    }
    return msgs
  }, [allMockMessages, selectedMatch, selectedLines])

  const handleDismissValidation = useCallback((id: string) => {
    setValidationDismissed((prev) => ({ ...prev, [id]: true }))
  }, [])

  const inspectorTabs: InspectorTab[] = [
    { id: 'info', label: 'ملخص المطابقة', icon: 'info' },
    { id: 'activity', label: 'سجل المطابقة', icon: 'activity' },
    { id: 'file', label: 'التسامح المسموح', icon: 'file' },
  ]

  function getTabContent(tab: string) {
    switch (tab) {
      case 'info':
        return (
          <div className="space-y-3">
            <div className="rounded-lg border bg-card p-4">
              <h4 className="text-sm font-semibold mb-3">ملخص المطابقة</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">إجمالي matched</span>
                  <span className="font-medium text-green-600">{formatCurrency(matchedTotal)} ريال</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">إجمالي unmatched</span>
                  <span className="font-medium text-red-600">{formatCurrency(unmatchedTotal)} ريال</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">نسبة المطابقة</span>
                  <span className="font-medium">
                    {selectedLines.length > 0
                      ? Math.round((selectedLines.filter((l) => l.matchStatus === 'مطابق').length / selectedLines.length) * 100)
                      : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      case 'activity':
        return (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold mb-2">سجل المطابقة</h4>
            <div className="space-y-2">
              {allMatches.slice(0, 5).map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{m.supplier}</p>
                  </div>
                  <InvoiceStatusBadge status={m.status} />
                </div>
              ))}
            </div>
          </div>
        )
      case 'file':
        return (
          <div className="space-y-3">
            <div className="rounded-lg border bg-card p-4">
              <h4 className="text-sm font-semibold mb-3">نسب التسامح</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b">
                  <span>تسامح كمية</span>
                  <span className="font-medium">±10%</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span>تسامح سعر</span>
                  <span className="font-medium">±5%</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>تسامح إجمالي</span>
                  <span className="font-medium">±8%</span>
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
      title="مطابقة الفواتير (3-way)"
      description="مطابقة أوامر الشراء والإيصالات والفواتير"
      breadcrumbs={[
        { label: 'المشتريات' },
        { label: 'مطابقة الفواتير' },
      ]}
      metrics={metrics}
      actions={[
        { id: 'a1', label: 'مطابقة', type: 'primary', icon: 'CheckSquare', handler: () => {} },
        { id: 'a2', label: 'مطابقة جزئية', type: 'secondary', icon: 'Percent', handler: () => {} },
        { id: 'a3', label: 'تعليق للمراجعة', type: 'ghost', icon: 'Ban', handler: () => {} },
        { id: 'a4', label: 'إنشاء إشعار دائن', type: 'ghost', icon: 'ArrowUpDown', handler: () => {} },
        { id: 'a5', label: 'رفع نزاع', type: 'ghost', icon: 'Scale', handler: () => {} },
        { id: 'a6', label: 'المساعد الذكي', type: 'ghost', icon: 'Sparkles', handler: () => setAiOpen(!aiOpen) },
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
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث عن فاتورة..."
                className="flex h-9 w-full rounded-lg border border-input bg-background pr-9 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredMatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">عند عدم وجود بيانات</p>
                <Button variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={() => setSearchQuery('')}>
                  إعادة تعيين التصفية
                </Button>
              </div>
            ) : (
              filteredMatches.map((match) => {
                const isSelected = match.id === selectedId
                return (
                  <button
                    key={match.id}
                    type="button"
                    onClick={() => setSelectedId(match.id)}
                    className={cn(
                      'w-full text-right p-4 border-b hover:bg-muted/30 transition-colors',
                      isSelected && 'bg-primary/5 border-r-2 border-r-primary',
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{match.invoiceNumber}</span>
                      <InvoiceStatusBadge status={match.status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Building2 className="h-3 w-3" />
                      <span>{match.supplier}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{formatCurrency(match.amount)} ريال</span>
                      <span className="text-xs text-muted-foreground">PO: {match.poReference}</span>
                    </div>
                    <div className="mt-1.5 text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(match.date)}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-background">
          {!selectedMatch ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Scale className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">اختر فاتورة من القائمة</p>
              <p className="text-sm text-muted-foreground mt-1">لبدء عملية المطابقة الثلاثية</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold">{selectedMatch.invoiceNumber}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{selectedMatch.supplier}</p>
                  </div>
                  <InvoiceStatusBadge status={selectedMatch.status} className="text-sm px-3 py-1" />
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">تاريخ الفاتورة</span>
                    <p className="font-medium">{formatDate(selectedMatch.date)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">أمر الشراء المرجعي</span>
                    <p className="font-medium">{selectedMatch.poReference}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">إجمالي الفاتورة</span>
                    <p className="font-bold text-lg">{formatCurrency(selectedMatch.amount)} ريال</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="grid grid-cols-3 divide-x bg-muted/20 border-b">
                  <div className="p-3 text-center">
                    <FileText className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                    <span className="text-xs font-medium">أمر الشراء</span>
                  </div>
                  <div className="p-3 text-center">
                    <Package className="h-4 w-4 mx-auto mb-1 text-green-500" />
                    <span className="text-xs font-medium">إيصال الاستلام</span>
                  </div>
                  <div className="p-3 text-center">
                    <DollarSign className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                    <span className="text-xs font-medium">الفاتورة</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/10">
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">الصنف</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">الكمية المطلوبة</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">سعر الوحدة</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">الكمية المستلمة</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">تاريخ الاستلام</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">الكمية المفوتورة</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">سعر الفاتورة</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">قيمة الفاتورة</th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">حالة المطابقة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedLines.map((line) => {
                        const qtyDiff = line.billedQty - line.receivedQty
                        const priceDiff = line.billedUnitPrice - line.unitPrice
                        return (
                          <tr key={line.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                            <td className="px-3 py-3 font-medium">{line.item}</td>
                            <td className="px-3 py-3">{line.orderedQty}</td>
                            <td className="px-3 py-3">{formatCurrency(line.unitPrice)}</td>
                            <td className="px-3 py-3">{line.receivedQty}</td>
                            <td className="px-3 py-3 text-muted-foreground text-xs">{formatDate(line.receivedDate)}</td>
                            <td className="px-3 py-3">{line.billedQty}</td>
                            <td className="px-3 py-3">{formatCurrency(line.billedUnitPrice)}</td>
                            <td className="px-3 py-3 font-medium">{formatCurrency(line.billedAmount)}</td>
                            <td className="px-3 py-3">
                              <MatchStatusBadge status={line.matchStatus} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/20 border-t-2">
                        <td className="px-3 py-3 font-medium">الإجمالي</td>
                        <td colSpan={4} />
                        <td className="px-3 py-3 font-medium">{selectedLines.reduce((s, l) => s + l.billedQty, 0)}</td>
                        <td colSpan={2} />
                        <td className="px-3 py-3 font-medium">{formatCurrency(selectedLines.reduce((s, l) => s + l.billedAmount, 0))} ريال</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {selectedLines.filter((l) => l.matchStatus !== 'مطابق').length > 0 && (
                <div className="rounded-xl border bg-card p-5">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    الفروقات المكتشفة
                  </h3>
                  <div className="space-y-2">
                    {selectedLines.filter((l) => l.matchStatus !== 'مطابق').map((line) => {
                      const qtyDiff = line.billedQty - line.receivedQty
                      const priceDiff = line.billedUnitPrice - line.unitPrice
                      return (
                        <div key={line.id} className="flex items-center gap-3 p-3 rounded-lg border text-sm">
                          <span className="font-medium w-32">{line.item}</span>
                          {qtyDiff !== 0 && (
                            <span className={cn('flex items-center gap-1', qtyDiff > 0 ? 'text-red-600' : 'text-amber-600')}>
                              <ArrowUpDown className="h-3 w-3" />
                              كمية: {qtyDiff > 0 ? '+' : ''}{qtyDiff}
                            </span>
                          )}
                          {priceDiff !== 0 && (
                            <span className={cn('flex items-center gap-1', priceDiff > 0 ? 'text-red-600' : 'text-green-600')}>
                              <DollarSign className="h-3 w-3" />
                              سعر: {formatCurrency(priceDiff)}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground mr-auto">
                            الفرق الإجمالي: {formatCurrency(line.billedAmount - (line.receivedQty * line.unitPrice))} ريال
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
                  <span className="text-2xl font-bold text-green-600">{formatCurrency(matchedTotal)} ريال</span>
                  <p className="text-xs text-green-700 mt-1">إجمالي المطابقات الناجحة</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
                  <span className="text-2xl font-bold text-red-600">{formatCurrency(unmatchedTotal)} ريال</span>
                  <p className="text-xs text-red-700 mt-1">إجمالي الفروقات</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 pb-4 flex-wrap">
                <Button className="h-9 text-xs gap-1.5"><CheckSquare className="h-4 w-4" />مطابقة</Button>
                <Button variant="secondary" className="h-9 text-xs gap-1.5"><Percent className="h-4 w-4" />مطابقة جزئية</Button>
                <Button variant="outline" className="h-9 text-xs gap-1.5"><Ban className="h-4 w-4" />تعليق للمراجعة</Button>
                <Button variant="outline" className="h-9 text-xs gap-1.5"><FileText className="h-4 w-4" />إنشاء إشعار دائن</Button>
                <Button variant="outline" className="h-9 text-xs gap-1.5"><FileText className="h-4 w-4" />إنشاء إشعار مدين</Button>
                <Button variant="destructive" className="h-9 text-xs gap-1.5"><Scale className="h-4 w-4" />رفع نزاع</Button>
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
        entityId={selectedMatch?.id}
        entityType="مطابقة فاتورة"
      />
    </WorkbenchShell>
  )
}
