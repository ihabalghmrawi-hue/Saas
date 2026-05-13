'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Wallet, FileText, CheckCircle2, AlertTriangle,
  Clock, User, Search, ArrowUpDown, Filter, TrendingUp, TrendingDown,
  Building2, Sparkles, Eye, Calendar, BarChart3, BookOpen,
  Circle, Loader2, XCircle, SkipForward, ChevronLeft,
  ExternalLink, Lightbulb, RefreshCw, Hash, Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { ProcessPipeline } from './ProcessPipeline'
import { ProcessTimeline } from './ProcessTimeline'
import { ProcessApprovalCard } from './ProcessApprovalCard'
import { calculateSLADisplay } from '@/lib/workflow/engine'
import type { ProcessItem, ProcessStage, ProcessApproval, ProcessActivity, ProcessFlowMetrics, ProcessStageTemplate } from '@/lib/process/types'

const STAGE_TEMPLATES: ProcessStageTemplate[] = [
  { id: 'prepare', name: 'تحضير الإقفال', order: 0, slaMinutes: 480, assigneeRole: 'محاسب' },
  { id: 'reconcile', name: 'تسوية الحسابات', order: 1, slaMinutes: 720, assigneeRole: 'محاسب أول' },
  { id: 'adjust', name: 'قيود التسوية', order: 2, slaMinutes: 360, assigneeRole: 'محاسب أول' },
  { id: 'consolidate', name: 'دمج القوائم', order: 3, slaMinutes: 480, assigneeRole: 'مدير مالي' },
  { id: 'review', name: 'مراجعة نهائية', order: 4, slaMinutes: 360, assigneeRole: 'مراجع داخلي' },
  { id: 'approve', name: 'اعتماد الإقفال', order: 5, slaMinutes: 240, assigneeRole: 'المدير المالي' },
  { id: 'close', name: 'إقفال الفترة', order: 6, slaMinutes: 120, assigneeRole: 'محاسب' },
]

const FILTER_TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'prepare', label: 'تحضير' },
  { id: 'reconcile', label: 'تسوية' },
  { id: 'adjust', label: 'تسويات' },
  { id: 'review', label: 'مراجعة' },
  { id: 'approve', label: 'اعتماد' },
  { id: 'close', label: 'إقفال' },
]

const DETAIL_TABS: { id: string; label: string; icon: typeof FileText }[] = [
  { id: 'pipeline', label: 'مراحل سير العمل', icon: Building2 },
  { id: 'timeline', label: 'النشاطات', icon: Clock },
  { id: 'approvals', label: 'الموافقات', icon: CheckCircle2 },
  { id: 'info', label: 'معلومات', icon: FileText },
]

const SORT_OPTIONS: { id: string; label: string }[] = [
  { id: 'created', label: 'تاريخ الإنشاء' },
  { id: 'priority', label: 'الأولوية' },
  { id: 'status', label: 'الحالة' },
  { id: 'sla', label: 'SLA' },
]

