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
import type { Invoice, InvoiceLine, ValidationMessage, AIInsight, AuditTrailEntry, OperationalComment, InspectorTab, WorkbenchMetric, WorkbenchAction } from '@/lib/workbench/types'

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'مسودة', color: 'text-gray-600 bg-gray-100 border-gray-300' },
  pending: { label: 'قيد الإرسال', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  approved: { label: 'مرسلة', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  paid: { label: 'مدفوعة', color: 'text-green-600 bg-green-50 border-green-200' },
  overdue: { label: 'متأخرة', color: 'text-red-600 bg-red-50 border-red-200' },
  cancelled: { label: 'ملغاة', color: 'text-rose-600 bg-rose-50 border-rose-200' },
}

const pipelineStages = [
  { key: 'draft', label: 'مسودة' }, { key: 'pending', label: 'قيد الإرسال' }, { key: 'approved', label: 'مرسلة' }, { key: 'paid', label: 'مدفوعة' },
]

const statusOrder: Record<string, number> = { draft: 0, pending: 1, approved: 2, paid: 3, overdue: 1.5, cancelled: -1 }

function formatCurrency(amount: number): string { return amount.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) }

function formatDate(ts: number): string { return new Date(ts).toLocaleDateString('ar-SA') }

function getPipelineProgress(status: string): number {
  if (status === 'cancelled') return 0
  const idx = statusOrder[status]
  if (idx === undefined) return 0
  return Math.round((idx / 3) * 100)
}

