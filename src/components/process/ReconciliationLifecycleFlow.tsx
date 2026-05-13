'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Wallet, FileText, CheckCircle2, AlertTriangle,
  Clock, User, Search, ArrowUpDown, Filter, TrendingUp, TrendingDown,
  Building2, Sparkles, Eye, Landmark, ArrowLeftRight, BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { ProcessPipeline } from './ProcessPipeline'
import { ProcessTimeline } from './ProcessTimeline'
import { ProcessApprovalCard } from './ProcessApprovalCard'
import { calculateSLADisplay } from '@/lib/workflow/engine'
import type { ProcessItem, ProcessStage, ProcessApproval, ProcessActivity, ProcessFlowMetrics, ProcessStageTemplate } from '@/lib/process/types'

const STAGE_TEMPLATES: ProcessStageTemplate[] = [
  { id: 'data_import', name: 'استيراد البيانات', order: 0, slaMinutes: 120, assigneeRole: 'نظام' },
  { id: 'matching', name: 'المطابقة الآلية', order: 1, slaMinutes: 60, assigneeRole: 'نظام' },
  { id: 'investigation', name: 'التحقق من الفروقات', order: 2, slaMinutes: 480, assigneeRole: 'محاسب' },
  { id: 'adjustment', name: 'قيود التسوية', order: 3, slaMinutes: 240, assigneeRole: 'محاسب أول' },
  { id: 'review', name: 'مراجعة التسوية', order: 4, slaMinutes: 180, assigneeRole: 'مراجع' },
  { id: 'close', name: 'إقفال التسوية', order: 5, slaMinutes: 60, assigneeRole: 'مدير مالي' },
]

const FILTER_TABS = [
  { id: 'all', label: 'الكل' },
  { id: 'data_import', label: 'استيراد' },
  { id: 'matching', label: 'مطابقة' },
  { id: 'investigation', label: 'تحقق' },
  { id: 'adjustment', label: 'تسوية' },
  { id: 'review', label: 'مراجعة' },
  { id: 'close', label: 'إقفال' },
] as const

const DETAIL_TABS = [
  { id: 'pipeline', label: 'سير العمل', icon: ArrowLeftRight },
  { id: 'timeline', label: 'النشاطات', icon: Clock },
  { id: 'approvals', label: 'الموافقات', icon: CheckCircle2 },
  { id: 'info', label: 'معلومات', icon: FileText },
] as const

const ITEM_TYPES = ['كشف بنك', 'تسوية', 'مطابقة'] as const

const OWNERS = [
  { id: 'u1', name: 'خالد الأحمد' },
  { id: 'u2', name: 'محمد العتيبي' },
  { id: 'u3', name: 'سارة الفيصل' },
  { id: 'u4', name: 'عبدالله السعيد' },
  { id: 'u5', name: 'نورة الدوسري' },
  { id: 'u6', name: 'فيصل المطيري' },
  { id: 'u7', name: 'هند القحطاني' },
  { id: 'u8', name: 'يوسف الشمري' },
  { id: 'u9', name: 'مها الزهراني' },
  { id: 'u10', name: 'تركي الغامدي' },
]

