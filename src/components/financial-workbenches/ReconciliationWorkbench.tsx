'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Search, Filter, ArrowUpDown, Plus, Download,
  CheckCircle2, XCircle, AlertTriangle, Eye, Clock, User,
  FileText, DollarSign, Building2, Landmark, ArrowLeftRight,
  Receipt, Sparkles, Shield, Activity, TrendingUp, TrendingDown,
  Calendar, Hash, Layers, GitCompare, Banknote, BookOpen, Percent,
  RefreshCw, RotateCcw, CheckSquare,
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
import { generateMockReconciliationItems, generateMockAccounts, generateMockJournalEntries, generateMockAIInsights, generateMockAuditTrail, generateMockOperationalComments } from '@/lib/workbench/mock-data'
import type { ValidationMessage, AIInsight, WorkbenchMetric, InspectorTab } from '@/lib/workbench/types'

interface ReconciliationItem {
  id: string
  account: string
  systemBalance: number
  statementBalance: number
  difference: number
  date: number
  status: string
  notes: string
  items: Array<{
    date: number
    description: string
    reference: string
    debit: number
    credit: number
  }>
}

const filterTabs = [
  { id: 'all', label: 'الكل' },
  { id: 'مطابقة', label: 'مطابقة' },
  { id: 'غير مطابقة', label: 'غير مطابقة' },
]

