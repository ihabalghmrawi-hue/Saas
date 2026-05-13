'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Search, Filter, ArrowUpDown, Plus, Download,
  CheckCircle2, XCircle, AlertTriangle, Eye, Clock, User,
  FileText, DollarSign, BookOpen, ArrowLeftRight,
  Receipt, Sparkles, Shield, Activity, TrendingUp, TrendingDown,
  Calendar, Hash, Layers, GitCompare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
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
import { generateMockJournalEntries, generateMockAccounts, generateMockAIInsights, generateMockAuditTrail, generateMockDocuments, generateMockOperationalComments } from '@/lib/workbench/mock-data'
import type { TransactionEntry, AccountSummary, ValidationMessage, AIInsight, WorkbenchMetric, InspectorTab, DocumentAttachment, AuditTrailEntry } from '@/lib/workbench/types'

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'; icon: any }> = {
  draft: { label: 'مسودة', variant: 'secondary', icon: FileText },
  pending: { label: 'معلق', variant: 'warning', icon: Clock },
  posted: { label: 'مرحل', variant: 'success', icon: CheckCircle2 },
  rejected: { label: 'مرفوض', variant: 'destructive', icon: XCircle },
}

const filterTabs = [
  { id: 'all', label: 'الكل' },
  { id: 'pending', label: 'معلق' },
  { id: 'posted', label: 'مرحل' },
  { id: 'draft', label: 'مسودة' },
  { id: 'rejected', label: 'مرفوض' },
]

