'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Search, Filter, ArrowUpDown, Plus, Download,
  CheckCircle2, XCircle, AlertTriangle, Eye, Clock, User,
  FileText, DollarSign, Building2, Landmark, ArrowLeftRight,
  Receipt, Sparkles, Shield, Activity, TrendingUp, TrendingDown,
  Calendar, Hash, Layers, Flag, FlagTriangleRight, ListChecks,
  BarChart3, PlayCircle, PauseCircle, RotateCcw, ChevronLeft,
  CheckCheck,
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
import { generateMockAccounts, generateMockJournalEntries, generateMockAIInsights, generateMockAuditTrail, generateMockOperationalComments, generateMockReconciliationItems } from '@/lib/workbench/mock-data'
import type { ValidationMessage, AIInsight, WorkbenchMetric, InspectorTab } from '@/lib/workbench/types'

interface CloseStage {
  id: string
  name: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  progress: number
  dueDate: number
  assignee: string
  subTasks: CloseSubTask[]
  issues: CloseIssue[]
}

interface CloseSubTask {
  id: string
  name: string
  status: 'pending' | 'completed' | 'failed'
  completedBy?: string
  completedAt?: number
}

interface CloseIssue {
  id: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'resolved' | 'wont_fix'
  raisedBy: string
  raisedAt: number
}

const stageNames = [
  'تسوية الحسابات البنكية',
  'تسوية حسابات العملاء والموردين',
  'جرد المخزون',
  'إهلاك الأصول الثابتة',
  'تسوية حسابات المصروفات المدفوعة مقدماً',
  'حسابات الإيرادات المؤجلة',
  'تسوية ضريبة القيمة المضافة',
  'إقفال حسابات الدخل',
  'إقفال حسابات الميزانية',
  'إعداد التقارير المالية',
  'مراجعة المدقق الخارجي',
  'اعتماد القوائم المالية',
]

const stageDescriptions = [
  'مطابقة كشوف البنك مع السجلات المحاسبية',
  'مراجعة أرصدة العملاء والموردين',
  'الجرد الفعلي للمخزون ومطابقته',
  'احتساب إهلاك الأصول الثابتة للفترة',
  'تسوية المصروفات المدفوعة مقدماً',
  'تسوية الإيرادات غير المكتسبة',
  'التأكد من صحة حسابات ضريبة القيمة المضافة',
  'إقفال حسابات الإيرادات والمصروفات',
  'ترحيل الأرصدة إلى الفترة القادمة',
  'إعداد القوائم المالية للفترة',
  'مراجعة القوائم من قبل المدقق الخارجي',
  'الاعتماد النهائي ونشر القوائم المالية',
]

const employees = [
  'أحمد محمد', 'سارة خالد', 'فهد العتيبي', 'نورة عبدالله',
  'ماجد الحربي', 'ريم الشهري', 'خالد القحطاني', 'هند السبيعي',
]