const PRIORITY_CONFIG = {
  critical: { label: 'حرج', className: 'bg-red-100 text-red-700 border-red-200' },
  high: { label: 'عالية', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium: { label: 'متوسطة', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  low: { label: 'منخفضة', className: 'bg-gray-100 text-gray-600 border-gray-200' },
} as const

const STAGE_BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  prepare: { label: 'تحضير', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  reconcile: { label: 'تسوية', className: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  adjust: { label: 'تسويات', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  consolidate: { label: 'دمج', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  review: { label: 'مراجعة', className: 'bg-rose-100 text-rose-700 border-rose-200' },
  approve: { label: 'اعتماد', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  close: { label: 'إقفال', className: 'bg-teal-100 text-teal-700 border-teal-200' },
}

const STATUS_STYLES: Record<string, { label: string; className: string; icon: typeof Circle }> = {
  pending: { label: 'معلق', className: 'text-muted-foreground border-muted-foreground/30', icon: Circle },
  active: { label: 'جاري', className: 'text-primary border-primary', icon: Loader2 },
  completed: { label: 'مكتمل', className: 'text-success border-success/30', icon: CheckCircle2 },
  skipped: { label: 'تم التجاهل', className: 'text-muted-foreground/50 border-muted-foreground/10', icon: SkipForward },
  failed: { label: 'فشل', className: 'text-destructive border-destructive/30', icon: XCircle },
}

const ASSIGNEES: Record<string, { id: string; name: string }> = {
  'محاسب': { id: 'acc-1', name: 'أحمد السيد' },
  'محاسب أول': { id: 'acc-senior-1', name: 'محمد علي' },
  'مدير مالي': { id: 'fm-1', name: 'خالد العبدالله' },
  'مراجع داخلي': { id: 'auditor-1', name: 'سامر الحسن' },
  'المدير المالي': { id: 'cf-1', name: 'عبدالله السالم' },
}

const OWNERS = [
  { id: 'owner-1', name: 'أحمد السيد' },
  { id: 'owner-2', name: 'محمد علي' },
  { id: 'owner-3', name: 'خالد العبدالله' },
  { id: 'owner-4', name: 'سامر الحسن' },
  { id: 'owner-5', name: 'فاطمة الزهراء' },
  { id: 'owner-6', name: 'نورة العنزي' },
]

const CROSS_LINKS = [
  { label: 'دفتر الأستاذ', href: '/ledger', icon: BookOpen },
  { label: 'ميزان المراجعة', href: '/trial-balance', icon: BarChart3 },
  { label: 'القوائم المالية', href: '/financial-statements', icon: FileText },
]

const MODULE_ICON_MAP: Record<string, typeof FileText> = {
  BookOpen, FileText, BarChart3, Building2, Wallet, Users, Eye, Calendar,
}

function buildStages(
  completedUpTo: number,
  activeStageId: string | null,
  baseTime: number,
): ProcessStage[] {
  return STAGE_TEMPLATES.map((t, idx) => {
    if (idx < completedUpTo) {
      const stageStart = baseTime - (completedUpTo - idx) * 7200000
      const stageEnd = baseTime - (completedUpTo - idx - 1) * 7200000
      return {
        id: t.id,
        name: t.name,
        order: t.order,
        status: 'completed',
        assignee: ASSIGNEES[t.assigneeRole],
        slaMinutes: t.slaMinutes,
        startedAt: stageStart,
        completedAt: stageEnd,
      }
    }
    if (t.id === activeStageId) {
      return {
        id: t.id,
        name: t.name,
        order: t.order,
        status: 'active',
        assignee: ASSIGNEES[t.assigneeRole],
        slaMinutes: t.slaMinutes,
        startedAt: baseTime,
      }
    }
    return {
      id: t.id,
      name: t.name,
      order: t.order,
      status: 'pending',
      assignee: ASSIGNEES[t.assigneeRole],
      slaMinutes: t.slaMinutes,
    }
  })
}

function buildActivities(
  completedUpTo: number,
  activeStageId: string | null,
  baseTime: number,
): ProcessActivity[] {
  const activities: ProcessActivity[] = []
  for (let i = 0; i < completedUpTo; i++) {
    const stage = STAGE_TEMPLATES[i]
    activities.push({
      id: `act-${stage.id}-${i}`,
      type: 'stage_change',
      action: `اكتملت مرحلة ${stage.name}`,
      actor: { id: 'sys-1', name: 'نظام الإقفال' },
      timestamp: baseTime - (completedUpTo - i - 0.5) * 7200000,
      details: `تم إكمال مرحلة ${stage.name} بنجاح. ${stage.assigneeRole}: ${ASSIGNEES[stage.assigneeRole].name}`,
      stageId: stage.id,
    })
    if (i === 1 || i === 3) {
      activities.push({
        id: `act-comment-${stage.id}-${i}`,
        type: 'comment',
        action: 'إضافة تعليق',
        actor: { id: 'user-2', name: 'محمد علي' },
        timestamp: baseTime - (completedUpTo - i - 0.3) * 7200000,
        details: 'تمت المراجعة الأولية - جميع المستندات مطابقة',
      })
    }
    if (i === 4) {
      activities.push({
        id: `act-attach-${i}`,
        type: 'attachment',
        action: 'إرفاق مستند',
        actor: { id: 'auditor-1', name: 'سامر الحسن' },
        timestamp: baseTime - (completedUpTo - i - 0.2) * 7200000,
        details: 'إرفاق تقرير التدقيق الداخلي',
      })
    }
  }
  if (activeStageId) {
    const stage = STAGE_TEMPLATES.find((s) => s.id === activeStageId)
    if (stage) {
      activities.push({
        id: `act-start-${stage.id}`,
        type: 'stage_change',
        action: `بدأت مرحلة ${stage.name}`,
        actor: { id: 'sys-1', name: 'نظام الإقفال' },
        timestamp: baseTime,
        details: `تم بدء مرحلة ${stage.name}. المسؤول: ${ASSIGNEES[stage.assigneeRole].name}`,
        stageId: stage.id,
      })
    }
  }
  return activities
}

function buildApprovals(
  completedUpTo: number,
  activeStageId: string | null,
): ProcessApproval[] {
  const approvals: ProcessApproval[] = []
  if (completedUpTo >= 5) {
    approvals.push({
      id: `apr-approve-1`,
      stageId: 'approve',
      title: 'اعتماد الإقفال',
      requestedBy: { id: 'user-1', name: 'المدير المالي' },
      assignedTo: { id: 'cf-1', name: 'عبدالله السالم' },
      decision: completedUpTo >= 6 ? 'approved' : 'pending',
      ...(completedUpTo >= 6
        ? {
            comments: 'تمت المراجعة والاعتماد النهائي',
            createdAt: Date.now() - 14400000,
            respondedAt: Date.now() - 7200000,
          }
        : { createdAt: Date.now() - 3600000 }),
    })
  }
  if (completedUpTo >= 4) {
    approvals.push({
      id: `apr-review-1`,
      stageId: 'review',
      title: 'الموافقة على المراجعة النهائية',
      requestedBy: { id: 'user-2', name: 'محمد علي' },
      assignedTo: { id: 'auditor-1', name: 'سامر الحسن' },
      decision: completedUpTo >= 5 ? 'approved' : 'pending',
      ...(completedUpTo >= 5
        ? {
            comments: 'جميع الحسابات مطابقة للسجلات',
            createdAt: Date.now() - 21600000,
            respondedAt: Date.now() - 18000000,
          }
        : { createdAt: Date.now() - 7200000 }),
    })
  }
  if (activeStageId === 'close' || completedUpTo >= 6) {
    approvals.push({
      id: `apr-close-1`,
      stageId: 'close',
      title: 'إقفال الفترة',
      requestedBy: { id: 'cf-1', name: 'عبدالله السالم' },
      assignedTo: { id: 'acc-1', name: 'أحمد السيد' },
      decision: completedUpTo >= 7 ? 'approved' : 'pending',
      ...(completedUpTo >= 7
        ? {
            comments: 'تم إقفال الفترة بنجاح',
            createdAt: Date.now() - 7200000,
            respondedAt: Date.now() - 3600000,
          }
        : { createdAt: Date.now() - 1800000 }),
    })
  }
  return approvals
}

function createMockItem(
  id: string,
  type: string,
  title: string,
  refNumber: string,
  priority: 'critical' | 'high' | 'medium' | 'low',
  status: ProcessStage['status'],
  completedUpTo: number,
  activeStageId: string | null,
  ownerIdx: number,
  slaMinutes: number,
  tags: string[],
  linkedModules: { label: string; href: string; icon: string }[],
  aiRecommendation?: string,
): ProcessItem {
  const baseTime = Date.now()
  const stages = buildStages(completedUpTo, activeStageId, baseTime)
  const activities = buildActivities(completedUpTo, activeStageId, baseTime)
  const approvals = buildApprovals(completedUpTo, activeStageId)
  return {
    id,
    type,
    title,
    refNumber,
    priority,
    status,
    stages,
    currentStage: activeStageId ?? STAGE_TEMPLATES[completedUpTo]?.id ?? STAGE_TEMPLATES[STAGE_TEMPLATES.length - 1].id,
    approvals,
    activities,
    owner: OWNERS[ownerIdx % OWNERS.length],
    amount: Math.floor(Math.random() * 50000000) + 1000000,
    currency: 'SAR',
    createdAt: baseTime - (15 - parseInt(id.split('-')[2] ?? '1')) * 86400000 * 7,
    slaMinutes,
    tags,
    linkedModules,
    ...(aiRecommendation ? { aiRecommendation } : {}),
  }
}

const MOCK_ITEMS: ProcessItem[] = [
  createMockItem(
    'item-1', 'إقفال شهري', 'إقفال شهر يناير 2024', 'CLS-2024-01',
    'low', 'completed', 7, null, 0, 1440,
    ['شهري', 'تدقيق'],
    [
      { label: 'دفتر الأستاذ', href: '/ledger/jan-2024', icon: 'BookOpen' },
      { label: 'ميزان المراجعة', href: '/trial-balance/jan-2024', icon: 'BarChart3' },
    ],
  ),
  createMockItem(
    'item-2', 'إقفال شهري', 'إقفال شهر فبراير 2024', 'CLS-2024-02',
    'low', 'completed', 7, null, 1, 1440,
    ['شهري'],
    [
      { label: 'دفتر الأستاذ', href: '/ledger/feb-2024', icon: 'BookOpen' },
      { label: 'القوائم المالية', href: '/financial-statements/feb-2024', icon: 'FileText' },
    ],
  ),
  createMockItem(
    'item-3', 'إقفال ربعي', 'إقفال الربع الأول 2024', 'QCLS-2024-Q1',
    'high', 'completed', 7, null, 2, 2880,
    ['ربعي', 'تدقيق', 'نهائي'],
    [
      { label: 'دفتر الأستاذ', href: '/ledger/q1-2024', icon: 'BookOpen' },
      { label: 'ميزان المراجعة', href: '/trial-balance/q1-2024', icon: 'BarChart3' },
      { label: 'القوائم المالية', href: '/financial-statements/q1-2024', icon: 'FileText' },
    ],
    'تم إقفال الربع الأول بنجاح. يوصى بمراجعة حسابات العملاء المدينة.',
  ),
  createMockItem(
    'item-4', 'إقفال شهري', 'إقفال شهر مارس 2024', 'CLS-2024-03',
    'low', 'completed', 7, null, 3, 1440,
    ['شهري'],
    [
      { label: 'ميزان المراجعة', href: '/trial-balance/mar-2024', icon: 'BarChart3' },
      { label: 'التقارير', href: '/reports/mar-2024', icon: 'FileText' },
    ],
  ),
  createMockItem(
    'item-5', 'إقفال شهري', 'إقفال شهر أبريل 2024', 'CLS-2024-04',
    'medium', 'active', 1, 'reconcile', 4, 1440,
    ['شهري', 'تدقيق'],
    [
      { label: 'دفتر الأستاذ', href: '/ledger/apr-2024', icon: 'BookOpen' },
      { label: 'ميزان المراجعة', href: '/trial-balance/apr-2024', icon: 'BarChart3' },
    ],
    'حسابات العملاء بحاجة للتسوية. يرجى مراجعة الفروق في حساب 1210.',
  ),
  createMockItem(
    'item-6', 'إقفال شهري', 'إقفال شهر مايو 2024', 'CLS-2024-05',
    'medium', 'active', 0, 'prepare', 5, 1440,
    ['شهري'],
    [
      { label: 'الحسابات', href: '/accounts/may-2024', icon: 'BookOpen' },
    ],
  ),
  createMockItem(
    'item-7', 'إقفال ربعي', 'إقفال الربع الثاني 2024', 'QCLS-2024-Q2',
    'high', 'pending', 0, null, 0, 2880,
    ['ربعي', 'نهائي'],
    [
      { label: 'القوائم المالية', href: '/financial-statements/q2-2024', icon: 'FileText' },
    ],
  ),
  createMockItem(
    'item-8', 'إقفال شهري', 'إقفال شهر يونيو 2024', 'CLS-2024-06',
    'low', 'pending', 0, null, 1, 1440,
    ['شهري'],
    [
      { label: 'ميزان المراجعة', href: '/trial-balance/jun-2024', icon: 'BarChart3' },
    ],
  ),
  createMockItem(
    'item-9', 'إقفال شهري', 'إقفال شهر يوليو 2024', 'CLS-2024-07',
    'low', 'pending', 0, null, 2, 1440,
    ['شهري'],
    [],
  ),
  createMockItem(
    'item-10', 'إقفال شهري', 'إقفال شهر أغسطس 2024', 'CLS-2024-08',
    'low', 'pending', 0, null, 3, 1440,
    ['شهري'],
    [],
  ),
  createMockItem(
    'item-11', 'إقفال شهري', 'إقفال شهر سبتمبر 2024', 'CLS-2024-09',
    'low', 'pending', 0, null, 4, 1440,
    ['شهري', 'تدقيق'],
    [],
  ),
  createMockItem(
    'item-12', 'إقفال ربعي', 'إقفال الربع الثالث 2024', 'QCLS-2024-Q3',
    'high', 'pending', 0, null, 5, 2880,
    ['ربعي', 'نهائي'],
    [],
  ),
  createMockItem(
    'item-13', 'إقفال شهري', 'إقفال شهر أكتوبر 2024', 'CLS-2024-10',
    'medium', 'pending', 0, null, 0, 1440,
    ['شهري'],
    [],
  ),
  createMockItem(
    'item-14', 'إقفال شهري', 'إقفال شهر نوفمبر 2024', 'CLS-2024-11',
    'medium', 'pending', 0, null, 1, 1440,
    ['شهري', 'نهائي'],
    [],
  ),
  createMockItem(
    'item-15', 'إقفال سنوي', 'إقفال العام 2024', 'YCLS-2024',
    'critical', 'active', 4, 'review', 2, 4320,
    ['سنوي', 'تدقيق', 'نهائي'],
    [
      { label: 'دفتر الأستاذ', href: '/ledger/2024', icon: 'BookOpen' },
      { label: 'ميزان المراجعة', href: '/trial-balance/2024', icon: 'BarChart3' },
      { label: 'القوائم المالية', href: '/financial-statements/2024', icon: 'FileText' },
      { label: 'تقارير التدقيق', href: '/audit/2024', icon: 'Eye' },
    ],
    'الإقفال السنوي يتطلب مراجعة شاملة. يوصى بالحصول على موافقة مجلس الإدارة قبل الإقفال النهائي.',
  ),
]

function PriorityBadge({ priority }: { priority: 'critical' | 'high' | 'medium' | 'low' }) {
  const config = PRIORITY_CONFIG[priority]
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border', config.className)}>
      {priority === 'critical' || priority === 'high' ? (
        <AlertTriangle className="h-2.5 w-2.5" />
      ) : (
        <Circle className="h-2.5 w-2.5" />
      )}
      {config.label}
    </span>
  )
}

function StageBadge({ stageId }: { stageId: string }) {
  const config = STAGE_BADGE_CONFIG[stageId]
  if (!config) return null
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full border', config.className)}>
      {config.label}
    </span>
  )
}

function SLABadge({ slaMinutes, startedAt }: { slaMinutes: number; startedAt?: number }) {
  if (!startedAt) return null
  const sla = calculateSLADisplay(slaMinutes, startedAt)
  const colorMap = {
    ok: 'text-success bg-success/10 border-success/20',
    warning: 'text-warning bg-warning/10 border-warning/20',
    critical: 'text-orange-600 bg-orange-50 border-orange-200',
    breached: 'text-destructive bg-destructive/10 border-destructive/20',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full border', colorMap[sla.status])}>
      <Clock className="h-2.5 w-2.5" />
      {sla.remainingDisplay}
    </span>
  )
}

function StatusBadge({ status }: { status: ProcessStage['status'] }) {
  const config = STATUS_STYLES[status]
  const Icon = config.icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border', config.className)}>
      <Icon className={cn('h-2.5 w-2.5', status === 'active' && 'animate-spin')} />
      {config.label}
    </span>
  )
}

function calcMetrics(items: ProcessItem[]): ProcessFlowMetrics {
  return {
    totalItems: items.length,
    activeItems: items.filter((i) => i.status === 'active').length,
    completedItems: items.filter((i) => i.status === 'completed').length,
    overdueItems: items.filter((i) => i.stages.some((s) => {
      if (s.status !== 'active' || !s.startedAt || !s.slaMinutes) return false
      const elapsed = Date.now() - s.startedAt
      return elapsed > s.slaMinutes * 60000
    })).length,
    avgCompletionTime: 0,
    totalAmount: items.reduce((sum, i) => sum + (i.amount ?? 0), 0),
    pendingApprovals: items.reduce((sum, i) => sum + i.approvals.filter((a) => a.decision === 'pending').length, 0),
  }
}

export function FinancialCloseFlow() {
  const [items, setItems] = useState<ProcessItem[]>(MOCK_ITEMS)
  const [selectedId, setSelectedId] = useState<string>(MOCK_ITEMS[0]?.id ?? '')
  const [filterTab, setFilterTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('created')
  const [sortAsc, setSortAsc] = useState(false)
  const [detailTab, setDetailTab] = useState('pipeline')

  const metrics = useMemo(() => calcMetrics(items), [items])

  const filteredItems = useMemo(() => {
    let result = [...items]
    if (filterTab !== 'all') {
      result = result.filter((item) => {
        const activeStage = item.stages.find((s) => s.status === 'active')
        return activeStage?.id === filterTab
      })
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.refNumber.toLowerCase().includes(q) ||
          item.owner.name.toLowerCase().includes(q),
      )
    }
    result.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'created':
          cmp = a.createdAt - b.createdAt
          break
        case 'priority': {
          const order = { critical: 0, high: 1, medium: 2, low: 3 }
          cmp = order[a.priority] - order[b.priority]
          break
        }
        case 'status': {
          const sOrder = { active: 0, pending: 1, completed: 2, skipped: 3, failed: 4 }
          cmp = sOrder[a.status] - sOrder[b.status]
          break
        }
        case 'sla':
          cmp = a.slaMinutes - b.slaMinutes
          break
      }
      return sortAsc ? cmp : -cmp
    })
    return result
  }, [items, filterTab, searchQuery, sortBy, sortAsc])

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  )

  function handleStageTransition(stageId: string, newStatus: 'completed' | 'failed') {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== selectedId) return item
        const stages = item.stages.map((s) => {
          if (s.id !== stageId) return s
          return {
            ...s,
            status: newStatus,
            ...(newStatus === 'completed' ? { completedAt: Date.now() } : {}),
          }
        })
        const currentIdx = stages.findIndex((s) => s.id === stageId)
        let currentStage = item.currentStage
        let overallStatus: ProcessStage['status'] = item.status
        if (newStatus === 'completed') {
          const nextStage = stages.find((s, i) => i > currentIdx && s.status === 'pending')
          if (nextStage) {
            stages[stages.indexOf(nextStage)] = { ...nextStage, status: 'active', startedAt: Date.now() }
            currentStage = nextStage.id
          } else {
            currentStage = stages[stages.length - 1].id
            overallStatus = 'completed'
          }
        } else {
          overallStatus = 'failed'
        }
        const now = Date.now()
        const activity: ProcessActivity = {
          id: `act-manual-${Date.now().toString(36)}`,
          type: 'stage_change',
          action: newStatus === 'completed' ? `إكمال مرحلة ${stages.find((s) => s.id === stageId)?.name}` : `فشل في مرحلة ${stages.find((s) => s.id === stageId)?.name}`,
          actor: { id: 'user-current', name: 'المستخدم الحالي' },
          timestamp: now,
          details: newStatus === 'completed' ? 'تم إكمال المرحلة يدوياً' : 'تم تعليم المرحلة كفشل',
          stageId,
        }
        return {
          ...item,
          stages,
          currentStage,
          status: overallStatus,
          activities: [...item.activities, activity],
        }
      }),
    )
    setDetailTab('pipeline')
  }

  function handleApprove(approvalId: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== selectedId) return item
        return {
          ...item,
          approvals: item.approvals.map((a) =>
            a.id === approvalId ? { ...a, decision: 'approved', respondedAt: Date.now() } : a,
          ),
          activities: [
            ...item.activities,
            {
              id: `act-appr-${Date.now().toString(36)}`,
              type: 'approval',
              action: 'تمت الموافقة',
              actor: { id: 'user-current', name: 'المستخدم الحالي' },
              timestamp: Date.now(),
              details: 'تمت الموافقة على طلب الاعتماد',
              stageId: item.stages.find((s) => s.id === 'approve')?.id,
            },
          ],
        }
      }),
    )
  }

  function handleReject(approvalId: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== selectedId) return item
        return {
          ...item,
          approvals: item.approvals.map((a) =>
            a.id === approvalId ? { ...a, decision: 'rejected', respondedAt: Date.now() } : a,
          ),
          activities: [
            ...item.activities,
            {
              id: `act-rej-${Date.now().toString(36)}`,
              type: 'approval',
              action: 'تم الرفض',
              actor: { id: 'user-current', name: 'المستخدم الحالي' },
              timestamp: Date.now(),
              details: 'تم رفض طلب الاعتماد',
              stageId: item.stages.find((s) => s.id === 'approve')?.id,
            },
          ],
        }
      }),
    )
  }

  const activeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length }
    for (const tab of FILTER_TABS) {
      if (tab.id === 'all') continue
      counts[tab.id] = items.filter((item) => {
        const active = item.stages.find((s) => s.status === 'active')
        return active?.id === tab.id
      }).length
    }
    return counts
  }, [items])

  const aiRecommendations = useMemo(() => {
    const recs: string[] = []
    const activeItems = items.filter((i) => i.status === 'active')
    if (activeItems.length > 2) {
      recs.push(`يوجد ${activeItems.length} عمليات إقفال نشطة. يوصى بتسريع الإجراءات لتجنب التأخير.`)
    }
    const overdue = items.filter((i) => i.stages.some((s) => {
      if (s.status !== 'active' || !s.startedAt || !s.slaMinutes) return false
      return (Date.now() - s.startedAt) > s.slaMinutes * 60000 * 0.85
    }))
    if (overdue.length > 0) {
      const names = overdue.map((i) => i.title).join('، ')
      recs.push(`عملية الإقفال في "${names}" تقترب من تجاوز SLA. يوصى بالتدخل الفوري.`)
    }
    const pendingApprovals = items.reduce((s, i) => s + i.approvals.filter((a) => a.decision === 'pending').length, 0)
    if (pendingApprovals > 0) {
      recs.push(`هناك ${pendingApprovals} موافقة معلقة. يرجى متابعة الموافقات لتجنب تأخير الإقفال.`)
    }
    if (recs.length === 0) {
      recs.push('جميع عمليات الإقفال تسير وفق الخطة المحددة. لا توجد توصيات حالية.')
    }
    return recs
  }, [items])

  const moduleIcon = (iconName: string) => {
    const Icon = MODULE_ICON_MAP[iconName] ?? FileText
    return <Icon className="h-3.5 w-3.5" />
  }

  return (
    <div className="flex flex-col gap-6 p-6" dir="rtl">
      <EnterpriseBreadcrumbs
        items={[
          { label: 'المالية', href: '/finance' },
          { label: 'الإغلاق المالي' },
        ]}
      />

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">دورة الإغلاق المالي</h1>
        <p className="text-sm text-muted-foreground">
          إدارة ومتابعة عمليات الإقفال المالي الشهري والربعي والسنوي
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground">الفترة الحالية</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums">مايو 2024</div>
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>متبقي {18} يوم للإقفال</span>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground">حسابات تمت تسويتها</span>
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums">١٢٤</div>
          <div className="flex items-center gap-1 mt-1 text-xs text-success">
            <TrendingUp className="h-3 w-3" />
            <span>+٨ عن الشهر الماضي</span>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground">قيود التسوية</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <FileText className="h-4 w-4 text-amber-600" />
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums">٣٧</div>
          <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            <span>٥ قيود بحاجة للمراجعة</span>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground">أيام متبقية للإقفال</span>
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-destructive" />
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums text-destructive">١٢</div>
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <TrendingDown className="h-3 w-3" />
            <span>الموعد النهائي: ٣١ مايو ٢٠٢٤</span>
          </div>
        </div>
      </div>

      {/* Main Layout: Sidebar + Detail */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-[420px] shrink-0 flex flex-col gap-4">
          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-1 p-1 rounded-xl border bg-card">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setFilterTab(tab.id); setSelectedId('') }}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                  filterTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                {tab.label}
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] rounded-full',
                  filterTab === tab.id
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}>
                  {activeCounts[tab.id] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Search + Sort */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث عن دورة إقفال..."
                className="w-full h-9 pr-9 pl-3 text-xs rounded-lg border border-input bg-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-9 px-3 text-xs rounded-lg border border-input bg-background appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <ArrowUpDown className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setSortAsc(!sortAsc)}
              title={sortAsc ? 'ترتيب تصاعدي' : 'ترتيب تنازلي'}
            >
              <ArrowUpDown className={cn('h-4 w-4 transition-transform', sortAsc && 'rotate-180')} />
            </Button>
          </div>

          {/* Item List */}
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-500px)] min-h-[400px]">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                  <Filter className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1">لا توجد نتائج</p>
                <p className="text-xs text-muted-foreground/70">
                  لم يتم العثور على دورات إقفال تطابق معايير البحث
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => { setFilterTab('all'); setSearchQuery('') }}
                >
                  <RefreshCw className="h-3.5 w-3.5 ml-1.5" />
                  إعادة تعيين
                </Button>
              </div>
            ) : (
              filteredItems.map((item) => {
                const activeStage = item.stages.find((s) => s.status === 'active')
                const activeStageName = activeStage
                  ? STAGE_TEMPLATES.find((t) => t.id === activeStage.id)?.name
                  : null
                const hasPendingApprovals = item.approvals.some((a) => a.decision === 'pending')
                return (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedId(item.id); setDetailTab('pipeline') }}
                    className={cn(
                      'w-full text-right rounded-xl border p-4 transition-all hover:shadow-sm',
                      selectedId === item.id
                        ? 'border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20'
                        : 'bg-card hover:bg-accent/50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground font-mono shrink-0">
                          {item.refNumber}
                        </span>
                        {hasPendingApprovals && (
                          <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium rounded-full bg-warning/10 text-warning border border-warning/20">
                            <Clock className="h-2 w-2" />
                            موافقة
                          </span>
                        )}
                      </div>
                      <PriorityBadge priority={item.priority} />
                    </div>

                    <h3 className="text-sm font-medium mb-2 line-clamp-1">{item.title}</h3>

                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status={item.status} />
                      {activeStage && (
                        <SLABadge slaMinutes={activeStage.slaMinutes ?? 0} startedAt={activeStage.startedAt} />
                      )}
                    </div>

                    {activeStageName && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        <span>المرحلة الحالية: </span>
                        <span className="font-medium text-foreground">{activeStageName}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-2 pt-2 border-t text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{item.owner.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(item.createdAt).toLocaleDateString('ar-SA')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        <span>{item.type}</span>
                      </div>
                    </div>

                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex px-1.5 py-0.5 text-[9px] font-medium rounded-full bg-muted text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="flex-1 min-w-0">
          {selectedItem ? (
            <div className="flex flex-col gap-4">
              {/* Detail Header */}
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-bold">{selectedItem.title}</h2>
                      <PriorityBadge priority={selectedItem.priority} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{selectedItem.refNumber}</span>
                      <span>•</span>
                      <span>{selectedItem.type}</span>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{selectedItem.owner.name}</span>
                      </div>
                      <span>•</span>
                      <StatusBadge status={selectedItem.status} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {selectedItem.linkedModules.map((mod) => (
                      <a
                        key={mod.href}
                        href={mod.href}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border bg-background hover:bg-accent transition-colors"
                      >
                        {moduleIcon(mod.icon)}
                        <span>{mod.label}</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-xl border bg-card">
                {DETAIL_TABS.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setDetailTab(tab.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all',
                        detailTab === tab.id
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                      {tab.id === 'approvals' && selectedItem.approvals.filter((a) => a.decision === 'pending').length > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] rounded-full bg-warning/20 text-warning">
                          {selectedItem.approvals.filter((a) => a.decision === 'pending').length}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Tab Content */}
              <div className="min-h-[400px]">
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
                  <div className="rounded-xl border bg-card p-6">
                    <h3 className="text-sm font-medium text-muted-foreground mb-4">الموافقات</h3>
                    {selectedItem.approvals.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        لا توجد موافقات مطلوبة
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {selectedItem.approvals.map((approval) => (
                          <ProcessApprovalCard
                            key={approval.id}
                            approval={approval}
                            onApprove={approval.decision === 'pending' ? handleApprove : undefined}
                            onReject={approval.decision === 'pending' ? handleReject : undefined}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {detailTab === 'info' && (
                  <div className="rounded-xl border bg-card p-6">
                    <h3 className="text-sm font-medium text-muted-foreground mb-4">معلومات الإقفال</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <span className="text-[11px] text-muted-foreground">رقم المرجع</span>
                          <p className="text-sm font-medium font-mono">{selectedItem.refNumber}</p>
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground">النوع</span>
                          <p className="text-sm font-medium">{selectedItem.type}</p>
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground">المالك</span>
                          <p className="text-sm font-medium">{selectedItem.owner.name}</p>
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground">تاريخ الإنشاء</span>
                          <p className="text-sm font-medium">{new Date(selectedItem.createdAt).toLocaleString('ar-SA')}</p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <span className="text-[11px] text-muted-foreground">SLA الإجمالي</span>
                          <p className="text-sm font-medium">{selectedItem.slaMinutes} دقيقة</p>
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground">إجمالي المراحل</span>
                          <p className="text-sm font-medium">{selectedItem.stages.length} مراحل</p>
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground">النشاطات</span>
                          <p className="text-sm font-medium">{selectedItem.activities.length} نشاط</p>
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground">الموافقات</span>
                          <p className="text-sm font-medium">
                            {selectedItem.approvals.filter((a) => a.decision === 'approved').length} معتمدة
                            {' / '}
                            {selectedItem.approvals.filter((a) => a.decision === 'pending').length} معلقة
                          </p>
                        </div>
                      </div>
                    </div>

                    {selectedItem.tags.length > 0 && (
                      <div className="mt-6 pt-6 border-t">
                        <span className="text-[11px] text-muted-foreground block mb-2">الوسوم</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedItem.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex px-2 py-1 text-[11px] font-medium rounded-full bg-muted text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedItem.linkedModules.length > 0 && (
                      <div className="mt-6 pt-6 border-t">
                        <span className="text-[11px] text-muted-foreground block mb-2">الوحدات المرتبطة</span>
                        <div className="flex flex-wrap gap-2">
                          {selectedItem.linkedModules.map((mod) => (
                            <a
                              key={mod.href}
                              href={mod.href}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border bg-background hover:bg-accent transition-colors"
                            >
                              {moduleIcon(mod.icon)}
                              <span>{mod.label}</span>
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* AI Recommendation */}
              {selectedItem.aiRecommendation && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-primary">توصية ذكية</span>
                        <span className="text-[10px] text-muted-foreground">AI • نظام الإقفال الذكي</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{selectedItem.aiRecommendation}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cross-module Links */}
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">الوحدات ذات الصلة</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {CROSS_LINKS.map((link) => {
                    const Icon = link.icon
                    return (
                      <a
                        key={link.href}
                        href={link.href}
                        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border bg-background hover:bg-accent hover:border-primary/30 transition-all"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span>{link.label}</span>
                        <ChevronLeft className="h-3 w-3 text-muted-foreground" />
                      </a>
                    )
                  })}
                </div>
              </div>

              {/* AI Recommendations Panel */}
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-medium text-muted-foreground">توصيات النظام</span>
                </div>
                <div className="space-y-2">
                  {aiRecommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1.5 shrink-0" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl border bg-card">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base font-medium text-muted-foreground mb-1">اختر دورة إقفال</h3>
              <p className="text-sm text-muted-foreground/70 max-w-sm">
                يرجى اختيار إحدى دورات الإقفال من القائمة الجانبية لعرض التفاصيل
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
