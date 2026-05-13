'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Search, Filter, ArrowUpDown, Plus, Download,
  CheckCircle2, XCircle, AlertTriangle, Eye, Clock, User,
  FileText, DollarSign, Building2, Landmark, ArrowLeftRight,
  BookOpen, Sparkles, Shield, Activity, TrendingUp, TrendingDown,
  Calendar, Hash, Layers, PieChart, BarChart3, ChevronDown, ChevronLeft,
  Wallet, PiggyBank, TrendingUp as TrendingUpIcon, Receipt,
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
import { generateMockAccounts, generateMockJournalEntries, generateMockAIInsights, generateMockAuditTrail, generateMockOperationalComments } from '@/lib/workbench/mock-data'
import type { AccountSummary, TransactionEntry, ValidationMessage, AIInsight, WorkbenchMetric, InspectorTab } from '@/lib/workbench/types'

const accountTypeConfig: Record<string, { label: string; icon: any; color: string }> = {
  asset: { label: 'أصول', icon: Wallet, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  liability: { label: 'خصوم', icon: Landmark, color: 'text-red-600 bg-red-50 border-red-200' },
  equity: { label: 'حقوق ملكية', icon: PiggyBank, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  revenue: { label: 'إيرادات', icon: TrendingUpIcon, color: 'text-green-600 bg-green-50 border-green-200' },
  expense: { label: 'مصروفات', icon: Receipt, color: 'text-orange-600 bg-orange-50 border-orange-200' },
}

const accountTypeOrder = ['asset', 'liability', 'equity', 'revenue', 'expense']

export function GLWorkbench() {
  const [accounts] = useState(() => generateMockAccounts())
  const [transactions] = useState(() => generateMockJournalEntries(30))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(['asset', 'liability']))
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorTab, setInspectorTab] = useState('analysis')
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [detailTab, setDetailTab] = useState('transactions')
  const [showGraph, setShowGraph] = useState(false)
  const [period, setPeriod] = useState('current')

  const aiInsights = useMemo(() => generateMockAIInsights('gl'), [])
  const auditTrail = useMemo(() => generateMockAuditTrail(), [])

  const selected = useMemo(
    () => accounts.find((a) => a.id === selectedId) ?? null,
    [accounts, selectedId],
  )

  const selectedTransactions = useMemo(
    () => transactions.filter((t) => t.accountId === selectedId).slice(0, 20),
    [transactions, selectedId],
  )

  const grouped = useMemo(() => {
    const groups: Record<string, AccountSummary[]> = {}
    accountTypeOrder.forEach((type) => {
      groups[type] = accounts.filter((a) => a.type === type)
    })
    return groups
  }, [accounts])

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return grouped
    const result: Record<string, AccountSummary[]> = {}
    Object.entries(grouped).forEach(([type, accs]) => {
      const filtered = accs.filter(
        (a) =>
          a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.code.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      if (filtered.length > 0) result[type] = filtered
    })
    return result
  }, [grouped, searchQuery])

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const allValidationMessages = useMemo(() => {
    if (!selected) return []
    const msgs: ValidationMessage[] = []
    if (selected.status === 'frozen') {
      msgs.push({
        id: 'frozen',
        type: 'error' as const,
        message: 'الحساب مجمد - لا يمكن إجراء معاملات عليه',
        field: 'الحالة',
        action: { label: 'إزالة التجميد', handler: () => {} },
      })
    }
    if (selected.type === 'expense' && selected.balance > 0) {
      msgs.push({
        id: 'expense-balance',
        type: 'warning' as const,
        message: 'حساب المصروفات له رصيد مدين - يرجى المراجعة',
        field: 'الرصيد',
      })
    }
    return msgs.slice(0, 5)
  }, [selected])

  const totalAssets = useMemo(() => accounts.filter((a) => a.type === 'asset').reduce((s, a) => s + Math.abs(a.balance), 0), [accounts])
  const totalLiabilities = useMemo(() => accounts.filter((a) => a.type === 'liability').reduce((s, a) => s + Math.abs(a.balance), 0), [accounts])
  const totalRevenue = useMemo(() => accounts.filter((a) => a.type === 'revenue').reduce((s, a) => s + Math.abs(a.balance), 0), [accounts])
  const totalExpenses = useMemo(() => accounts.filter((a) => a.type === 'expense').reduce((s, a) => s + Math.abs(a.balance), 0), [accounts])

  const metrics: WorkbenchMetric[] = useMemo(() => [
    { id: 'total-assets', label: 'إجمالي الأصول', value: totalAssets.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) + ' ريال', icon: 'DollarSign', severity: 'info' as const, change: 3.5, trend: 'up' as const },
    { id: 'total-liabilities', label: 'إجمالي الخصوم', value: totalLiabilities.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) + ' ريال', icon: 'DollarSign', severity: 'info' as const, change: 2.1, trend: 'up' as const },
    { id: 'total-revenue', label: 'إجمالي الإيرادات', value: totalRevenue.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) + ' ريال', icon: 'DollarSign', severity: 'success' as const, change: 8.7, trend: 'up' as const },
    { id: 'total-expenses', label: 'إجمالي المصروفات', value: totalExpenses.toLocaleString('ar-SA', { minimumFractionDigits: 2 }) + ' ريال', icon: 'DollarSign', severity: 'warning' as const, change: 5.3, trend: 'up' as const },
  ], [totalAssets, totalLiabilities, totalRevenue, totalExpenses])

  const inspectorTabs: InspectorTab[] = useMemo(
    () => [
      { id: 'analysis', label: 'تحليل الحساب', icon: 'info' },
      { id: 'budget', label: 'مقارنة الميزانية', icon: 'activity' },
    ],
    [],
  )

  const formatCurrency = (n: number) =>
    n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const renderAccountTree = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث عن حساب..."
            className="flex h-9 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {Object.entries(filteredGroups).map(([type, accs]) => {
          const config = accountTypeConfig[type] || { label: type, icon: BookOpen, color: 'text-gray-600 bg-gray-50' }
          const TypeIcon = config.icon
          const isExpanded = expandedTypes.has(type)
          const typeTotal = accs.reduce((s, a) => s + Math.abs(a.balance), 0)
          return (
            <div key={type} className="mb-2">
              <button
                type="button"
                onClick={() => toggleType(type)}
                className={cn(
                  'w-full text-right flex items-center gap-2 p-2.5 rounded-lg transition-colors',
                  'hover:bg-accent',
                )}
              >
                <div className={cn('p-1.5 rounded-lg', config.color)}>
                  <TypeIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{config.label}</span>
                    <span className="text-xs text-muted-foreground">({accs.length})</span>
                  </div>
                </div>
                <div className="text-xs font-medium text-muted-foreground" dir="ltr">
                  {formatCurrency(typeTotal)}
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {isExpanded && (
                <div className="mr-3 space-y-0.5 mt-0.5">
                  {accs.map((account) => {
                    const isSelected = account.id === selectedId
                    const balColor = account.balance >= 0 ? 'text-green-600' : 'text-red-600'
                    return (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => setSelectedId(account.id)}
                        className={cn(
                          'w-full text-right flex items-center gap-2 p-2 rounded-lg transition-colors text-sm',
                          isSelected ? 'bg-accent border-r-2 border-r-primary' : 'hover:bg-accent/50',
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium">{account.code}</span>
                            <span className="text-sm truncate">{account.name}</span>
                            {account.status === 'frozen' && (
                              <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                            )}
                            {account.status === 'inactive' && (
                              <span className="text-[10px] text-muted-foreground">(غير نشط)</span>
                            )}
                          </div>
                        </div>
                        <span className={cn('text-xs font-semibold', balColor)} dir="ltr">
                          {formatCurrency(account.balance)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="border-t p-3 text-xs text-muted-foreground">
        {accounts.length} حساب - {accounts.filter((a) => a.status === 'active').length} نشط
      </div>
    </div>
  )

  const renderAccountDetail = () => {
    if (!selected) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-12">
          <BookOpen className="h-16 w-16 text-muted-foreground/20 mb-4" />
          <h3 className="text-lg font-semibold mb-2">اختر حساباً</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            اختر حساباً من دليل الحسابات لعرض تفاصيله ورصيده ومعاملاته
          </p>
        </div>
      )
    }

    const config = accountTypeConfig[selected.type] || { label: selected.type, icon: BookOpen, color: 'text-gray-600 bg-gray-50' }
    const TypeIcon = config.icon

    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={cn('h-14 w-14 rounded-xl flex items-center justify-center', config.color)}>
                <TypeIcon className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-bold">{selected.name}</h2>
                  <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{selected.code}</code>
                  <Badge variant={selected.status === 'active' ? 'success' : selected.status === 'frozen' ? 'destructive' : 'secondary'}>
                    {selected.status === 'active' ? 'نشط' : selected.status === 'frozen' ? 'مجمد' : 'غير نشط'}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" />
                    {config.label}
                  </span>
                  <span className="flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5" />
                    {selected.transactionCount} معاملة
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    آخر نشاط: {new Date(selected.lastActivity).toLocaleDateString('ar-SA')}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-left" dir="ltr">
              <div className={cn(
                'text-3xl font-bold tracking-tight',
                selected.balance >= 0 ? 'text-green-600' : 'text-red-600',
              )}>
                {formatCurrency(selected.balance)}
              </div>
              <div className="text-sm text-muted-foreground">الرصيد الحالي</div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Plus className="h-4 w-4" />
              قيد جديد
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Download className="h-4 w-4" />
              كشف حساب
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
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              options={[
                { value: 'current', label: 'الفترة الحالية' },
                { value: 'previous', label: 'الفترة السابقة' },
                { value: 'ytd', label: 'منذ بداية العام' },
              ]}
              className="w-40"
            />
          </div>
        </div>

        {showGraph && (
          <div className="border-b">
            <div className="p-4">
              <TransactionGraph
                entries={transactions
                  .filter((t) => t.accountId === selectedId)
                  .slice(0, 10)
                  .map((t) => ({
                    accountId: t.accountId,
                    accountName: t.accountName,
                    amount: t.debit || t.credit,
                    relatedAccountId: 'opposite',
                    description: t.description,
                    type: selected.type,
                  }))}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <Tabs value={detailTab} onValueChange={setDetailTab} className="p-6 pt-4" dir="rtl">
            <TabsList className="mb-4">
              <TabsTrigger value="transactions">المعاملات</TabsTrigger>
              <TabsTrigger value="balance">بطاقة الرصيد</TabsTrigger>
              <TabsTrigger value="period">مقارنة الفترات</TabsTrigger>
              <TabsTrigger value="activity">النشاطات</TabsTrigger>
            </TabsList>

            <TabsContent value="transactions" className="mt-0 space-y-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>المرجع</TableHead>
                        <TableHead>الوصف</TableHead>
                        <TableHead className="text-center">مدين</TableHead>
                        <TableHead className="text-center">دائن</TableHead>
                        <TableHead className="text-center">الرصيد</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            لا توجد معاملات لهذا الحساب
                          </TableCell>
                        </TableRow>
                      ) : (
                        selectedTransactions.map((tx, idx) => {
                          const runningBalance = selectedTransactions
                            .slice(0, idx + 1)
                            .reduce((s, t) => s + (t.debit - t.credit), 0)
                          return (
                            <TableRow key={tx.id} className="cursor-pointer hover:bg-accent/50">
                              <TableCell>{new Date(tx.date).toLocaleDateString('ar-SA')}</TableCell>
                              <TableCell className="font-medium">{tx.reference}</TableCell>
                              <TableCell className="max-w-[250px] truncate">{tx.description}</TableCell>
                              <TableCell className="text-center text-green-600" dir="ltr">
                                {tx.debit > 0 ? formatCurrency(tx.debit) : '-'}
                              </TableCell>
                              <TableCell className="text-center text-red-600" dir="ltr">
                                {tx.credit > 0 ? formatCurrency(tx.credit) : '-'}
                              </TableCell>
                              <TableCell className="text-center font-medium" dir="ltr">
                                {formatCurrency(runningBalance)}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="balance" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">إجمالي المدين</div>
                    <div className="text-2xl font-bold text-green-600" dir="ltr">
                      {formatCurrency(selected.debitTotal)} ريال
                    </div>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: '70%' }} />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">إجمالي الدائن</div>
                    <div className="text-2xl font-bold text-red-600" dir="ltr">
                      {formatCurrency(selected.creditTotal)} ريال
                    </div>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: '70%' }} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold mb-3">ملخص الحساب</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">رمز الحساب</span>
                      <span className="font-medium">{selected.code}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">اسم الحساب</span>
                      <span className="font-medium">{selected.name}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">نوع الحساب</span>
                      <span className="font-medium">{config.label}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">الرصيد</span>
                      <span className={cn('font-medium', selected.balance >= 0 ? 'text-green-600' : 'text-red-600')} dir="ltr">
                        {formatCurrency(selected.balance)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">عدد المعاملات</span>
                      <span className="font-medium">{selected.transactionCount}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">آخر نشاط</span>
                      <span className="font-medium">{new Date(selected.lastActivity).toLocaleDateString('ar-SA')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="period" className="mt-0 space-y-4">
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold mb-4">مقارنة الفترات</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفترة</TableHead>
                        <TableHead className="text-center">مدين</TableHead>
                        <TableHead className="text-center">دائن</TableHead>
                        <TableHead className="text-center">صافي الحركة</TableHead>
                        <TableHead className="text-center">الرصيد التراكمي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { period: 'يناير 2026', debit: 125000, credit: 80000, balance: 45000 },
                        { period: 'فبراير 2026', debit: 95000, credit: 110000, balance: 30000 },
                        { period: 'مارس 2026', debit: 145000, credit: 120000, balance: 55000 },
                        { period: 'أبريل 2026', debit: 80000, credit: 95000, balance: 40000 },
                        { period: 'مايو 2026', debit: 110000, credit: 100000, balance: 50000 },
                      ].map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.period}</TableCell>
                          <TableCell className="text-center text-green-600" dir="ltr">{formatCurrency(row.debit)}</TableCell>
                          <TableCell className="text-center text-red-600" dir="ltr">{formatCurrency(row.credit)}</TableCell>
                          <TableCell className="text-center" dir="ltr">
                            <span className={cn(row.debit - row.credit >= 0 ? 'text-green-600' : 'text-red-600')}>
                              {formatCurrency(row.debit - row.credit)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-medium" dir="ltr">{formatCurrency(row.balance)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="mt-0 space-y-4">
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

              <div className="flex flex-col h-[350px] border rounded-xl">
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
      case 'analysis':
        return (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold mb-3">تحليل الحساب</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">نسبة النشاط</span>
                      <span>{(selected.transactionCount / 150 * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(selected.transactionCount / 150 * 100, 100)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">تغيير الرصيد</span>
                      <span className={selected.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {selected.balance >= 0 ? '+' : ''}{((selected.balance / (selected.debitTotal || 1)) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', selected.balance >= 0 ? 'bg-green-500' : 'bg-red-500')} style={{ width: `${Math.min(Math.abs(selected.balance) / (selected.debitTotal || 1) * 100, 100)}%` }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <CrossEntityInspector entityType="journal" entityId={selected.id} />
          </div>
        )
      case 'budget':
        return (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold mb-3">مقارنة الميزانية</h4>
                <div className="space-y-3">
                  {[
                    { label: 'الميزانية المعتمدة', amount: 500000 },
                    { label: 'المنفق الفعلي', amount: Math.abs(selected.balance) },
                    { label: 'المتبقي', amount: 500000 - Math.abs(selected.balance) },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium" dir="ltr">{formatCurrency(item.amount)} ريال</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">نسبة الصرف</span>
                      <span>{((Math.abs(selected.balance) / 500000) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          (Math.abs(selected.balance) / 500000) > 0.8 ? 'bg-red-500' : (Math.abs(selected.balance) / 500000) > 0.6 ? 'bg-amber-500' : 'bg-green-500',
                        )}
                        style={{ width: `${Math.min((Math.abs(selected.balance) / 500000) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <>
      <WorkbenchShell
        title="منصة دفتر الأستاذ العام"
        breadcrumbs={[
          { label: 'المالية' },
          { label: 'دفتر الأستاذ العام' },
        ]}
        metrics={metrics}
        actions={[
          { id: 'new-account', label: 'حساب جديد', type: 'primary', icon: 'Plus' },
          { id: 'export-gl', label: 'تصدير', type: 'secondary', icon: 'Download' },
          { id: 'trial-balance', label: 'ميزان المراجعة', type: 'secondary', icon: 'Balance' },
        ]}
        inspectorTabs={inspectorTabs}
        inspectorContent={renderInspectorContent()}
        inspectorOpen={inspectorOpen}
        onInspectorToggle={setInspectorOpen}
        inspectorTab={inspectorTab}
        onInspectorTabChange={setInspectorTab}
        sidebar={renderAccountTree()}
        sidebarWidth={380}
        validationBar={allValidationMessages.length > 0 && selected ? (
          <RealtimeValidationBar messages={allValidationMessages} />
        ) : undefined}
        aiPanel={
          <AIAssistancePanel
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            domain="gl"
            entityId={selectedId ?? undefined}
            insights={aiInsights}
          />
        }
      >
        {renderAccountDetail()}
      </WorkbenchShell>

      <AuditOverlay
        entries={auditTrail}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        entityId={selectedId ?? undefined}
        entityType="General Ledger"
      />
    </>
  )
}