const TAGS_POOL = ['بنك', 'نقدية', 'شهرية', 'ضريبية', 'تدقيق'] as const

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickN<T>(arr: readonly T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

function rng(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function buildStages(currentStageIdx: number, startedBase: number): ProcessStage[] {
  return STAGE_TEMPLATES.map((tmpl, idx) => {
    const status: ProcessStage['status'] =
      idx < currentStageIdx ? 'completed' :
      idx === currentStageIdx ? 'active' :
      'pending'
    const startedAt = idx <= currentStageIdx ? startedBase + idx * 3600000 : undefined
    const completedAt = idx < currentStageIdx ? startedBase + (idx + 1) * 3600000 : undefined
    return {
      id: tmpl.id,
      name: tmpl.name,
      order: tmpl.order,
      status,
      assignee: { id: `assignee_${tmpl.id}`, name: tmpl.assigneeRole },
      slaMinutes: tmpl.slaMinutes,
      startedAt,
      completedAt,
    }
  })
}

function buildActivities(itemId: string, itemTitle: string, stages: ProcessStage[], count: number): ProcessActivity[] {
  const activities: ProcessActivity[] = []
  const types: ProcessActivity['type'][] = ['stage_change', 'comment', 'system', 'approval']
  const actors = [OWNERS[0], OWNERS[1], OWNERS[2]]
  for (let i = 0; i < count; i++) {
    const stage = stages[i % stages.length] || stages[0]
    const actor = actors[i % actors.length]
    activities.push({
      id: `act_${itemId}_${i}`,
      type: types[i % types.length],
      action: stage.status === 'completed' ? `إكمال ${stage.name}` : `بدء ${stage.name}`,
      actor,
      timestamp: Date.now() - (count - i) * 1800000,
      details: `${actor.name} ${stage.status === 'completed' ? 'أكمل' : 'بدأ'} مرحلة "${stage.name}"`,
      stageId: stage.id,
    })
  }
  return activities
}

function buildApprovals(itemId: string, stages: ProcessStage[], count: number): ProcessApproval[] {
  const approvals: ProcessApproval[] = []
  for (let i = 0; i < count; i++) {
    const stage = stages[i * 2] || stages[0]
    const decision: ProcessApproval['decision'] = i === 0 ? 'approved' : 'pending'
    approvals.push({
      id: `apr_${itemId}_${i}`,
      stageId: stage.id,
      title: `موافقة على ${stage.name}`,
      requestedBy: { id: 'req1', name: 'نظام التسوية' },
      assignedTo: i === 0 ? OWNERS[2] : OWNERS[3],
      decision,
      comments: decision === 'approved' ? 'تمت المراجعة والموافقة' : undefined,
      createdAt: Date.now() - (count - i) * 3600000,
      respondedAt: decision === 'approved' ? Date.now() - (count - i - 1) * 3600000 : undefined,
    })
  }
  return approvals
}

function generateItem(
  id: string,
  title: string,
  type: string,
  refNumber: string,
  amount: number,
  currentStageIdx: number,
  priority: ProcessItem['priority'],
  slaMinutes: number,
  owner: { id: string; name: string },
  tags: string[],
  activityCount: number,
  approvalCount: number,
): ProcessItem {
  const createdAt = Date.now() - rng(1, 48) * 3600000
  const stages = buildStages(currentStageIdx, createdAt)
  const activities = buildActivities(id, title, stages, activityCount)
  const approvals = buildApprovals(id, stages, approvalCount)
  const linkedModules = [
    { label: 'البنوك', href: '/banking/statements', icon: 'Landmark' },
    { label: 'دفتر الأستاذ', href: '/ledger/cash', icon: 'BookOpen' },
    { label: 'التقارير', href: '/reports/reconciliation', icon: 'FileText' },
  ]

  const recommendations: Record<string, string> = {
    investigation: 'يوجد فرق قيد التحقق بقيمة ١٢٬٥٠٠ ريال. يرجى مراجعة كشف البنك المقابل.',
    adjustment: 'تم تحديد ٣ فروقات تتطلب قيود تسوية. القيمة التقديرية ٤٥٬٠٠٠ ريال.',
    review: 'جميع قيود التسوية معتمدة. المراجعة النهائية معلقة.',
    close: 'اكتملت جميع مراحل التسوية. جاهز للإقفال.',
  }

  const currentStageId = stages[currentStageIdx]?.id ?? 'close'
  const aiRecommendation = recommendations[currentStageId] || 'جاري معالجة البيانات...'

  return {
    id,
    type,
    title,
    refNumber,
    priority,
    status: currentStageIdx >= stages.length - 1 ? 'completed' : 'active',
    stages,
    currentStage: currentStageId,
    approvals,
    activities,
    owner,
    amount,
    currency: 'SAR',
    createdAt,
    slaMinutes,
    tags,
    linkedModules,
    aiRecommendation,
  }
}

const MOCK_ITEMS: ProcessItem[] = [
  generateItem('rec_01', 'تسوية حساب بنك الراجحي الجاري', 'تسوية', 'REC-1001', 2450000, 1, 'critical', 480, OWNERS[0], ['بنك', 'شهرية'], 3, 1),
  generateItem('rec_02', 'تسوية حساب بنك الأهلي', 'تسوية', 'REC-1002', 1850000, 3, 'high', 720, OWNERS[1], ['بنك', 'شهرية'], 4, 2),
  generateItem('rec_03', 'تسوية حساب بنك الرياض', 'تسوية', 'REC-1003', 3200000, 5, 'medium', 240, OWNERS[2], ['بنك', 'تدقيق'], 5, 1),
  generateItem('rec_04', 'تسوية حساب المدفوعات الإلكترونية', 'تسوية', 'REC-1004', 980000, 4, 'high', 480, OWNERS[3], ['نقدية', 'شهرية'], 6, 2),
  generateItem('rec_05', 'تسوية حساب بطاقات الائتمان', 'تسوية', 'REC-1005', 1520000, 2, 'critical', 720, OWNERS[4], ['بنك', 'شهرية'], 4, 2),
  generateItem('rec_06', 'تسوية حساب النقدية بالخزينة', 'تسوية', 'REC-1006', 450000, 0, 'low', 120, OWNERS[5], ['نقدية'], 2, 0),
  generateItem('rec_07', 'مطابقة كشف بنك الجزيرة', 'كشف بنك', 'BNK-2001', 4100000, 1, 'high', 480, OWNERS[6], ['بنك', 'تدقيق'], 5, 1),
  generateItem('rec_08', 'تسوية حساب بنك البلاد', 'تسوية', 'REC-1007', 1750000, 4, 'medium', 240, OWNERS[7], ['بنك', 'شهرية'], 6, 2),
  generateItem('rec_09', 'تسوية حساب الضرائب', 'تسوية', 'REC-1008', 2800000, 2, 'critical', 480, OWNERS[8], ['ضريبية', 'شهرية'], 4, 2),
  generateItem('rec_10', 'تسوية حساب الموردين', 'تسوية', 'REC-1009', 1250000, 3, 'high', 720, OWNERS[9], ['نقدية', 'شهرية'], 5, 1),
  generateItem('rec_11', 'تسوية حسابات العملاء', 'تسوية', 'REC-1010', 1950000, 0, 'medium', 120, OWNERS[0], ['نقدية', 'تدقيق'], 3, 1),
  generateItem('rec_12', 'مطابقة كشف بنك الإنماء', 'مطابقة', 'BNK-2002', 3850000, 1, 'high', 480, OWNERS[1], ['بنك'], 4, 1),
  generateItem('rec_13', 'تسوية حساب الزكاة', 'تسوية', 'REC-1011', 520000, 5, 'low', 60, OWNERS[2], ['ضريبية', 'شهرية'], 7, 1),
  generateItem('rec_14', 'تسوية حساب الرواتب', 'تسوية', 'REC-1012', 2100000, 2, 'high', 480, OWNERS[3], ['نقدية', 'شهرية'], 4, 1),
  generateItem('rec_15', 'تسوية حسابات الإيرادات المؤجلة', 'تسوية', 'REC-1013', 890000, 4, 'medium', 240, OWNERS[4], ['نقدية', 'تدقيق'], 5, 2),
  generateItem('rec_16', 'تسوية حسابات المصروفات المدفوعة مقدماً', 'تسوية', 'REC-1014', 670000, 3, 'medium', 480, OWNERS[5], ['نقدية', 'شهرية'], 4, 1),
  generateItem('rec_17', 'تسوية حساب الصناديق', 'تسوية', 'REC-1015', 340000, 1, 'low', 120, OWNERS[6], ['نقدية'], 3, 0),
  generateItem('rec_18', 'تسوية حساب الشيكات تحت التحصيل', 'تسوية', 'REC-1016', 1750000, 2, 'high', 480, OWNERS[7], ['بنك', 'نقدية'], 5, 2),
  generateItem('rec_19', 'تسوية حساب العملات الأجنبية', 'تسوية', 'REC-1017', 2950000, 4, 'critical', 720, OWNERS[8], ['بنك', 'تدقيق'], 6, 2),
  generateItem('rec_20', 'مطابقة كشف بنك ساب', 'مطابقة', 'BNK-2003', 3600000, 1, 'high', 480, OWNERS[9], ['بنك', 'شهرية'], 4, 1),
]

function formatCurrencySAR(amount: number): string {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const PRIORITY_CONFIG = {
  critical: { label: 'حرج', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  high: { label: 'عالية', className: 'bg-orange-50 text-orange-600 border-orange-200' },
  medium: { label: 'متوسطة', className: 'bg-warning/10 text-warning border-warning/20' },
  low: { label: 'منخفضة', className: 'bg-muted text-muted-foreground border-muted-foreground/20' },
} as const

function PriorityBadge({ priority }: { priority: ProcessItem['priority'] }) {
  const cfg = PRIORITY_CONFIG[priority]
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', cfg.className)}>
      {cfg.label}
    </span>
  )
}

const STAGE_CONFIG: Record<string, { label: string; className: string }> = {
  data_import: { label: 'استيراد', className: 'bg-blue-50 text-blue-600 border-blue-200' },
  matching: { label: 'مطابقة', className: 'bg-purple-50 text-purple-600 border-purple-200' },
  investigation: { label: 'تحقق', className: 'bg-amber-50 text-amber-600 border-amber-200' },
  adjustment: { label: 'تسوية', className: 'bg-cyan-50 text-cyan-600 border-cyan-200' },
  review: { label: 'مراجعة', className: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  close: { label: 'إقفال', className: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
}

function StageBadge({ stageId }: { stageId: string }) {
  const cfg = STAGE_CONFIG[stageId]
  if (!cfg) return null
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', cfg.className)}>
      {cfg.label}
    </span>
  )
}

function SLABadge({ item }: { item: ProcessItem }) {
  const sla = useMemo(() => calculateSLADisplay(item.slaMinutes, item.createdAt), [item.slaMinutes, item.createdAt])
  const colorMap = {
    ok: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    critical: 'text-orange-600 bg-orange-50',
    breached: 'text-destructive bg-destructive/10',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium', colorMap[sla.status])}>
      <Clock className="h-2.5 w-2.5" />
      {sla.remainingDisplay}
    </span>
  )
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Wallet; className: string }> = {
  'كشف بنك': { label: 'كشف بنك', icon: Landmark, className: 'bg-blue-50 text-blue-600' },
  'تسوية': { label: 'تسوية', icon: ArrowLeftRight, className: 'bg-purple-50 text-purple-600' },
  'مطابقة': { label: 'مطابقة', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-600' },
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ar-SA', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function computeMetrics(items: ProcessItem[]): ProcessFlowMetrics {
  const now = Date.now()
  return {
    totalItems: items.length,
    activeItems: items.filter(i => i.status === 'active').length,
    completedItems: items.filter(i => i.status === 'completed').length,
    overdueItems: items.filter(i => {
      const sla = calculateSLADisplay(i.slaMinutes, i.createdAt)
      return sla.status === 'critical' || sla.status === 'breached'
    }).length,
    avgCompletionTime: 24 * 3600000,
    totalAmount: items.reduce((s, i) => s + (i.amount ?? 0), 0),
    pendingApprovals: items.reduce((s, i) => s + i.approvals.filter(a => a.decision === 'pending').length, 0),
  }
}

function getAIRecommendation(selectedItem: ProcessItem | null, items: ProcessItem[]): string {
  if (selectedItem?.aiRecommendation) return selectedItem.aiRecommendation
  const overdue = items.filter(i => {
    const sla = calculateSLADisplay(i.slaMinutes, i.createdAt)
    return sla.status === 'critical' || sla.status === 'breached'
  })
  if (overdue.length > 0) {
    return `يوجد ${overdue.length} تسوية تجاوزت الوقت المحدد. يوصى بمراجعة التسويات المتأخرة أولاً.`
  }
  const pendingReview = items.filter(i => i.currentStage === 'review')
  if (pendingReview.length > 0) {
    return `يوجد ${pendingReview.length} تسوية بانتظار المراجعة. يرجى إتمام المراجعة لإقفال التسويات.`
  }
  return 'جميع التسويات تسير وفق الخطة الزمنية المحددة.'
}

export function ReconciliationLifecycleFlow() {
  const [selectedId, setSelectedId] = useState<string | null>(MOCK_ITEMS[0]?.id ?? null)
  const [filterStage, setFilterStage] = useState<string>('all')
  const [detailTab, setDetailTab] = useState<string>('pipeline')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortAsc, setSortAsc] = useState(true)

  const selectedItem = useMemo(
    () => MOCK_ITEMS.find(i => i.id === selectedId) ?? null,
    [selectedId],
  )

  const filteredItems = useMemo(() => {
    let list = [...MOCK_ITEMS]
    if (filterStage !== 'all') {
      list = list.filter(i => i.currentStage === filterStage)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.refNumber.toLowerCase().includes(q) ||
        i.owner.name.toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => {
      const cmp = a.createdAt - b.createdAt
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [filterStage, searchQuery, sortAsc])

  const metrics = useMemo(() => computeMetrics(MOCK_ITEMS), [])

  function handleStageTransition(stageId: string, newStatus: 'completed' | 'failed') {
    console.log(`Stage transition: ${stageId} -> ${newStatus}`)
  }

  function handleApprove(id: string) {
    console.log(`Approved: ${id}`)
  }

  function handleReject(id: string) {
    console.log(`Rejected: ${id}`)
  }

  const aiRecommendation = useMemo(
    () => getAIRecommendation(selectedItem, MOCK_ITEMS),
    [selectedItem],
  )

  return (
    <div className="flex flex-col h-full bg-background" dir="rtl">
      {/* Breadcrumbs */}
      <div className="px-6 pt-4 pb-2">
        <EnterpriseBreadcrumbs
          items={[
            { label: 'المالية', href: '/finance' },
            { label: 'دورة التسوية' },
          ]}
        />
      </div>

      {/* Header */}
      <div className="px-6 py-3">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">دورة التسوية المحاسبية</h1>
            <p className="text-sm text-muted-foreground mt-1">
              إدارة ومتابعة دورة التسوية لجميع الحسابات البنكية والمحاسبية
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              آخر تحديث: {formatDate(Date.now())}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="px-6 pb-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">عدد التسويات</span>
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{metrics.totalItems}</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-success" />
              <span className="text-[10px] text-success font-medium">١٢٪ زيادة</span>
              <span className="text-[10px] text-muted-foreground mr-1">عن الشهر الماضي</span>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">مطابقة تلقائية</span>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <p className="text-2xl font-bold">
              {MOCK_ITEMS.filter(i => i.currentStage === 'matching' || i.stages.find(s => s.id === 'matching')?.status === 'completed').length}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-muted-foreground">من أصل {metrics.totalItems} تسوية</span>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">فروقات قائمة</span>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-2xl font-bold">
              {MOCK_ITEMS.filter(i => i.currentStage === 'investigation').length}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingDown className="h-3 w-3 text-destructive" />
              <span className="text-[10px] text-destructive font-medium">٣٪ زيادة</span>
              <span className="text-[10px] text-muted-foreground mr-1">عن الأسبوع الماضي</span>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">تم إقفالها</span>
              <FileText className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold">{metrics.completedItems}</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-muted-foreground">نسبة الإنجاز {Math.round((metrics.completedItems / metrics.totalItems) * 100)}٪</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 px-6 pb-6 gap-4 min-h-0">
        {/* Sidebar */}
        <div className="w-[420px] flex-shrink-0 flex flex-col rounded-xl border bg-card">
          {/* Filter tabs */}
          <div className="p-3 border-b">
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterStage(tab.id)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-lg whitespace-nowrap transition-colors',
                    filterStage === tab.id
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                  )}
                >
                  {tab.label}
                  {tab.id !== 'all' && (
                    <span className="mr-1 opacity-60">
                      {MOCK_ITEMS.filter(i => i.currentStage === tab.id).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Search and sort */}
          <div className="p-3 border-b">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="بحث عن تسوية..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-8 pr-8 pl-3 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                onClick={() => setSortAsc(v => !v)}
                className={cn(
                  'h-8 px-2 rounded-lg border text-xs transition-colors',
                  'hover:bg-accent text-muted-foreground hover:text-foreground',
                )}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">لا توجد تسويات</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {searchQuery ? 'لا توجد نتائج للبحث' : 'جميع التسويات مكتملة'}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredItems.map(item => {
                  const isSelected = item.id === selectedId
                  const typeCfg = TYPE_CONFIG[item.type] || TYPE_CONFIG['تسوية']
                  const TypeIcon = typeCfg.icon
                  const sla = calculateSLADisplay(item.slaMinutes, item.createdAt)
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        'w-full text-right p-3 transition-colors hover:bg-accent/50',
                        isSelected && 'bg-accent',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', typeCfg.className)}>
                          <TypeIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium truncate">{item.title}</span>
                            <PriorityBadge priority={item.priority} />
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{item.refNumber}</span>
                            <span className="text-muted-foreground/30">|</span>
                            <span>{formatCurrencySAR(item.amount ?? 0)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <StageBadge stageId={item.currentStage} />
                            <SLABadge item={item} />
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mr-auto">
                              <User className="h-2.5 w-2.5" />
                              <span>{item.owner.name}</span>
                            </div>
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

        {/* Detail panel */}
        <div className="flex-1 flex flex-col rounded-xl border bg-card min-w-0">
          {selectedItem ? (
            <>
              {/* Detail header */}
              <div className="p-4 border-b">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      TYPE_CONFIG[selectedItem.type]?.className ?? 'bg-muted',
                    )}>
                      {(() => {
                        const Icon = TYPE_CONFIG[selectedItem.type]?.icon ?? FileText
                        return <Icon className="h-5 w-5" />
                      })()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold">{selectedItem.title}</h2>
                        <PriorityBadge priority={selectedItem.priority} />
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-full border font-medium',
                          selectedItem.status === 'completed'
                            ? 'bg-success/10 text-success border-success/20'
                            : 'bg-primary/10 text-primary border-primary/20',
                        )}>
                          {selectedItem.status === 'completed' ? 'مكتمل' : 'قيد التنفيذ'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span>{selectedItem.refNumber}</span>
                        <span className="text-muted-foreground/30">|</span>
                        <span>{formatCurrencySAR(selectedItem.amount ?? 0)}</span>
                        <span className="text-muted-foreground/30">|</span>
                        <span>{selectedItem.type}</span>
                        <span className="text-muted-foreground/30">|</span>
                        <span>تاريخ الإنشاء: {formatDate(selectedItem.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedItem.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Detail tabs */}
                <div className="flex items-center gap-1">
                  {DETAIL_TABS.map(tab => {
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setDetailTab(tab.id)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors',
                          detailTab === tab.id
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {tab.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Detail content */}
              <div className="flex-1 overflow-y-auto p-4">
                {detailTab === 'pipeline' && (
                  <ProcessPipeline
                    item={selectedItem}
                    onStageTransition={handleStageTransition}
                  />
                )}

                {detailTab === 'timeline' && (
                  <ProcessTimeline activities={selectedItem.activities} />
                )}

                {detailTab === 'approvals' && (
                  <div className="rounded-xl border bg-card p-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-4">الموافقات</h3>
                    {selectedItem.approvals.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        لا توجد موافقات
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {selectedItem.approvals.map(approval => (
                          <ProcessApprovalCard
                            key={approval.id}
                            approval={approval}
                            onApprove={handleApprove}
                            onReject={handleReject}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {detailTab === 'info' && (
                  <div className="space-y-4">
                    {/* Info card */}
                    <div className="rounded-xl border bg-card p-4">
                      <h3 className="text-sm font-medium text-muted-foreground mb-4">معلومات التسوية</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs text-muted-foreground">رقم المرجع</span>
                          <p className="text-sm font-medium mt-0.5">{selectedItem.refNumber}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">النوع</span>
                          <p className="text-sm font-medium mt-0.5">{selectedItem.type}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">المبلغ</span>
                          <p className="text-sm font-medium mt-0.5">{formatCurrencySAR(selectedItem.amount ?? 0)}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">العملة</span>
                          <p className="text-sm font-medium mt-0.5">{selectedItem.currency}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">المالك</span>
                          <p className="text-sm font-medium mt-0.5">{selectedItem.owner.name}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">تاريخ الإنشاء</span>
                          <p className="text-sm font-medium mt-0.5">{formatDate(selectedItem.createdAt)}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">المرحلة الحالية</span>
                          <div className="mt-0.5">
                            <StageBadge stageId={selectedItem.currentStage} />
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">SLA</span>
                          <div className="mt-0.5">
                            <SLABadge item={selectedItem} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cross-module links */}
                    <div className="rounded-xl border bg-card p-4">
                      <h3 className="text-sm font-medium text-muted-foreground mb-4">الوحدات المرتبطة</h3>
                      <div className="space-y-2">
                        <a
                          href="/banking/statements"
                          className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Landmark className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium group-hover:text-primary transition-colors">البنوك</p>
                            <p className="text-[10px] text-muted-foreground">كشوف البنك</p>
                          </div>
                          <span className="mr-auto text-xs text-muted-foreground group-hover:text-primary transition-colors">←</span>
                        </a>
                        <a
                          href="/ledger/cash"
                          className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <BookOpen className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium group-hover:text-primary transition-colors">دفتر الأستاذ</p>
                            <p className="text-[10px] text-muted-foreground">النقدية</p>
                          </div>
                          <span className="mr-auto text-xs text-muted-foreground group-hover:text-primary transition-colors">←</span>
                        </a>
                        <a
                          href="/reports/reconciliation"
                          className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium group-hover:text-primary transition-colors">التقارير</p>
                            <p className="text-[10px] text-muted-foreground">تقارير التسوية</p>
                          </div>
                          <span className="mr-auto text-xs text-muted-foreground group-hover:text-primary transition-colors">←</span>
                        </a>
                      </div>
                    </div>

                    {/* AI Recommendation */}
                    <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/[0.02] p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-medium text-primary">توصية ذكية</h3>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">AI</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {aiRecommendation}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" className="shrink-0 h-7 text-xs">
                          <Eye className="h-3 w-3 ml-1" />
                          تفاصيل
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 py-16">
              <Wallet className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <p className="text-base font-medium text-muted-foreground">اختر تسوية لعرض التفاصيل</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                اختر عنصراً من القائمة الجانبية لعرض مسار التسوية
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