export function InvoicingWorkbench() {
  const [invoices] = useState<Invoice[]>(() => generateMockInvoices(25, 'receivable'))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [activeInspectorTab, setActiveInspectorTab] = useState('info')
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [validations] = useState<ValidationMessage[]>(() => generateMockValidationMessages('sales'))
  const [aiInsights] = useState<AIInsight[]>(() => generateMockAIInsights('sales'))
  const [auditEntries] = useState<AuditTrailEntry[]>(() => generateMockAuditTrail())
  const [comments] = useState<OperationalComment[]>(() => generateMockOperationalComments())

  const metrics: WorkbenchMetric[] = useMemo(() => {
    const drafts = invoices.filter((i) => i.status === 'draft').length
    const pendingSend = invoices.filter((i) => i.status === 'pending').length
    const overdue = invoices.filter((i) => i.status === 'overdue').length
    const paidThisMonth = invoices.filter((i) => i.status === 'paid' && new Date(i.date).getMonth() === new Date().getMonth()).length
    return [
      { id: 'drafts', label: 'مسودة', value: drafts, change: -3, trend: 'down', icon: 'FileText', severity: 'info' },
      { id: 'pending', label: 'بانتظار الإرسال', value: pendingSend, change: 8, trend: 'up', icon: 'Send', severity: 'warning' },
      { id: 'overdue', label: 'متأخرة', value: overdue, change: 12, trend: 'up', icon: 'AlertTriangle', severity: 'critical' },
      { id: 'collected', label: 'محصل هذا الشهر', value: paidThisMonth, change: 22, trend: 'up', icon: 'DollarSign', severity: 'success' },
    ]
  }, [invoices])

  const filteredInvoices = useMemo(() => {
    let result = [...invoices]
    if (statusFilter !== 'all') result = result.filter((i) => i.status === statusFilter)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((i) => i.number.toLowerCase().includes(q) || i.vendorOrCustomer.toLowerCase().includes(q))
    }
    return result.sort((a, b) => b.date - a.date)
  }, [invoices, statusFilter, searchQuery])

  const selectedInvoice = useMemo(() => invoices.find((i) => i.id === selectedId) ?? null, [invoices, selectedId])

  const inspectorTabs: InspectorTab[] = useMemo(() => [
    { id: 'info', label: 'تفاصيل الفاتورة', icon: 'info', badge: selectedInvoice?.lines.length },
    { id: 'activity', label: 'النشاط', icon: 'activity' },
    { id: 'message', label: 'التعليقات', icon: 'message', badge: comments.length },
  ], [selectedInvoice, comments])

  const actions: WorkbenchAction[] = useMemo(() => [
    { id: 'new-invoice', label: 'فاتورة جديدة', type: 'primary', icon: 'Plus', handler: () => {} },
    { id: 'batch', label: batchMode ? 'إنهاء التحديد' : 'تحديد متعدد', type: 'secondary', icon: 'CheckSquare', handler: () => { setBatchMode(!batchMode); setSelectedIds(new Set()) } },
    { id: 'refresh', label: 'تحديث', type: 'secondary', icon: 'RefreshCw', handler: () => {} },
    { id: 'export', label: 'تصدير', type: 'ghost', icon: 'Download', handler: () => {} },
  ], [batchMode])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const statusFilters = [
    { key: 'all', label: 'الكل' }, { key: 'draft', label: 'مسودة' }, { key: 'pending', label: 'قيد الإرسال' },
    { key: 'approved', label: 'مرسلة' }, { key: 'overdue', label: 'متأخرة' }, { key: 'paid', label: 'مدفوعة' }, { key: 'cancelled', label: 'ملغاة' },
  ]

  return (
    <WorkbenchShell
      title="منصة الفوترة"
      description="إدارة فواتير العملاء ومتابعة التحصيل"
      breadcrumbs={[{ label: 'المبيعات', icon: ShoppingCart }, { label: 'الفوترة' }]}
      metrics={metrics}
      actions={actions}
      inspectorTabs={inspectorTabs}
      inspectorOpen={inspectorOpen}
      onInspectorToggle={setInspectorOpen}
      inspectorTab={activeInspectorTab}
      onInspectorTabChange={setActiveInspectorTab}
      inspectorContent={selectedInvoice ? (
        <>
            {activeInspectorTab === 'info' && (
            <div className="space-y-4">
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">الفاتورة</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">الرقم:</span> <span className="font-medium">{selectedInvoice.number}</span></div>
                  <div><span className="text-muted-foreground">العميل:</span> <span className="font-medium">{selectedInvoice.vendorOrCustomer}</span></div>
                  <div><span className="text-muted-foreground">التاريخ:</span> <span className="font-medium">{formatDate(selectedInvoice.date)}</span></div>
                  <div><span className="text-muted-foreground">تاريخ الاستحقاق:</span> <span className="font-medium">{formatDate(selectedInvoice.dueDate)}</span></div>
                  <div><span className="text-muted-foreground">المبلغ:</span> <span className="font-medium">{formatCurrency(selectedInvoice.amount)} ر.س</span></div>
                  <div><span className="text-muted-foreground">المدفوع:</span> <span className="font-medium">{formatCurrency(selectedInvoice.paidAmount)} ر.س</span></div>
                  <div><span className="text-muted-foreground">المتبقي:</span> <span className={cn('font-medium', selectedInvoice.balance > 0 ? 'text-amber-600' : 'text-green-600')}>{formatCurrency(selectedInvoice.balance)} ر.س</span></div>
                  <div className="col-span-2">
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', statusLabels[selectedInvoice.status]?.color)}>
                      {statusLabels[selectedInvoice.status]?.label}
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">نسبة الدفع</span>
                    <span className="font-semibold">{selectedInvoice.amount > 0 ? Math.round((selectedInvoice.paidAmount / selectedInvoice.amount) * 100) : 0}%</span>
                  </div>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${selectedInvoice.amount > 0 ? Math.round((selectedInvoice.paidAmount / selectedInvoice.amount) * 100) : 0}%` }} />
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground">أيام إلى الاستحقاق</span>
                    <span className="font-medium">{Math.round((selectedInvoice.dueDate - Date.now()) / 86400000)} يوم</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">العملة</span>
                    <span className="font-medium">{selectedInvoice.currency}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">بنود الفاتورة ({selectedInvoice.lines.length})</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-right py-2 font-medium">البيان</th>
                      <th className="text-right py-2 font-medium">الكمية</th>
                      <th className="text-right py-2 font-medium">سعر الوحدة</th>
                      <th className="text-right py-2 font-medium">ضريبة</th>
                      <th className="text-left py-2 font-medium">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.lines.map((line) => (
                      <tr key={line.id} className="border-b last:border-b-0">
                        <td className="py-2">{line.description}</td>
                        <td className="py-2">{line.quantity}</td>
                        <td className="py-2">{formatCurrency(line.unitPrice)}</td>
                        <td className="py-2">{formatCurrency(line.tax)}</td>
                        <td className="py-2 text-left font-medium">{formatCurrency(line.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t"><td colSpan={4} className="py-2 text-left">المجموع قبل الضريبة</td><td className="py-2 text-left">{formatCurrency(selectedInvoice.lines.reduce((s, l) => s + l.amount, 0))}</td></tr>
                    <tr className="text-muted-foreground"><td colSpan={4} className="py-1 text-left">ضريبة القيمة المضافة 15%</td><td className="py-1 text-left">{formatCurrency(selectedInvoice.lines.reduce((s, l) => s + l.tax, 0))}</td></tr>
                    <tr className="border-t font-bold"><td colSpan={4} className="py-2 text-left">الإجمالي النهائي</td><td className="py-2 text-left">{formatCurrency(selectedInvoice.amount)} ر.س</td></tr>
                  </tfoot>
                </table>
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">مسار الفاتورة</h4>
                <div className="relative">
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${getPipelineProgress(selectedInvoice.status)}%` }} />
                  </div>
                  <div className="flex justify-between">
                    {pipelineStages.map((stage, idx) => {
                      const currentIdx = statusOrder[selectedInvoice.status] ?? -1
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
                <h4 className="text-sm font-semibold mb-3">سجل الدفعات</h4>
                {selectedInvoice.status === 'paid' ? (
                  <div className="flex items-center gap-3 text-sm text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>تم تحصيل كامل المبلغ ({formatCurrency(selectedInvoice.amount)} ر.س)</span>
                  </div>
                ) : selectedInvoice.paidAmount > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">مدفوع جزئياً</span>
                      <span className="font-medium">{formatCurrency(selectedInvoice.paidAmount)} ر.س</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">المتبقي</span>
                      <span className="font-medium text-amber-600">{formatCurrency(selectedInvoice.balance)} ر.س</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Clock className="h-5 w-5" />
                    <span>لا توجد دفعات مسجلة بعد</span>
                  </div>
                )}
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">الإجراءات</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedInvoice.status === 'draft' && (<Button size="sm" className="gap-1"><Send className="h-3.5 w-3.5" />إرسال الفاتورة</Button>)}
                  {selectedInvoice.status === 'approved' && (<Button size="sm" className="gap-1"><DollarSign className="h-3.5 w-3.5" />تسجيل دفعة</Button>)}
                  {selectedInvoice.status === 'overdue' && (<Button size="sm" className="gap-1"><Send className="h-3.5 w-3.5" />إرسال تذكير</Button>)}
                  {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' && (<Button size="sm" variant="secondary" className="gap-1"><CreditCard className="h-3.5 w-3.5" />إشعار دائن</Button>)}
                  <Button size="sm" variant="secondary" className="gap-1"><Printer className="h-3.5 w-3.5" />طباعة</Button>
                  <Button size="sm" variant="ghost" className="gap-1"><Download className="h-3.5 w-3.5" />PDF</Button>
                </div>
              </div>
            </div>
          )}
          {activeInspectorTab === 'activity' && (
            <div className="space-y-3">
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">النشاطات الأخيرة</h4>
                <div className="space-y-3">
                  {[
                    { action: 'إنشاء الفاتورة', date: selectedInvoice.date, actor: 'النظام' },
                    { action: 'إرسال الفاتورة للعميل', date: selectedInvoice.date + 86400000, actor: 'أحمد محمد' },
                    ...(selectedInvoice.status === 'paid' ? [{ action: 'تسجيل دفعة', date: selectedInvoice.dueDate - 86400000, actor: 'سارة خالد' }] : []),
                    ...(selectedInvoice.status === 'overdue' ? [{ action: 'إرسال تذكير دفع', date: selectedInvoice.dueDate + 86400000 * 3, actor: 'النظام' }] : []),
                  ].map((act, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary/50" />
                      <div className="flex-1">
                        <p className="text-sm">{act.action}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{act.actor}</span>
                          <span>{formatDate(act.date)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <h4 className="text-sm font-semibold mb-3">سجل التذكيرات</h4>
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Send className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">لم يتم إرسال أي تذكيرات بعد</p>
                </div>
              </div>
            </div>
          )}
          {activeInspectorTab === 'message' && (<OperationalCommenting comments={comments} />)}
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
              <div className="flex items-center gap-1"><span className="text-muted-foreground">إجمالي الفواتير:</span><span className="font-semibold">{formatCurrency(invoices.reduce((s, i) => s + i.amount, 0))} ر.س</span></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1"><span className="text-muted-foreground">المدفوع:</span><span className="font-semibold text-green-600">{formatCurrency(invoices.reduce((s, i) => s + i.paidAmount, 0))} ر.س</span></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1"><span className="text-muted-foreground">المتبقي:</span><span className="font-semibold text-amber-600">{formatCurrency(invoices.reduce((s, i) => s + i.balance, 0))} ر.س</span></div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">متوسط الدفع:</span>
              <span className="font-semibold">{Math.round(invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0) / Math.max(invoices.filter((i) => i.status === 'paid').length, 1))} ر.س</span>
            </div>
          </div>
        </div>
        <div className="border-b bg-card px-6 py-3 shrink-0">
          <div className="flex gap-3 items-center flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="بحث برقم الفاتورة أو العميل..." className="flex h-9 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {statusFilters.map((f) => (
                <button key={f.key} type="button" onClick={() => setStatusFilter(f.key)} className={cn('px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors', statusFilter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>{f.label}</button>
              ))}
            </div>
            {batchMode && selectedIds.size > 0 && (
              <div className="flex items-center gap-2 mr-auto">
                <span className="text-xs text-muted-foreground">تم تحديد {selectedIds.size}</span>
                <Button size="sm" variant="secondary" className="h-8 text-xs gap-1"><Send className="h-3 w-3" />إرسال</Button>
                <Button size="sm" variant="secondary" className="h-8 text-xs gap-1"><Printer className="h-3 w-3" />طباعة</Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs gap-1"><X className="h-3 w-3" />إلغاء</Button>
              </div>
            )}
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setAiPanelOpen(!aiPanelOpen)}>
              <Sparkles className={cn('h-4 w-4', aiPanelOpen && 'text-primary')} />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <FileText className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-semibold mb-1">لا توجد فواتير</h3>
              <p className="text-sm text-muted-foreground">{searchQuery || statusFilter !== 'all' ? 'لا توجد نتائج للبحث' : 'لم يتم إنشاء أي فواتير بعد'}</p>
              {(searchQuery || statusFilter !== 'all') && (<Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setStatusFilter('all') }}>مسح التصفية</Button>)}
            </div>
          ) : (
            <div className="divide-y">
              {filteredInvoices.map((invoice) => {
                const sl = statusLabels[invoice.status]
                const isSelected = invoice.id === selectedId
                const isChecked = selectedIds.has(invoice.id)
                return (
                  <div key={invoice.id} className={cn('flex items-center gap-4 px-6 py-4 cursor-pointer transition-colors hover:bg-muted/30', isSelected && 'bg-primary/5 border-r-2 border-primary', invoice.status === 'overdue' && 'bg-red-50/30')} onClick={() => !batchMode && setSelectedId(invoice.id)}>
                    {batchMode && (
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(invoice.id)} className="h-4 w-4 rounded border-gray-300" />
                      </div>
                    )}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className={cn('p-2 rounded-lg', invoice.status === 'paid' ? 'bg-green-50' : invoice.status === 'overdue' ? 'bg-red-50' : 'bg-primary/10')}>
                        <FileText className={cn('h-5 w-5', invoice.status === 'paid' ? 'text-green-600' : invoice.status === 'overdue' ? 'text-red-600' : 'text-primary')} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-bold">{invoice.number}</span>
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border', sl?.color)}>{sl?.label}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{invoice.vendorOrCustomer}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(invoice.date)}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />استحقاق: {formatDate(invoice.dueDate)}</span>
                        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />المتبقي: {formatCurrency(invoice.balance)}</span>
                      </div>
                      {invoice.balance > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden flex-1 max-w-[150px]">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.round((invoice.paidAmount / invoice.amount) * 100)}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground">مدفوع {formatCurrency(invoice.paidAmount)} / {formatCurrency(invoice.amount)}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-left shrink-0">
                      <p className="text-sm font-bold">{formatCurrency(invoice.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">ر.س</p>
                      {invoice.balance > 0 && <p className="text-[10px] text-amber-600 font-medium">المتبقي: {formatCurrency(invoice.balance)}</p>}
                    </div>
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
            <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{invoices.length} فاتورة</span>
            <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{formatCurrency(invoices.reduce((s, i) => s + i.amount, 0))} ر.س</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{invoices.filter((i) => i.status === 'paid').length} مدفوعة</span>
            <span className={cn('flex items-center gap-1', invoices.filter((i) => i.status === 'overdue').length > 0 && 'text-red-600')}>
              <AlertTriangle className="h-3 w-3" />{invoices.filter((i) => i.status === 'overdue').length} متأخرة
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setAuditOpen(true)}><Shield className="h-3 w-3" />سجل التدقيق</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"><Printer className="h-3 w-3" />طباعة الكل</Button>
          </div>
        </div>
      </div>

      <AuditOverlay entries={auditEntries} open={auditOpen} onClose={() => setAuditOpen(false)} entityId={selectedId ?? undefined} entityType="فاتورة" />
    </WorkbenchShell>
  )
}

const taxBrackets = [
  { rate: 15, label: 'ضريبة القيمة المضافة 15%', code: 'VAT-15', category: 'قياسي' },
  { rate: 0, label: 'غير خاضع للضريبة', code: 'VAT-EX', category: 'إعفاء' },
  { rate: 5, label: 'ضريبة القيمة المضافة 5%', code: 'VAT-5', category: 'مخفض' },
]

const paymentMethods = [
  { code: 'CASH', label: 'نقداً', processingTime: 'فوري', fee: '0%' },
  { code: 'BANK_TRANSFER', label: 'تحويل بنكي', processingTime: '1-2 يوم', fee: '0%' },
  { code: 'CREDIT_CARD', label: 'بطاقة ائتمان', processingTime: 'فوري', fee: '2.5%' },
  { code: 'CHECK', label: 'شيك', processingTime: '1-3 يوم', fee: '0%' },
  { code: 'MADA', label: 'مدى', processingTime: 'فوري', fee: '0.8%' },
]

const invoiceTemplates = [
  { id: 'standard', label: 'قياسي', description: 'تصميم قياسي للفواتير' },
  { id: 'detailed', label: 'مفصل', description: 'فواتير مفصلة مع بنود كاملة' },
  { id: 'summary', label: 'ملخص', description: 'فواتير مختصرة مع إجماليات' },
  { id: 'tax', label: 'ضريبي', description: 'فواتير ضريبية مع تفصيل الضريبة' },
]