function generateCloseStages(): CloseStage[] {
  return stageNames.map((name, idx) => {
    const now = Date.now()
    let status: CloseStage['status']
    if (idx < 5) status = 'completed'
    else if (idx === 5) status = 'in_progress'
    else if (idx < 8) status = 'pending'
    else status = 'pending'

    const subTasks: CloseSubTask[] = [
      { id: `st-${idx}-1`, name: `الخطوة الأولى للمرحلة ${idx + 1}`, status: idx < 5 ? 'completed' : idx === 5 ? 'completed' : 'pending' },
      { id: `st-${idx}-2`, name: `الخطوة الثانية للمرحلة ${idx + 1}`, status: idx < 5 ? 'completed' : idx === 5 ? 'in_progress' as any : 'pending' },
      { id: `st-${idx}-3`, name: `الخطوة الثالثة للمرحلة ${idx + 1}`, status: idx < 4 ? 'completed' : 'pending' },
      { id: `st-${idx}-4`, name: `مراجعة وتدقيق المرحلة ${idx + 1}`, status: idx < 4 ? 'completed' : 'pending' },
      { id: `st-${idx}-5`, name: `اعتماد المرحلة ${idx + 1}`, status: idx < 3 ? 'completed' : 'pending' },
    ]

    const issues: CloseIssue[] = idx === 5 ? [
      { id: `iss-${idx}-1`, description: 'فروقات في تسوية البنك الرئيسي', severity: 'high', status: 'open', raisedBy: 'فهد العتيبي', raisedAt: now - 86400000 * 2 },
      { id: `iss-${idx}-2`, description: 'مستندات شحن ناقصة', severity: 'medium', status: 'open', raisedBy: 'سارة خالد', raisedAt: now - 86400000 },
    ] : idx === 7 ? [
      { id: `iss-${idx}-1`, description: 'حساب مصروفات لم يقفل بشكل صحيح', severity: 'critical', status: 'open', raisedBy: 'أحمد محمد', raisedAt: now - 86400000 * 3 },
    ] : []

    return {
      id: `stage-${idx}`,
      name,
      description: stageDescriptions[idx],
      status,
      progress: idx < 3 ? 100 : idx === 3 ? 80 : idx === 4 ? 60 : idx === 5 ? 35 : 0,
      dueDate: now + (12 - idx) * 86400000,
      assignee: employees[idx % employees.length],
      subTasks,
      issues,
    }
  })
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'; icon: any }> = {
  pending: { label: 'قادمة', variant: 'secondary', icon: Clock },
  in_progress: { label: 'قيد التنفيذ', variant: 'warning', icon: PlayCircle },
  completed: { label: 'مكتملة', variant: 'success', icon: CheckCircle2 },
  failed: { label: 'فاشلة', variant: 'destructive', icon: XCircle },
  skipped: { label: 'تم تخطيها', variant: 'outline', icon: XCircle },
}

const filterTabs = [
  { id: 'all', label: 'الكل' },
  { id: 'pending', label: 'قادمة' },
  { id: 'in_progress', label: 'قيد التنفيذ' },
  { id: 'completed', label: 'مكتملة' },
  { id: 'failed', label: 'فاشلة' },
]

