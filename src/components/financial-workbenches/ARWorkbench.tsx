'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Wallet, Search, Filter, ArrowUpDown, Plus, Download,
  CheckCircle2, XCircle, AlertTriangle, Eye, Clock, User,
  FileText, DollarSign, Building2, Landmark, ArrowLeftRight,
  Receipt, Sparkles, Shield, Activity, TrendingUp, TrendingDown,
  CreditCard, Calendar, Mail, Phone, Percent,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { WorkbenchShell } from '@/components/workbench/WorkbenchShell'
import { InspectorPanel } from '@/components/workbench/InspectorPanel'
import { RealtimeValidationBar } from '@/components/workbench/RealtimeValidationBar'
import { AIAssistancePanel } from '@/components/workbench/AIAssistancePanel'
import { TransactionGraph } from '@/components/workbench/TransactionGraph'
import { AuditOverlay } from '@/components/workbench/AuditOverlay'
import { OperationalCommenting } from '@/components/workbench/OperationalCommenting'
import { CrossEntityInspector } from '@/components/workbench/CrossEntityInspector'
import { DocumentViewer } from '@/components/workbench/DocumentViewer'
import { generateMockInvoices, generateMockAccounts, generateMockAIInsights, generateMockAuditTrail, generateMockDocuments, generateMockOperationalComments, generateMockCustomers } from '@/lib/workbench/mock-data'
import type { Invoice, AccountSummary, ValidationMessage, AIInsight, WorkbenchMetric, InspectorTab, DocumentAttachment, AuditTrailEntry } from '@/lib/workbench/types'

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'; icon: any }> = {
  pending: { label: 'معلقة', variant: 'warning', icon: Clock },
  approved: { label: 'معتمدة', variant: 'success', icon: CheckCircle2 },
  paid: { label: 'مدفوعة', variant: 'default', icon: DollarSign },
  overdue: { label: 'متأخرة', variant: 'destructive', icon: AlertTriangle },
  draft: { label: 'مسودة', variant: 'secondary', icon: FileText },
  cancelled: { label: 'ملغية', variant: 'outline', icon: XCircle },
}

const filterTabs = [
  { id: 'all', label: 'الكل' },
  { id: 'pending', label: 'معلقة' },
  { id: 'approved', label: 'معتمدة' },
  { id: 'overdue', label: 'متأخرة' },
  { id: 'paid', label: 'مدفوعة' },
]