export function JournalWorkbench() {
  const [entries] = useState(() => generateMockJournalEntries(50))
  const [accounts] = useState(() => generateMockAccounts())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState('all')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorTab, setInspectorTab] = useState('account')
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [showGraph, setShowGraph] = useState(false)
  const [detailTab, setDetailTab] = useState('details')
  const [activeDoc, setActiveDoc] = useState<DocumentAttachment | null>(null)

  const aiInsights = useMemo(() => generateMockAIInsights('journal'), [])
  const auditTrail = useMemo(() => generateMockAuditTrail(), [])

  const selected = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? null,
    [entries, selectedId],
  )

  const filtered = useMemo(() => {
    let list = entries
    if (filterTab !== 'all') {
      list = list.filter((e) => e.status === filterTab)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (e) =>
          e.reference.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.accountName.toLowerCase().includes(q),
      )
    }
    return list.sort((a, b) => b.date - a.date)
  }, [entries, filterTab, searchQuery])

  const allValidationMessages = useMemo(() => {
    if (!selected) return []
    const msgs = [...(selected.validationMessages ?? [])]
    if (selected.debit !== selected.credit && Math.abs(selected.debit - selected.credit) > 0.01) {
      msgs.push({
        id: 'unbalanced',
        type: 'error' as const,
        message: 'القيد غير متوازن: المدين لا يساوي الدائن',
        field: 'المبلغ',
        action: { label: 'تصحيح', handler: () => {} },
      })
    }
    if (selected.status === 'draft') {
      msgs.push({
        id: 'draft-warn',
        type: 'info' as const,
        message: 'هذا القيد في حالة مسودة ولم يتم ترحيله بعد',
        field: 'الحالة',
      })
    }
    return msgs.slice(0, 8)
  }, [selected])

  const totalDebit = useMemo(() => entries.reduce((s, e) => s + e.debit, 0), [entries])
  const totalCredit = useMemo(() => entries.reduce((s, e) => s + e.credit, 0), [entries])
  const pendingCount = useMemo(() => entries.filter((e) => e.status === 'pending').length, [entries])
  const diff = useMemo(() => Math.abs(totalDebit - totalCredit), [totalDebit, totalCredit])

  const metrics: WorkbenchMetric[] = useMemo(() => [
    { id: 'total-debit', label: 'إجمالي المدين', value: totalDebit.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) + ' ريال', icon: 'DollarSign', severity: 'info' as const, change: 4.3, trend: 'up' as const },
    { id: 'total-credit', label: 'إجمالي الدائن', value: totalCredit.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) + ' ريال', icon: 'DollarSign', severity: 'info' as const, change: 4.3, trend: 'up' as const },
    { id: 'diff', label: 'الفرق', value: diff.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) + ' ريال', icon: 'AlertTriangle', severity: diff === 0 ? 'success' as const : 'warning' as const, change: 0, trend: 'up' as const },
    { id: 'pending-j', label: 'قيود معلقة', value: pendingCount, icon: 'AlertTriangle', severity: pendingCount > 0 ? 'warning' as const : 'success' as const, change: -8.1, trend: 'down' as const },
  ], [totalDebit, totalCredit, diff, pendingCount])

  const inspectorTabs: InspectorTab[] = useMemo(
    () => [
      { id: 'account', label: 'تفاصيل الحساب', icon: 'info' },
      { id: 'related', label: 'القيود المرتبطة', icon: 'activity' },
      { id: 'attachments', label: 'المرفقات', icon: 'paperclip', badge: selected?.attachments?.length ?? 0 },
    ],
    [selected],
  )

  const handlePost = () => {}
  const handleApprove = () => {}
  const handleReject = () => {}

  const formatCurrency = (n: number) =>
    n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const renderEntryList = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث عن قيد..."
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
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">لا توجد قيود متطابقة</p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((entry) => {
              const config = statusConfig[entry.status] || statusConfig.draft
              const StatusIcon = config.icon
              const isSelected = entry.id === selectedId
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={cn(
                    'w-full text-right p-4 transition-colors hover:bg-accent/50',
                    isSelected && 'bg-accent border-r-2 border-r-primary',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold truncate">{entry.reference}</span>
                        <Badge variant={config.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs">
                        <span className="text-muted-foreground">
                          {new Date(entry.date).toLocaleDateString('ar-SA')}
                        </span>
                        <span className="font-semibold" dir="ltr">
                          مدين: {formatCurrency(entry.debit)}
                        </span>
                        <span className="font-semibold" dir="ltr">
                          دائن: {formatCurrency(entry.credit)}
                        </span>
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
          {filtered.length} {filtered.length === 1 ? 'قيد' : 'قيود'}
        </span>
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
          <Download className="h-3.5 w-3.5" />
          تصدير
        </Button>
      </div>
    </div>
  )

  const renderEntryDetail = () => {
    if (!selected) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-12">
          <BookOpen className="h-16 w-16 text-muted-foreground/20 mb-4" />
          <h3 className="text-lg font-semibold mb-2">اختر قيداً يومياً</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            اختر قيداً من القائمة لعرض تفاصيله والتحقق من توازنه وترحيله
          </p>
        </div>
      )
    }

    const config = statusConfig[selected.status] || statusConfig.draft
    const StatusIcon = config.icon
    const isBalanced = Math.abs(selected.debit - selected.credit) < 0.01

    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-7 w-7 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-bold">{selected.reference}</h2>
                  <Badge variant={config.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                  {isBalanced ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      متوازن
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      غير متوازن
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(selected.date).toLocaleDateString('ar-SA')}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {selected.createdBy}
                  </span>
                  {selected.approvedBy && (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      معتمد من {selected.approvedBy}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" />
                    {selected.type === 'cash' ? 'نقدي' : selected.type === 'bank' ? 'بنكي' : selected.type === 'sales' ? 'مبيعات' : selected.type === 'purchase' ? 'مشتريات' : 'مصروفات'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selected.status !== 'posted' && (
              <>
                <Button size="sm" className="gap-1.5" onClick={handlePost} disabled={!isBalanced}>
                  <ArrowLeftRight className="h-4 w-4" />
                  ترحيل
                </Button>
                <Button size="sm" variant="secondary" className="gap-1.5" onClick={handleApprove}>
                  <CheckCircle2 className="h-4 w-4" />
                  اعتماد
                </Button>
                <Button size="sm" variant="destructive" className="gap-1.5" onClick={handleReject}>
                  <XCircle className="h-4 w-4" />
                  رفض
                </Button>
              </>
            )}
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
                entries={[
                  {
                    accountId: selected.accountId,
                    accountName: selected.accountName,
                    amount: selected.debit,
                    relatedAccountId: 'credit-side',
                    description: selected.description,
                    type: 'expense',
                  },
                  {
                    accountId: 'credit-side',
                    accountName: 'الجهة المقابلة',
                    amount: selected.credit,
                    relatedAccountId: selected.accountId,
                    description: selected.description,
                    type: 'liability',
                  },
                ]}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <Tabs value={detailTab} onValueChange={setDetailTab} className="p-6 pt-4" dir="rtl">
            <TabsList className="mb-4">
              <TabsTrigger value="details">تفاصيل القيد</TabsTrigger>
              <TabsTrigger value="entries-grid">سجل القيود</TabsTrigger>
              <TabsTrigger value="attachments">المرفقات</TabsTrigger>
              <TabsTrigger value="audit">سجل التدقيق</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-0 space-y-6">
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold mb-4">دفتر الأستاذ - قيد محاسبي</h4>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>الحساب</TableHead>
                          <TableHead>الوصف</TableHead>
                          <TableHead className="text-center">المدين</TableHead>
                          <TableHead className="text-center">الدائن</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">{selected.accountName}</TableCell>
                          <TableCell>{selected.description}</TableCell>
                          <TableCell className="text-center font-semibold text-green-600" dir="ltr">
                            {selected.debit > 0 ? formatCurrency(selected.debit) : '-'}
                          </TableCell>
                          <TableCell className="text-center font-semibold text-red-600" dir="ltr">
                            {selected.credit > 0 ? formatCurrency(selected.credit) : '-'}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-muted/30 font-bold">
                          <TableCell colSpan={2} className="text-left">الإجمالي</TableCell>
                          <TableCell className="text-center" dir="ltr">{formatCurrency(selected.debit)}</TableCell>
                          <TableCell className="text-center" dir="ltr">{formatCurrency(selected.credit)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-4">
                <Card className={cn(isBalanced ? 'border-green-200' : 'border-red-200')}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      {isBalanced ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="text-sm text-muted-foreground">حالة التوازن</span>
                    </div>
                    <div className={cn('text-lg font-bold', isBalanced ? 'text-green-600' : 'text-red-600')}>
                      {isBalanced ? 'متوازن' : 'غير متوازن'}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">التصنيف</div>
                    <div className="text-lg font-bold">
                      {selected.category}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">النوع</div>
                    <div className="text-lg font-bold">
                      {selected.type === 'cash' ? 'نقدي' : selected.type === 'bank' ? 'بنكي' : selected.type === 'sales' ? 'مبيعات' : selected.type === 'purchase' ? 'مشتريات' : 'مصروفات'}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold mb-3">تفاصيل إضافية</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">المرجع</span>
                      <span className="font-medium">{selected.reference}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">الحساب</span>
                      <span className="font-medium">{selected.accountName}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">التاريخ</span>
                      <span className="font-medium">{new Date(selected.date).toLocaleDateString('ar-SA')}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">العملة</span>
                      <span className="font-medium">{selected.currency}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">المدين</span>
                      <span className="font-medium" dir="ltr">{formatCurrency(selected.debit)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">الدائن</span>
                      <span className="font-medium" dir="ltr">{formatCurrency(selected.credit)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground">تاريخ الإنشاء</span>
                      <span className="font-medium">{new Date(selected.createdAt).toLocaleDateString('ar-SA')}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted-foreground">الحالة</span>
                      <Badge variant={config.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="entries-grid" className="mt-0 space-y-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المرجع</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>الوصف</TableHead>
                        <TableHead>الحساب</TableHead>
                        <TableHead className="text-center">المدين</TableHead>
                        <TableHead className="text-center">الدائن</TableHead>
                        <TableHead>الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.slice(0, 10).map((entry) => (
                        <TableRow
                          key={entry.id}
                          className={cn('cursor-pointer', entry.id === selectedId && 'bg-accent')}
                          onClick={() => setSelectedId(entry.id)}
                        >
                          <TableCell className="font-medium">{entry.reference}</TableCell>
                          <TableCell>{new Date(entry.date).toLocaleDateString('ar-SA')}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{entry.description}</TableCell>
                          <TableCell>{entry.accountName}</TableCell>
                          <TableCell className="text-center" dir="ltr">{entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</TableCell>
                          <TableCell className="text-center" dir="ltr">{entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</TableCell>
                          <TableCell>
                            <Badge variant={statusConfig[entry.status]?.variant ?? 'secondary'}>
                              {statusConfig[entry.status]?.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attachments" className="mt-0 space-y-3">
              {selected.attachments && selected.attachments.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {selected.attachments.map((doc) => (
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

            <TabsContent value="audit" className="mt-0 space-y-4">
              <div className="space-y-3">
                {auditTrail.slice(0, 8).map((entry) => (
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

              <div className="flex flex-col h-[350px] border rounded-xl">
                <OperationalCommenting
                  comments={selected.comments ?? generateMockOperationalComments()}
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
      case 'account':
        return (
          <div className="space-y-4">
            <CrossEntityInspector entityType="journal" entityId={selected.id} />
          </div>
        )
      case 'related':
        return (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">القيود المرتبطة</h4>
            {entries
              .filter((e) => e.accountId === selected.accountId && e.id !== selected.id)
              .slice(0, 5)
              .map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className="w-full text-right flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                >
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{entry.reference}</p>
                    <p className="text-xs text-muted-foreground">{entry.description}</p>
                  </div>
                  <div className="text-xs" dir="ltr">
                    <div className="text-green-600">{entry.debit > 0 ? formatCurrency(entry.debit) : ''}</div>
                    <div className="text-red-600">{entry.credit > 0 ? formatCurrency(entry.credit) : ''}</div>
                  </div>
                </button>
              ))}
            {entries.filter((e) => e.accountId === selected.accountId && e.id !== selected.id).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد قيود مرتبطة</p>
            )}
          </div>
        )
      case 'attachments':
        return (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">المرفقات</h4>
            {(selected.attachments ?? generateMockDocuments()).map((doc) => (
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
        title="منصة قيود اليومية"
        breadcrumbs={[
          { label: 'المالية' },
          { label: 'قيود اليومية' },
        ]}
        metrics={metrics}
        actions={[
          { id: 'new-entry', label: 'قيد جديد', type: 'primary', icon: 'Plus' },
          { id: 'export', label: 'تصدير', type: 'secondary', icon: 'Download' },
          { id: 'auto-reconcile', label: 'تسوية تلقائية', type: 'secondary', icon: 'GitCompare' },
        ]}
        inspectorTabs={inspectorTabs}
        inspectorContent={renderInspectorContent()}
        inspectorOpen={inspectorOpen}
        onInspectorToggle={setInspectorOpen}
        inspectorTab={inspectorTab}
        onInspectorTabChange={setInspectorTab}
        sidebar={renderEntryList()}
        sidebarWidth={480}
        validationBar={allValidationMessages.length > 0 && selected ? (
          <RealtimeValidationBar messages={allValidationMessages} />
        ) : undefined}
        aiPanel={
          <AIAssistancePanel
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            domain="journal"
            entityId={selectedId ?? undefined}
            insights={aiInsights}
          />
        }
      >
        {renderEntryDetail()}
      </WorkbenchShell>

      <AuditOverlay
        entries={auditTrail}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        entityId={selectedId ?? undefined}
        entityType="Journal Entry"
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