export function FinancialCloseWorkbench() {
  const [stages] = useState(() => generateCloseStages())
  const [closedPeriod] = useState('أبريل 2026')
  const [nextCloseDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1, 5)
    return d.getTime()
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState('all')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [inspectorTab, setInspectorTab] = useState('history')
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('tasks')

  const aiInsights = useMemo(() => generateMockAIInsights('close'), [])
  const auditTrail = useMemo(() => generateMockAuditTrail(), [])

  const selected = useMemo(
    () => stages.find((s) => s.id === selectedId) ?? null,
    [stages, selectedId],
  )

  const filtered = useMemo(() => {
    let list = stages
    if (filterTab !== 'all') {
      list = list.filter((s) => s.status === filterTab)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
    }
    return list
  }, [stages, filterTab, searchQuery])

  const allValidationMessages = useMemo(() => {
    const msgs: ValidationMessage[] = []
    const inProgress = stages.filter((s) => s.status === 'in_progress')
    const failed = stages.filter((s) => s.status === 'failed')
    const openIssues = stages.reduce((count, s) => count + s.issues.filter((i) => i.status === 'open').length, 0)

    if (failed.length > 0) {
      msgs.push({
        id: 'failed-stages',
        type: 'error' as const,
        message: `يوجد ${failed.length} مراحل فاشلة تتطلب التدخل`,
        field: 'مراحل الإغلاق',
        action: { label: 'عرض التفاصيل', handler: () => {} },
      })
    }
    if (openIssues > 0) {
      msgs.push({
        id: 'open-issues',
        type: 'warning' as const,
        message: `يوجد ${openIssues} مشكلة مفتوحة لم يتم حلها`,
        field: 'المشكلات',
      })
    }
    if (inProgress.length === 0 && stages.some((s) => s.status === 'pending')) {
      msgs.push({
        id: 'no-progress',
        type: 'info' as const,
        message: 'لم تبدأ أي مرحلة جديدة بعد. يرجى بدء المرحلة التالية',
        field: 'التقدم',
      })
    }
    return msgs.slice(0, 6)
  }, [stages])

  const completeCount = useMemo(() => stages.filter((s) => s.status === 'completed').length, [stages])
  const inProgressCount = useMemo(() => stages.filter((s) => s.status === 'in_progress').length, [stages])
  const pendingCount = useMemo(() => stages.filter((s) => s.status === 'pending').length, [stages])
  const failedCount = useMemo(() => stages.filter((s) => s.status === 'failed').length, [stages])
  const daysUntilClose = useMemo(() => {
    return Math.ceil((nextCloseDate - Date.now()) / 86400000)
  }, [nextCloseDate])

  const overallProgress = useMemo(() => {
    if (stages.length === 0) return 0
    const total = stages.reduce((s, stage) => s + stage.progress, 0)
    return Math.round(total / stages.length)
  }, [stages])

  const metrics: WorkbenchMetric[] = useMemo(() => [
    { id: 'total-stages', label: 'مراحل الإغلاق', value: stages.length, icon: 'DollarSign', severity: 'info' as const },
    { id: 'completed', label: 'مكتمل', value: completeCount, icon: 'DollarSign', severity: 'success' as const, change: 20, trend: 'up' as const },
    { id: 'remaining', label: 'متبقي', value: pendingCount + inProgressCount, icon: 'AlertTriangle', severity: pendingCount > 0 ? 'warning' as const : 'success' as const, change: -15, trend: 'down' as const },
    { id: 'days-left', label: 'أيام للإغلاق', value: daysUntilClose, icon: 'AlertTriangle', severity: daysUntilClose < 5 ? 'critical' as const : daysUntilClose < 10 ? 'warning' as const : 'info' as const },
  ], [stages.length, completeCount, pendingCount, inProgressCount, daysUntilClose])

  const inspectorTabs: InspectorTab[] = useMemo(
    () => [
      { id: 'history', label: 'سجل المهام', icon: 'info' },
      { id: 'comparison', label: 'مقارنة سابقة', icon: 'activity' },
    ],
    [],
  )

  const formatCurrency = (n: number) =>
    n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const statusBadge = (status: CloseStage['status']) => {
    const config = statusConfig[status] || statusConfig.pending
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const renderCloseProgress = () => (
    <div className="p-6 border-b bg-muted/10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">إغلاق فترة {closedPeriod}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            الموعد النهائي: {new Date(nextCloseDate).toLocaleDateString('ar-SA')} ({daysUntilClose} يوم متبقي)
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select
            value={closedPeriod}
            onChange={() => {}}
            options={[
              { value: 'أبريل 2026', label: 'أبريل 2026' },
              { value: 'مارس 2026', label: 'مارس 2026' },
              { value: 'فبراير 2026', label: 'فبراير 2026' },
            ]}
            className="w-36"
          />
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
            <RotateCcw className="h-3.5 w-3.5" />
            بدء دورة الإغلاق
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">التقدم العام</span>
            <span className="font-semibold">{overallProgress}%</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                overallProgress === 100 ? 'bg-green-500' : overallProgress > 50 ? 'bg-blue-500' : 'bg-amber-500',
              )}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            {completeCount} مكتمل
          </span>
          <span className="flex items-center gap-1">
            <PlayCircle className="h-3.5 w-3.5 text-blue-600" />
            {inProgressCount} قيد التنفيذ
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {pendingCount} قادمة
          </span>
          {failedCount > 0 && (
            <span className="flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5 text-red-600" />
              {failedCount} فاشلة
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {stages.map((stage, idx) => {
          const config = statusConfig[stage.status] || statusConfig.pending
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => {
                setSelectedId(stage.id)
                setFilterTab('all')
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors',
                selectedId === stage.id ? 'border-primary bg-primary/5' : 'bg-card hover:bg-accent',
                stage.status === 'completed' ? 'border-green-200' : '',
                stage.status === 'failed' ? 'border-red-200' : '',
              )}
            >
              <div className={cn(
                'h-2 w-2 rounded-full',
                stage.status === 'completed' ? 'bg-green-500' :
                stage.status === 'in_progress' ? 'bg-blue-500' :
                stage.status === 'failed' ? 'bg-red-500' :
                'bg-gray-300',
              )} />
              <span className="truncate max-w-[100px]">{stage.name}</span>
              <span className="text-muted-foreground">({stage.progress}%)</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  const renderStageList = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث عن مرحلة..."
            className="flex h-9 w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
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
            <Flag className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">لا توجد مراحل متطابقة</p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((stage) => {
              const isSelected = stage.id === selectedId
              const config = statusConfig[stage.status] || statusConfig.pending
              const StatusIcon = config.icon
              const openIssues = stage.issues.filter((i) => i.status === 'open').length
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setSelectedId(stage.id)}
                  className={cn(
                    'w-full text-right p-4 transition-colors hover:bg-accent/50',
                    isSelected && 'bg-accent border-r-2 border-r-primary',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                      stage.status === 'completed' ? 'bg-green-50 text-green-600' :
                      stage.status === 'failed' ? 'bg-red-50 text-red-600' :
                      stage.status === 'in_progress' ? 'bg-blue-50 text-blue-600' :
                      'bg-gray-50 text-gray-400',
                    )}>
                      {stage.status === 'completed' ? <CheckCircle2 className="h-4 w-4" /> :
                       stage.status === 'failed' ? <XCircle className="h-4 w-4" /> :
                       stage.status === 'in_progress' ? <PlayCircle className="h-4 w-4" /> :
                       <Clock className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold truncate">{stage.name}</span>
                        <Badge variant={config.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                        {openIssues > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {openIssues} مشكلة
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{stage.description}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {stage.assignee}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(stage.dueDate).toLocaleDateString('ar-SA')}
                        </span>
                        <span className="text-muted-foreground">
                          {stage.subTasks.filter((t) => t.status === 'completed').length}/{stage.subTasks.length} مهام
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            stage.status === 'completed' ? 'bg-green-500' :
                            stage.status === 'failed' ? 'bg-red-500' :
                            'bg-blue-500',
                          )}
                          style={{ width: `${stage.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  const renderStageDetail = () => {
    if (!selected) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-12">
          <Flag className="h-16 w-16 text-muted-foreground/20 mb-4" />
          <h3 className="text-lg font-semibold mb-2">اختر مرحلة إغلاق</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            اختر مرحلة من قائمة مراحل الإغلاق المالي لعرض التفاصيل والمهام الفرعية والمشكلات
          </p>
        </div>
      )
    }

    const config = statusConfig[selected.status] || statusConfig.pending
    const StatusIcon = config.icon
    const openIssues = selected.issues.filter((i) => i.status === 'open')
    const completedTasks = selected.subTasks.filter((t) => t.status === 'completed').length

    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                'h-14 w-14 rounded-xl flex items-center justify-center',
                selected.status === 'completed' ? 'bg-green-50' :
                selected.status === 'failed' ? 'bg-red-50' :
                selected.status === 'in_progress' ? 'bg-blue-50' :
                'bg-gray-50',
              )}>
                {selected.status === 'completed' ? <CheckCircle2 className={cn('h-7 w-7', 'text-green-600')} /> :
                 selected.status === 'failed' ? <XCircle className={cn('h-7 w-7', 'text-red-600')} /> :
                 selected.status === 'in_progress' ? <PlayCircle className={cn('h-7 w-7', 'text-blue-600')} /> :
                 <Clock className={cn('h-7 w-7', 'text-gray-400')} />}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-bold">{selected.name}</h2>
                  <Badge variant={config.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    المسؤول: {selected.assignee}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    تاريخ الاستحقاق: {new Date(selected.dueDate).toLocaleDateString('ar-SA')}
                  </span>
                  <span className="flex items-center gap-1">
                    <ListChecks className="h-3.5 w-3.5" />
                    {completedTasks}/{selected.subTasks.length} مهام
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selected.status === 'pending' && (
              <Button size="sm" className="gap-1.5">
                <PlayCircle className="h-4 w-4" />
                بدء المرحلة
              </Button>
            )}
            {selected.status === 'in_progress' && (
              <>
                <Button size="sm" className="gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  إكمال المرحلة
                </Button>
                <Button size="sm" variant="secondary" className="gap-1.5">
                  <PauseCircle className="h-4 w-4" />
                  إيقاف مؤقت
                </Button>
              </>
            )}
            {selected.status === 'failed' && (
              <Button size="sm" variant="secondary" className="gap-1.5">
                <RotateCcw className="h-4 w-4" />
                إعادة المحاولة
              </Button>
            )}
            <div className="w-px h-6 bg-border mx-1" />
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

        <div className="flex-1 overflow-y-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
            <TabsList className="mb-4">
              <TabsTrigger value="tasks">المهام الفرعية</TabsTrigger>
              <TabsTrigger value="issues">المشكلات</TabsTrigger>
              <TabsTrigger value="reconciliation">التسويات</TabsTrigger>
              <TabsTrigger value="comments">التعليقات</TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="mt-0 space-y-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold">قائمة المهام الفرعية</h4>
                    <span className="text-xs text-muted-foreground">
                      {completedTasks} / {selected.subTasks.length} مكتملة
                    </span>
                  </div>
                  <div className="space-y-2">
                    {selected.subTasks.map((task) => (
                      <div
                        key={task.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                          task.status === 'completed' ? 'bg-green-50 border-green-200' :
                          task.status === 'failed' ? 'bg-red-50 border-red-200' :
                          'bg-card',
                        )}
                      >
                        <div className={cn(
                          'h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0',
                          task.status === 'completed' ? 'border-green-500 bg-green-500 text-white' :
                          task.status === 'failed' ? 'border-red-500 bg-red-500 text-white' :
                          'border-gray-300',
                        )}>
                          {task.status === 'completed' ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : task.status === 'failed' ? (
                            <XCircle className="h-3.5 w-3.5" />
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-gray-300" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={cn(
                            'text-sm',
                            task.status === 'completed' ? 'line-through text-muted-foreground' : 'font-medium',
                          )}>
                            {task.name}
                          </p>
                          {task.completedBy && (
                            <p className="text-xs text-muted-foreground">
                              بواسطة {task.completedBy} - {task.completedAt ? new Date(task.completedAt).toLocaleDateString('ar-SA') : ''}
                            </p>
                          )}
                        </div>
                        {task.status === 'pending' && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 ml-1" />
                            إكمال
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold mb-3">مؤشرات المرحلة</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">تقدم المهام</span>
                        <span>{Math.round((completedTasks / selected.subTasks.length) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            completedTasks === selected.subTasks.length ? 'bg-green-500' : 'bg-blue-500',
                          )}
                          style={{ width: `${(completedTasks / selected.subTasks.length) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{selected.subTasks.length}</div>
                        <div className="text-xs text-muted-foreground">إجمالي المهام</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
                        <div className="text-xs text-muted-foreground">مكتملة</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="issues" className="mt-0 space-y-3">
              {openIssues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500/50 mb-3" />
                  <p className="text-sm text-muted-foreground">لا توجد مشكلات مفتوحة في هذه المرحلة</p>
                </div>
              ) : (
                selected.issues.map((issue) => {
                  const severityColors: Record<string, string> = {
                    low: 'border-gray-200 bg-gray-50',
                    medium: 'border-amber-200 bg-amber-50',
                    high: 'border-orange-200 bg-orange-50',
                    critical: 'border-red-200 bg-red-50',
                  }
                  const severityLabels: Record<string, string> = {
                    low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة',
                  }
                  return (
                    <Card key={issue.id} className={cn('border', severityColors[issue.severity])}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className={cn(
                            'h-5 w-5 mt-0.5 shrink-0',
                            issue.severity === 'critical' ? 'text-red-600' :
                            issue.severity === 'high' ? 'text-orange-600' :
                            'text-amber-600',
                          )} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold">{issue.description}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>بواسطة: {issue.raisedBy}</span>
                              <span>التاريخ: {new Date(issue.raisedAt).toLocaleDateString('ar-SA')}</span>
                              <Badge variant={
                                issue.severity === 'critical' ? 'destructive' :
                                issue.severity === 'high' ? 'warning' : 'secondary'
                              }>
                                {severityLabels[issue.severity]}
                              </Badge>
                              <Badge variant={issue.status === 'open' ? 'outline' : 'success'}>
                                {issue.status === 'open' ? 'مفتوحة' : 'محلولة'}
                              </Badge>
                            </div>
                          </div>
                          {issue.status === 'open' && (
                            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              حل
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                تسجيل مشكلة جديدة
              </Button>
            </TabsContent>

            <TabsContent value="reconciliation" className="mt-0 space-y-4">
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold mb-4">حسابات مرتبطة بهذه المرحلة</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الحساب</TableHead>
                        <TableHead>الرصيد</TableHead>
                        <TableHead>آخر تسوية</TableHead>
                        <TableHead>الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { name: 'البنك الأهلي', balance: 450000, lastRecon: '2026-03-25', status: 'منتظم' },
                        { name: 'حساب جاري الراجحي', balance: 285000, lastRecon: '2026-03-20', status: 'منتظم' },
                        { name: 'صندوق النقدية', balance: 15000, lastRecon: '2026-03-28', status: 'قيد التسوية' },
                      ].map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell dir="ltr">{formatCurrency(row.balance)} ريال</TableCell>
                          <TableCell>{row.lastRecon}</TableCell>
                          <TableCell>
                            <Badge variant={row.status === 'منتظم' ? 'success' : 'warning'}>
                              {row.status}
                            </Badge>
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
      case 'history':
        return (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold mb-3">سجل المهام للمرحلة</h4>
                <div className="space-y-3">
                  {auditTrail.slice(0, 6).map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2">
                      <div className={cn(
                        'h-2 w-2 rounded-full mt-1.5 shrink-0',
                        entry.type === 'approve' ? 'bg-green-500' :
                        entry.type === 'reject' ? 'bg-red-500' :
                        'bg-blue-500',
                      )} />
                      <div>
                        <p className="text-xs font-medium">{entry.action}</p>
                        <p className="text-[10px] text-muted-foreground">{entry.actor} - {new Date(entry.timestamp).toLocaleDateString('ar-SA')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )
      case 'comparison':
        return (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold mb-3">مقارنة مع الإغلاق السابق</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">مدة الإغلاق السابق</span>
                    <span>5 أيام</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">مدة الإغلاق الحالي</span>
                    <span className="text-blue-600 font-medium">3 أيام (تحسن)</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">المشكلات في الإغلاق السابق</span>
                    <span>4 مشكلات</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">المشكلات في الإغلاق الحالي</span>
                    <span className="text-green-600 font-medium">1 مشكلة (تحسن)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <CrossEntityInspector entityType="workflow" entityId={selected.id} />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <>
      <WorkbenchShell
        title="منصة الإغلاق المالي"
        breadcrumbs={[
          { label: 'المالية' },
          { label: 'الإغلاق المالي' },
        ]}
        metrics={metrics}
        actions={[
          { id: 'start-close', label: 'بدء دورة الإغلاق', type: 'primary', icon: 'PlayCircle' },
          { id: 'close-report', label: 'تقرير الإغلاق', type: 'secondary', icon: 'Download' },
          { id: 'validate-all', label: 'تحقق شامل', type: 'secondary', icon: 'CheckCheck' },
        ]}
        inspectorTabs={inspectorTabs}
        inspectorContent={renderInspectorContent()}
        inspectorOpen={inspectorOpen}
        onInspectorToggle={setInspectorOpen}
        inspectorTab={inspectorTab}
        onInspectorTabChange={setInspectorTab}
        sidebar={renderStageList()}
        sidebarWidth={420}
        validationBar={
          <RealtimeValidationBar messages={allValidationMessages} />
        }
        aiPanel={
          <AIAssistancePanel
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            domain="close"
            entityId={selectedId ?? undefined}
            insights={aiInsights}
          />
        }
      >
        <div className="flex flex-col h-full">
          {renderCloseProgress()}
          {renderStageDetail()}
        </div>
      </WorkbenchShell>

      <AuditOverlay
        entries={auditTrail}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        entityId={selectedId ?? undefined}
        entityType="Financial Close"
      />
    </>
  )
}