export function ReconciliationWorkbench() {
  const [reconItems] = useState(() => generateMockReconciliationItems() as ReconciliationItem[])
  const [accounts] = useState(() => generateMockAccounts())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState('all')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorTab, setInspectorTab] = useState('details')
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [showGraph, setShowGraph] = useState(false)
  const [matchedItems, setMatchedItems] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState('workspace')

  const aiInsights = useMemo(() => generateMockAIInsights('reconciliation'), [])
  const auditTrail = useMemo(() => generateMockAuditTrail(), [])

  const selected = useMemo(
    () => reconItems.find((r) => r.id === selectedId) ?? null,
    [reconItems, selectedId],
  )

  const filtered = useMemo(() => {
    let list = reconItems
    if (filterTab !== 'all') {
      list = list.filter((r) => r.status === filterTab)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((r) => r.account.toLowerCase().includes(q))
    }
    return list
  }, [reconItems, filterTab, searchQuery])

  const allValidationMessages = useMemo(() => {
    if (!selected) return []
    const msgs: ValidationMessage[] = []
    if (Math.abs(selected.difference) > 0.01) {
      msgs.push({
        id: 'diff-unresolved',
        type: 'error' as const,
        message: `يوجد فرق بقيمة ${formatCurrency(selected.difference)} ريال بين كشف البنك والسجلات`,
        field: 'الفرق',
        action: { label: 'معالجة', handler: () => {} },
      })
    } else {
      msgs.push({
        id: 'diff-resolved',
        type: 'success' as const,
        message: 'التسوية متطابقة - لا توجد فروقات',
        field: 'الفرق',
      })
    }
    return msgs
  }, [selected])

  const metrics: WorkbenchMetric[] = useMemo(() => {
    const totalCount = reconItems.length
    const matchedCount = reconItems.filter((r) => r.status === 'مطابقة').length
    const unmatchedCount = reconItems.filter((r) => r.status === 'غير مطابقة').length
    const totalDiff = reconItems.reduce((s, r) => s + Math.abs(r.difference), 0)
    return [
      { id: 'total-rec', label: 'عدد التسويات', value: totalCount, icon: 'DollarSign', severity: 'info' as const, change: 0, trend: 'up' as const },
      { id: 'matched', label: 'تمت المطابقة', value: matchedCount, icon: 'CheckCircle2', severity: 'success' as const, change: 10.5, trend: 'up' as const },
      { id: 'unmatched', label: 'فروقات', value: unmatchedCount, icon: 'AlertTriangle', severity: unmatchedCount > 0 ? 'warning' as const : 'success' as const, change: -5.2, trend: 'down' as const },
      { id: 'diff-value', label: 'قيمة الفروقات', value: totalDiff.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) + ' ريال', icon: 'DollarSign', severity: totalDiff > 10000 ? 'critical' as const : 'info' as const, change: 0, trend: 'up' as const },
    ]
  }, [reconItems])

  const inspectorTabs: InspectorTab[] = useMemo(
    () => [
      { id: 'details', label: 'تفاصيل غير المطابقة', icon: 'info' },
      { id: 'suggestions', label: 'اقتراحات المطابقة', icon: 'file' },
    ],
    [],
  )

  const handleAutoMatch = () => {
    if (!selected) return
    const newMatched = new Set(matchedItems)
    selected.items.slice(0, 3).forEach((item) => newMatched.add(item.reference))
    setMatchedItems(newMatched)
  }

  const handleManualMatch = (ref: string) => {
    setMatchedItems((prev) => {
      const next = new Set(prev)
      if (next.has(ref)) next.delete(ref)
      else next.add(ref)
      return next
    })
  }

  const formatCurrency = (n: number) =>
    n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const renderReconList = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث عن حساب..."
              className="flex h-9 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
            <Filter className="h-4 w-4" />
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
            <GitCompare className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">لا توجد تسويات متطابقة</p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((item) => {
              const isSelected = item.id === selectedId
              const isMatched = item.status === 'مطابقة'
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    'w-full text-right p-4 transition-colors hover:bg-accent/50',
                    isSelected && 'bg-accent border-r-2 border-r-primary',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                      isMatched ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600',
                    )}>
                      {isMatched ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold truncate">{item.account}</span>
                        <Badge variant={isMatched ? 'success' : 'warning'}>
                          {item.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.date).toLocaleDateString('ar-SA')} - {item.items.length} بند
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs">
                        <span>
                          النظام: <span className="font-medium" dir="ltr">{formatCurrency(item.systemBalance)}</span>
                        </span>
                        <span>
                          البنك: <span className="font-medium" dir="ltr">{formatCurrency(item.statementBalance)}</span>
                        </span>
                        {!isMatched && (
                          <span className="text-red-600 font-medium" dir="ltr">
                            فرق: {formatCurrency(item.difference)}
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
          {filtered.length} {filtered.length === 1 ? 'تسوية' : 'تسويات'}
        </span>
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
          <Download className="h-3.5 w-3.5" />
          تصدير
        </Button>
      </div>
    </div>
  )

  const renderReconDetail = () => {
    if (!selected) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-12">
          <GitCompare className="h-16 w-16 text-muted-foreground/20 mb-4" />
          <h3 className="text-lg font-semibold mb-2">اختر تسوية بنكية</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            اختر تسوية من القائمة لعرض ومقارنة كشف البنك مع السجلات المحاسبية
          </p>
        </div>
      )
    }

    const isMatched = selected.status === 'مطابقة'

    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                'h-14 w-14 rounded-xl flex items-center justify-center',
                isMatched ? 'bg-green-50' : 'bg-amber-50',
              )}>
                {isMatched ? (
                  <CheckCircle2 className="h-7 w-7 text-green-600" />
                ) : (
                  <AlertTriangle className="h-7 w-7 text-amber-600" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-bold">{selected.account}</h2>
                  <Badge variant={isMatched ? 'success' : 'warning'}>{selected.status}</Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(selected.date).toLocaleDateString('ar-SA')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" />
                    {selected.items.length} بند
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-sm text-muted-foreground mb-1">رصيد النظام</div>
                <div className="text-xl font-bold text-blue-600" dir="ltr">
                  {formatCurrency(selected.systemBalance)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-sm text-muted-foreground mb-1">رصيد كشف البنك</div>
                <div className="text-xl font-bold text-purple-600" dir="ltr">
                  {formatCurrency(selected.statementBalance)}
                </div>
              </CardContent>
            </Card>
            <Card className={cn(Math.abs(selected.difference) < 0.01 ? 'border-green-200' : 'border-red-200')}>
              <CardContent className="p-4 text-center">
                <div className="text-sm text-muted-foreground mb-1">الفرق</div>
                <div className={cn('text-xl font-bold', Math.abs(selected.difference) < 0.01 ? 'text-green-600' : 'text-red-600')} dir="ltr">
                  {formatCurrency(selected.difference)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" className="gap-1.5" onClick={handleAutoMatch} disabled={isMatched}>
              <RefreshCw className="h-4 w-4" />
              مطابقة تلقائية
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus className="h-4 w-4" />
              قيد تسوية
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Download className="h-4 w-4" />
              تقرير التسوية
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
                entries={selected.items.map((item) => ({
                  accountId: selected.account,
                  accountName: item.description,
                  amount: item.debit || item.credit,
                  relatedAccountId: 'بنك',
                  description: item.reference,
                  type: 'asset',
                }))}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="p-6 pt-4" dir="rtl">
            <TabsList className="mb-4">
              <TabsTrigger value="workspace">منطقة العمل</TabsTrigger>
              <TabsTrigger value="items">جميع البنود</TabsTrigger>
              <TabsTrigger value="comments">التعليقات</TabsTrigger>
            </TabsList>

            <TabsContent value="workspace" className="mt-0">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <BookOpen className="h-4 w-4 text-blue-600" />
                      </div>
                      <h4 className="text-sm font-semibold">السجلات المحاسبية</h4>
                    </div>
                    <div className="space-y-2">
                      {selected.items.map((item) => (
                        <div
                          key={item.reference}
                          className={cn(
                            'flex items-center gap-2 p-2.5 rounded-lg border transition-colors text-sm',
                            matchedItems.has(item.reference)
                              ? 'border-green-200 bg-green-50'
                              : 'border-border bg-card',
                          )}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              'h-6 w-6 shrink-0',
                              matchedItems.has(item.reference) ? 'text-green-600' : 'text-muted-foreground',
                            )}
                            onClick={() => handleManualMatch(item.reference)}
                          >
                            <CheckSquare className="h-4 w-4" />
                          </Button>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{item.description}</p>
                            <p className="text-[10px] text-muted-foreground">{item.reference}</p>
                          </div>
                          <div className="text-xs" dir="ltr">
                            {item.debit > 0 && <span className="text-green-600">{formatCurrency(item.debit)}</span>}
                            {item.credit > 0 && <span className="text-red-600">{formatCurrency(item.credit)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
                        <Banknote className="h-4 w-4 text-purple-600" />
                      </div>
                      <h4 className="text-sm font-semibold">كشف البنك</h4>
                    </div>
                    <div className="space-y-2">
                      {selected.items.map((item) => (
                        <div
                          key={`bank-${item.reference}`}
                          className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card text-sm"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{item.description}</p>
                            <p className="text-[10px] text-muted-foreground">{item.reference}</p>
                          </div>
                          <div className="text-xs" dir="ltr">
                            {item.debit > 0 && <span className="text-green-600">{formatCurrency(item.debit)}</span>}
                            {item.credit > 0 && <span className="text-red-600">{formatCurrency(item.credit)}</span>}
                          </div>
                          {matchedItems.has(item.reference) && (
                            <Badge variant="success" className="h-5 text-[10px]">مطابق</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-4 flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-4 text-sm">
                  <span>تمت المطابقة: <strong className="text-green-600">{matchedItems.size}</strong> من {selected.items.length}</span>
                  <span>
                    نسبة الإنجاز:
                    <strong className="mr-1">
                      {selected.items.length > 0 ? Math.round((matchedItems.size / selected.items.length) * 100) : 0}%
                    </strong>
                  </span>
                </div>
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${selected.items.length > 0 ? (matchedItems.size / selected.items.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="items" className="mt-0">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>الوصف</TableHead>
                        <TableHead>المرجع</TableHead>
                        <TableHead className="text-center">مدين</TableHead>
                        <TableHead className="text-center">دائن</TableHead>
                        <TableHead>الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.items.map((item) => (
                        <TableRow key={item.reference}>
                          <TableCell>{new Date(item.date).toLocaleDateString('ar-SA')}</TableCell>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="font-mono text-xs">{item.reference}</TableCell>
                          <TableCell className="text-center text-green-600" dir="ltr">
                            {item.debit > 0 ? formatCurrency(item.debit) : '-'}
                          </TableCell>
                          <TableCell className="text-center text-red-600" dir="ltr">
                            {item.credit > 0 ? formatCurrency(item.credit) : '-'}
                          </TableCell>
                          <TableCell>
                            {matchedItems.has(item.reference) ? (
                              <Badge variant="success" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                مطابق
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1">
                                <Clock className="h-3 w-3" />
                                غير مطابق
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comments" className="mt-0">
              <div className="flex flex-col h-[450px] border rounded-xl">
                <OperationalCommenting
                  comments={generateMockOperationalComments()}
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
      case 'details':
        return (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold mb-3">تفاصيل البنود غير المطابقة</h4>
                {selected.items.filter((item) => !matchedItems.has(item.reference)).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">جميع البنود مطابقة</p>
                ) : (
                  <div className="space-y-2">
                    {selected.items
                      .filter((item) => !matchedItems.has(item.reference))
                      .map((item) => (
                        <div key={item.reference} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{item.description}</p>
                            <p className="text-[10px] text-muted-foreground">{item.reference}</p>
                          </div>
                          <div className="text-xs font-medium text-amber-600">
                            {formatCurrency(item.debit || item.credit)}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )
      case 'suggestions':
        return (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold mb-3">اقتراحات المطابقة</h4>
                <div className="space-y-2">
                  {selected?.items.slice(0, 3).map((item) => (
                    <div key={item.reference} className="flex items-center gap-2 p-3 rounded-lg border border-blue-100 bg-blue-50">
                      <Sparkles className="h-4 w-4 text-blue-500 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium">{item.description}</p>
                        <p className="text-[10px] text-muted-foreground">احتمالية المطابقة: 92%</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleManualMatch(item.reference)}
                      >
                        مطابقة
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <CrossEntityInspector entityType="journal" entityId="reconciliation" />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <>
      <WorkbenchShell
        title="منصة التسويات المصرفية"
        breadcrumbs={[
          { label: 'المالية' },
          { label: 'التسويات المصرفية' },
        ]}
        metrics={metrics}
        actions={[
          { id: 'new-recon', label: 'تسوية جديدة', type: 'primary', icon: 'Plus' },
          { id: 'auto-match', label: 'مطابقة تلقائية', type: 'secondary', icon: 'RefreshCw' },
          { id: 'export-recon', label: 'تصدير', type: 'secondary', icon: 'Download' },
        ]}
        inspectorTabs={inspectorTabs}
        inspectorContent={renderInspectorContent()}
        inspectorOpen={inspectorOpen}
        onInspectorToggle={setInspectorOpen}
        inspectorTab={inspectorTab}
        onInspectorTabChange={setInspectorTab}
        sidebar={renderReconList()}
        sidebarWidth={420}
        validationBar={allValidationMessages.length > 0 && selected ? (
          <RealtimeValidationBar messages={allValidationMessages} />
        ) : undefined}
        aiPanel={
          <AIAssistancePanel
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            domain="reconciliation"
            entityId={selectedId ?? undefined}
            insights={aiInsights}
          />
        }
      >
        {renderReconDetail()}
      </WorkbenchShell>

      <AuditOverlay
        entries={auditTrail}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        entityId={selectedId ?? undefined}
        entityType="Reconciliation"
      />
    </>
  )
}