export function ARWorkbench() {
  const [invoices] = useState(() => generateMockInvoices(20, 'receivable'))
  const [customers] = useState(() => generateMockCustomers())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState('all')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorTab, setInspectorTab] = useState('customer')
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [detailTab, setDetailTab] = useState('details')
  const [showGraph, setShowGraph] = useState(false)
  const [activeDoc, setActiveDoc] = useState<DocumentAttachment | null>(null)

  const aiInsights = useMemo(() => generateMockAIInsights('ar'), [])
  const auditTrail = useMemo(() => generateMockAuditTrail(), [])

  const selected = useMemo(
    () => invoices.find((i) => i.id === selectedId) ?? null,
    [invoices, selectedId],
  )

  const selectedCustomer = useMemo(
    () => customers.find((c) => selected && c.name === selected.vendorOrCustomer) ?? null,
    [customers, selected],
  )

  const filtered = useMemo(() => {
    let list = invoices
    if (filterTab !== 'all') {
      if (filterTab === 'overdue') {
        list = list.filter((i) => i.status === 'overdue' || (i.status === 'pending' && i.dueDate < Date.now()))
      } else {
        list = list.filter((i) => i.status === filterTab)
      }
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (i) =>
          i.number.toLowerCase().includes(q) ||
          i.vendorOrCustomer.toLowerCase().includes(q),
      )
    }
    return list.sort((a, b) => a.dueDate - b.dueDate)
  }, [invoices, filterTab, searchQuery])

  const allValidationMessages = useMemo(() => {
    if (!selected) return []
    const msgs = [...(selected.validationMessages ?? [])]
    if (selected.balance > 0 && selected.status === 'paid') {
      msgs.push({
        id: 'balance-warn',
        type: 'warning' as const,
        message: 'الفاتورة مدفوعة لكن يوجد رصيد متبقي',
        field: 'الرصيد',
        action: { label: 'مراجعة', handler: () => {} },
      })
    }
    if (selected.dueDate < Date.now() && selected.status !== 'paid' && selected.status !== 'cancelled') {
      msgs.push({
        id: 'overdue-ar',
        type: 'error' as const,
        message: 'الفاتورة متأخرة - يرجى اتخاذ إجراء تحصيل',
        field: 'تاريخ الاستحقاق',
        action: { label: 'إرسال إشعار', handler: () => {} },
      })
    }
    if (selectedCustomer && selected.balance > (selectedCustomer as any).creditLimit * 0.8) {
      msgs.push({
        id: 'credit-warn',
        type: 'warning' as const,
        message: 'الرصيد يقترب من حد الائتمان',
        field: 'حد الائتمان',
        action: { label: 'مراجعة', handler: () => {} },
      })
    }
    return msgs.slice(0, 8)
  }, [selected, selectedCustomer])

  const metrics: WorkbenchMetric[] = useMemo(() => {
    const totalDue = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled').reduce((s, i) => s + i.balance, 0)
    const pendingCount = invoices.filter((i) => i.status === 'pending').length
    const overdueCount = invoices.filter((i) => i.status === 'overdue' || (i.status === 'pending' && i.dueDate < Date.now())).length
    const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0)
    const totalAmount = invoices.reduce((s, i) => s + i.amount, 0)
    const collectionRate = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0
    return [
      { id: 'total-ar', label: 'إجمالي المستحقات', value: totalDue.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) + ' ريال', icon: 'DollarSign', severity: 'info' as const, change: 6.7, trend: 'up' as const },
      { id: 'pending-ar', label: 'فواتير معلقة', value: pendingCount, icon: 'AlertTriangle', severity: 'warning' as const, change: -2.3, trend: 'down' as const },
      { id: 'overdue-ar', label: 'متأخرة عن السداد', value: overdueCount, icon: 'AlertTriangle', severity: 'critical' as const, change: 15.1, trend: 'up' as const },
      { id: 'collection', label: 'نسبة التحصيل', value: `${collectionRate}%`, icon: 'DollarSign', severity: collectionRate > 70 ? 'success' as const : 'warning' as const, change: 3.2, trend: 'up' as const },
    ]
  }, [invoices])

  const inspectorTabs: InspectorTab[] = useMemo(
    () => [
      { id: 'customer', label: 'معلومات العميل', icon: 'info' },
      { id: 'aging', label: 'تحليل التقادم', icon: 'activity' },
      { id: 'attachments', label: 'المرفقات', icon: 'paperclip', badge: (selected as any)?.attachments?.length ?? 0 },
    ],
    [selected],
  )

  const handleApprove = () => {}
  const handleReject = () => {}
  const handlePost = () => {}
  const handleSendReminder = () => {}
  const handleApplyPayment = () => {}

  const formatCurrency = (n: number) =>
    n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const renderInvoiceList = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث عن فاتورة..."
              className="flex h-9 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
            <Filter className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors',
                filterTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">لا توجد فواتير متطابقة</p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((inv) => {
              const config = statusConfig[inv.status] || statusConfig.draft
              const StatusIcon = config.icon
              const isSelected = inv.id === selectedId
              const isOverdue = inv.dueDate < Date.now() && inv.status !== 'paid' && inv.status !== 'cancelled'
              const cust = customers.find((c) => c.name === inv.vendorOrCustomer)
              return (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => setSelectedId(inv.id)}
                  className={cn(
                    'w-full text-right p-4 transition-colors hover:bg-accent/50',
                    isSelected && 'bg-accent border-r-2 border-r-primary',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                      isOverdue ? 'bg-red-50 text-red-600' : 'bg-primary/10 text-primary',
                    )}>
                      <Receipt className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold truncate">{inv.number}</span>
                        <div className={cn(
                          'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                          inv.status === 'overdue' ? 'bg-red-50 text-red-700' :
                          inv.status === 'paid' ? 'bg-green-50 text-green-700' :
                          inv.status === 'approved' ? 'bg-blue-50 text-blue-700' :
                          'bg-amber-50 text-amber-700',
                        )}>
                          <StatusIcon className="h-2.5 w-2.5" />
                          <span>{config.label}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{inv.vendorOrCustomer}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs">
                        <span className="font-semibold" dir="ltr">
                          {formatCurrency(inv.amount)} ريال
                        </span>
                        {isOverdue && (
                          <span className="text-red-600 flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" />
                            متأخرة
                          </span>
                        )}
                        {cust && (
                          <span className="text-muted-foreground flex items-center gap-0.5">
                            <Percent className="h-3 w-3" />
                            {(cust as any).creditLimit ? Math.round((inv.balance / (cust as any).creditLimit) * 100) : 0}% من الائتمان
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="border-t p-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'فاتورة' : 'فواتير'}
        </span>
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
          <Download className="h-3.5 w-3.5" />
          تصدير
        </Button>
      </div>
    </div>
  )

  const renderInvoiceDetail = () => {
    if (!selected) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-12">
          <Receipt className="h-16 w-16 text-muted-foreground/20 mb-4" />
          <h3 className="text-lg font-semibold mb-2">اختر فاتورة</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            اختر فاتورة من القائمة لعرض تفاصيلها وإدارة عمليات التحصيل
          </p>
        </div>
      )
    }

    const config = statusConfig[selected.status] || statusConfig.draft
    const StatusIcon = config.icon
    const isOverdue = selected.dueDate < Date.now() && selected.status !== 'paid' && selected.status !== 'cancelled'

    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                'h-14 w-14 rounded-xl flex items-center justify-center',
                isOverdue ? 'bg-red-50' : 'bg-primary/10',
              )}>
                <Receipt className={cn('h-7 w-7', isOverdue ? 'text-red-600' : 'text-primary')} />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-bold">{selected.number}</h2>
                  <Badge variant={config.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                  {isOverdue && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      متأخرة
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {selected.vendorOrCustomer}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(selected.date).toLocaleDateString('ar-SA')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    يستحق: {new Date(selected.dueDate).toLocaleDateString('ar-SA')}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-left" dir="ltr">
              <div className="text-3xl font-bold tracking-tight">{formatCurrency(selected.amount)}</div>
              <div className="text-sm text-muted-foreground">ريال سعودي</div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" className="gap-1.5" onClick={handleApprove}>
              <CheckCircle2 className="h-4 w-4" />
              اعتماد
            </Button>
            <Button size="sm" variant="destructive" className="gap-1.5" onClick={handleReject}>
              <XCircle className="h-4 w-4" />
              رفض
            </Button>
            <Button size="sm" variant="secondary" className="gap-1.5" onClick={handlePost}>
              <ArrowLeftRight className="h-4 w-4" />
              ترحيل
            </Button>
            <Button size="sm" variant="default" className="gap-1.5" onClick={handleApplyPayment}>
              <DollarSign className="h-4 w-4" />
              تطبيق دفعة
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleSendReminder}>
              <Mail className="h-4 w-4" />
              إرسال تذكير
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setShowGraph(!showGraph)}>
              <Activity className="h-4 w-4" />
              {showGraph ? 'إخفاء الرسم البياني' : 'عرض الرسم البياني'}
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setAuditOpen(true)}>
              <Shield className="h-4 w-4" />
              سجل التدقيق
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setAiOpen(!aiOpen)}>
              <Sparkles className="h-4 w-4" />
              الذكاء الاصطناعي
            </Button>
          </div>
        </div>

        {showGraph && (
          <div className="border-b">
            <div className="p-4">
              <TransactionGraph
                entries={selected.lines.map((line) => ({
                  accountId: line.accountCode,
                  accountName: line.description,
                  amount: line.total,
                  relatedAccountId: selected.vendorOrCustomer,
                  description: `فاتورة مبيعات ${selected.number}`,
                  type: 'revenue',
                }))}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <Tabs value={detailTab} onValueChange={setDetailTab} className="p-6 pt-4" dir="rtl">
            <TabsList className="mb-4">
              <TabsTrigger value="details">تفاصيل الفاتورة</TabsTrigger>
              <TabsTrigger value="collection">التحصيل</TabsTrigger>
              <TabsTrigger value="attachments">المرفقات</TabsTrigger>
              <TabsTrigger value="activities">النشاطات</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-0 space-y-6">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>البيان</TableHead>
                        <TableHead className="text-center">الكمية</TableHead>
                        <TableHead className="text-center">سعر الوحدة</TableHead>
                        <TableHead className="text-center">المبلغ</TableHead>
                        <TableHead className="text-center">الضريبة 15%</TableHead>
                        <TableHead className="text-center">الإجمالي</TableHead>
                        <TableHead className="text-center">حساب</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="font-medium">{line.description}</TableCell>
                          <TableCell className="text-center">{line.quantity}</TableCell>
                          <TableCell className="text-center" dir="ltr">{formatCurrency(line.unitPrice)}</TableCell>
                          <TableCell className="text-center" dir="ltr">{formatCurrency(line.amount)}</TableCell>
                          <TableCell className="text-center" dir="ltr">{formatCurrency(line.tax)}</TableCell>
                          <TableCell className="text-center font-semibold" dir="ltr">{formatCurrency(line.total)}</TableCell>
                          <TableCell className="text-center">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{line.accountCode}</code>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">مجموع المبلغ</div>
                    <div className="text-lg font-bold" dir="ltr">{formatCurrency(selected.lines.reduce((s, l) => s + l.amount, 0))} ريال</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">إجمالي الضريبة</div>
                    <div className="text-lg font-bold" dir="ltr">{formatCurrency(selected.lines.reduce((s, l) => s + l.tax, 0))} ريال</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">الرصيد المتبقي</div>
                    <div className="text-lg font-bold text-primary" dir="ltr">{formatCurrency(selected.balance)} ريال</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold mb-3">معلومات إضافية</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">رقم الفاتورة</span>
                      <span className="font-medium">{selected.number}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">العميل</span>
                      <span className="font-medium">{selected.vendorOrCustomer}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">تاريخ الفاتورة</span>
                      <span className="font-medium">{new Date(selected.date).toLocaleDateString('ar-SA')}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">تاريخ الاستحقاق</span>
                      <span className="font-medium">{new Date(selected.dueDate).toLocaleDateString('ar-SA')}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">العملة</span>
                      <span className="font-medium">{selected.currency}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">المبلغ</span>
                      <span className="font-medium" dir="ltr">{formatCurrency(selected.amount)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">المدفوع</span>
                      <span className="font-medium" dir="ltr">{formatCurrency(selected.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">الرصيد</span>
                      <span className="font-medium text-primary" dir="ltr">{formatCurrency(selected.balance)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="collection" className="mt-0 space-y-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold">سجل التحصيل</h4>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                      <Plus className="h-3.5 w-3.5" />
                      تسجيل دفعة
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>المرجع</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>طريقة الدفع</TableHead>
                        <TableHead>الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.paidAmount > 0 ? (
                        <TableRow>
                          <TableCell>{new Date(selected.date + 86400000 * 15).toLocaleDateString('ar-SA')}</TableCell>
                          <TableCell>PAY-{selected.number.slice(-4)}</TableCell>
                          <TableCell dir="ltr">{formatCurrency(selected.paidAmount)} ريال</TableCell>
                          <TableCell>تحويل بنكي</TableCell>
                          <TableCell><Badge variant="success">مدفوع</Badge></TableCell>
                        </TableRow>
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                            لا توجد دفعات مسجلة
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {isOverdue && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-amber-800">إجراءات التحصيل الموصى بها</h4>
                        <ul className="mt-2 space-y-1 text-sm text-amber-700">
                          <li>• إرسال إشعار تذكير بالدفع للعميل</li>
                          <li>• الاتصال بالعميل لمتابعة التحصيل</li>
                          <li>• تطبيق غرامة تأخير السداد إن وجدت</li>
                          <li>• تعليق الطلبات الجديدة للعميل لحين السداد</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="attachments" className="mt-0 space-y-3">
              {(selected as any).attachments && (selected as any).attachments.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {(selected as any).attachments.map((doc: any) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setActiveDoc(doc)}
                      className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-accent transition-colors text-right"
                    >
                      <div className="p-2 rounded-lg bg-primary/10">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.uploadedBy}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">لا توجد مرفقات</p>
                  <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" />
                    إضافة مرفق
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="activities" className="mt-0 space-y-4">
              <div className="space-y-3">
                {auditTrail.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium">{entry.action}</span>
                        <span className="text-xs text-muted-foreground">بواسطة</span>
                        <span className="text-xs font-medium">{entry.actor}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{entry.details}</p>
                      <span className="text-xs text-muted-foreground mt-1 block">
                        {new Date(entry.timestamp).toLocaleDateString('ar-SA')} - {new Date(entry.timestamp).toLocaleTimeString('ar-SA')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col h-[400px] border rounded-xl">
                <OperationalCommenting
                  comments={(selected as any).comments ?? generateMockOperationalComments()}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {allValidationMessages.length > 0 && (
          <div className="shrink-0">
            <RealtimeValidationBar messages={allValidationMessages} />
          </div>
        )}
      </div>
    )
  }

  const renderInspectorContent = () => {
    if (!selected) return null
    switch (inspectorTab) {
      case 'customer':
        return (
          <div className="space-y-4">
            <CrossEntityInspector entityType="customer" entityId={selected.vendorOrCustomer} />
          </div>
        )
      case 'aging':
        return (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">تحليل التقادم</h4>
            <div className="space-y-2">
              {[
                { label: 'حالي', amount: selected.balance * 0.3, color: 'bg-green-500' },
                { label: '1-30 يوم', amount: selected.balance * 0.25, color: 'bg-blue-500' },
                { label: '31-60 يوم', amount: selected.balance * 0.2, color: 'bg-amber-500' },
                { label: '61-90 يوم', amount: selected.balance * 0.15, color: 'bg-orange-500' },
                { label: 'أكثر من 90 يوم', amount: selected.balance * 0.1, color: 'bg-red-500' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 p-2 rounded-lg">
                  <div className={cn('h-2.5 w-2.5 rounded-full', item.color)} />
                  <span className="text-sm flex-1">{item.label}</span>
                  <span className="text-sm font-medium" dir="ltr">{formatCurrency(item.amount)} ريال</span>
                </div>
              ))}
            </div>
          </div>
        )
      case 'attachments':
        return (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">المرفقات</h4>
            {((selected as any).attachments ?? generateMockDocuments()).map((doc: any) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => setActiveDoc(doc)}
                className="w-full text-right flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{doc.uploadedBy}</p>
                </div>
              </button>
            ))}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <>
      <WorkbenchShell
        title="منصة الحسابات المدينة"
        breadcrumbs={[
          { label: 'المالية' },
          { label: 'إدارة الحسابات المدينة' },
        ]}
        metrics={metrics}
        actions={[
          { id: 'new-invoice', label: 'فاتورة جديدة', type: 'primary', icon: 'Plus' },
          { id: 'export', label: 'تصدير', type: 'secondary', icon: 'Download' },
          { id: 'bulk-reminder', label: 'تذكير جماعي', type: 'secondary', icon: 'Mail' },
        ]}
        inspectorTabs={inspectorTabs}
        inspectorContent={renderInspectorContent()}
        inspectorOpen={inspectorOpen}
        onInspectorToggle={setInspectorOpen}
        inspectorTab={inspectorTab}
        onInspectorTabChange={setInspectorTab}
        sidebar={renderInvoiceList()}
        sidebarWidth={420}
        validationBar={allValidationMessages.length > 0 && selected ? (
          <RealtimeValidationBar messages={allValidationMessages} />
        ) : undefined}
        aiPanel={
          <AIAssistancePanel
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            domain="ar"
            entityId={selectedId ?? undefined}
            insights={aiInsights}
          />
        }
      >
        {renderInvoiceDetail()}
      </WorkbenchShell>

      <AuditOverlay
        entries={auditTrail}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        entityId={selectedId ?? undefined}
        entityType="Accounts Receivable"
      />

      {activeDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[90vh] bg-background rounded-2xl shadow-2xl overflow-hidden">
            <DocumentViewer
              document={activeDoc}
              onClose={() => setActiveDoc(null)}
            />
          </div>
        </div>
      )}
    </>
  )
}
