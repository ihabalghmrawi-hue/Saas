'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Wallet, Users, FileText, CheckCircle2, AlertTriangle,
  Clock, User, Search, ArrowUpDown, Filter, TrendingUp, TrendingDown,
  Banknote, Building2, Sparkles, Eye, Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { ProcessPipeline } from './ProcessPipeline'
import { ProcessTimeline } from './ProcessTimeline'
import { ProcessApprovalCard } from './ProcessApprovalCard'
import { calculateSLADisplay } from '@/lib/workflow/engine'
import type { ProcessItem, ProcessStage, ProcessApproval, ProcessActivity, ProcessFlowMetrics } from '@/lib/process/types'

const STAGE_TEMPLATES = [
  { id: 'time_capture', name: 'تسجيل الوقت', order: 0, slaMinutes: 120, assigneeRole: 'موظف' },
  { id: 'validation', name: 'التحقق من البيانات', order: 1, slaMinutes: 240, assigneeRole: 'مشرف' },
  { id: 'calculation', name: 'احتساب الراتب', order: 2, slaMinutes: 180, assigneeRole: 'رواتب' },
  { id: 'approval', name: 'اعتماد كشوف الرواتب', order: 3, slaMinutes: 360, assigneeRole: 'مدير الموارد البشرية' },
  { id: 'bank_file', name: 'إعداد ملف البنك', order: 4, slaMinutes: 120, assigneeRole: 'الخزينة' },
  { id: 'payment', name: 'تحويل الرواتب', order: 5, slaMinutes: 60, assigneeRole: 'البنك' },
]

const ITEM_TITLES = [
  'كشف رواتب الموظفين - شهر كامل',
  'مكافآت الأداء الربعية',
  'بدلات ومزايا الموظفين',
  'رواتب الموظفين الجدد',
  'تسوية نهاية الخدمة',
  'رواتب العقود المؤقتة',
  'تعويضات الإجازة السنوية',
  'مستحقات overtime',
]

const TAGS = ['شهري', 'ربعي', 'سنوي', 'استثنائي', 'مستعجل']

const ARABIC_NAMES = [
  { id: 'usr-1', name: 'أحمد محمد' },
  { id: 'usr-2', name: 'سارة خالد' },
  { id: 'usr-3', name: 'محمد علي' },
  { id: 'usr-4', name: 'نورة أحمد' },
  { id: 'usr-5', name: 'خالد عمر' },
  { id: 'usr-6', name: 'فاطمة الزهراء' },
  { id: 'usr-7', name: 'عمر حسن' },
  { id: 'usr-8', name: 'ليلى عبدالله' },
  { id: 'usr-9', name: 'مريم أحمد' },
  { id: 'usr-10', name: 'سعيد القحطاني' },
]

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'حرجة',
  high: 'عالية',
  medium: 'متوسطة',
  low: 'منخفضة',
}

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-orange-50 text-orange-600 border-orange-200',
  medium: 'bg-warning/10 text-warning border-warning/20',
  low: 'bg-muted text-muted-foreground border-muted',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'معلق',
  active: 'قيد التنفيذ',
  completed: 'مكتمل',
  skipped: 'تم التجاهل',
  failed: 'فشل',
}

const FILTER_STAGES = [
  { id: null, label: 'الكل' },
  { id: 'time_capture', label: 'تسجيل' },
  { id: 'validation', label: 'تحقق' },
  { id: 'calculation', label: 'احتساب' },
  { id: 'approval', label: 'اعتماد' },
  { id: 'payment', label: 'دفع' },
]

const DETAIL_TABS = [
  { id: 'pipeline', label: 'مراحل سير العمل' },
  { id: 'timeline', label: 'النشاطات' },
  { id: 'approvals', label: 'الموافقات' },
  { id: 'info', label: 'المعلومات' },
]

const AMOUNTS = [
  850000, 320000, 125000, 1950000, 560000,
  74000, 980000, 150000, 420000, 2100000,
  675000, 180000, 950000, 110000, 1480000,
  290000, 830000, 460000, 2000000, 525000,
]

const SHARED_LINKED_MODULES: ProcessItem['linkedModules'] = [
  { label: 'إدارة الموظفين', href: '/dashboard/hr/employees', icon: 'Users' },
  { label: 'قيود الرواتب', href: '/dashboard/financial/journal?filter=payroll', icon: 'FileText' },
  { label: 'التقرير التأميني', href: '/dashboard/insurance/report', icon: 'FileText' },
]

const AI_RECOMMENDATIONS = [
  'يُنصح بمراجعة بدلات الموظفين الجدد قبل اعتماد كشف الرواتب',
  'لوحظ ارتفاع في مستحقات overtime هذا الشهر، يُفضل التدقيق',
  'توجد زيادة بنسبة 8% في إجمالي الرواتب مقارنة بالشهر الماضي',
  'يوصى بتسريع إجراءات اعتماد كشوف الرواتب لتجنب تأخير صرف المرتبات',
  'تم اكتشاف تباين في بدلات الموظفين بالفترة السابقة، يُرجى المراجعة',
  'الموافقة على مكافآت الأداء معلقة منذ 3 أيام - يُنصح بالبت today',
  'متوسط وقت إعداد ملف البنك أعلى من الحد المقرر، يُوصى بالتحسين',
  'عدد المستفيدين من تسوية نهاية الخدمة أقل من المتوقع',
]

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={cn('px-1.5 py-0.5 text-[10px] rounded-full border font-medium', PRIORITY_STYLES[priority])}>
      {PRIORITY_LABELS[priority]}
    </span>
  )
}

function StageBadge({ stageId }: { stageId: string }) {
  const template = STAGE_TEMPLATES.find(s => s.id === stageId)
  const stageColors: Record<string, string> = {
    time_capture: 'bg-blue-50 text-blue-700',
    validation: 'bg-purple-50 text-purple-700',
    calculation: 'bg-amber-50 text-amber-700',
    approval: 'bg-emerald-50 text-emerald-700',
    bank_file: 'bg-cyan-50 text-cyan-700',
    payment: 'bg-indigo-50 text-indigo-700',
  }
  return (
    <span className={cn('px-2 py-0.5 text-[10px] rounded-full font-medium', stageColors[stageId] || 'bg-muted text-muted-foreground')}>
      {template?.name || stageId}
    </span>
  )
}

function SLABadge({ slaMinutes, createdAt }: { slaMinutes: number; createdAt: number }) {
  const sla = calculateSLADisplay(slaMinutes, createdAt)
  const colors: Record<string, string> = {
    ok: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    critical: 'bg-orange-50 text-orange-600',
    breached: 'bg-destructive/10 text-destructive',
  }
  return (
    <span className={cn('flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full font-medium', colors[sla.status])}>
      <Clock className="h-3 w-3" />
      {sla.remainingDisplay}
    </span>
  )
}

function generateActivities(itemId: string, activeStageIdx: number, ownerIdx: number): ProcessActivity[] {
  const activities: ProcessActivity[] = []
  let idCounter = 0
  const now = Date.now()

  for (let i = 0; i <= activeStageIdx; i++) {
    const stage = STAGE_TEMPLATES[i]
    const timestamp = now - (activeStageIdx - i + 1) * 3600000
    const actor = ARABIC_NAMES[(ownerIdx + i) % ARABIC_NAMES.length]

    activities.push({
      id: `${itemId}-act-${idCounter++}`,
      type: 'stage_change',
      action: i === activeStageIdx ? 'بدأ المرحلة' : 'أكمل المرحلة',
      actor,
      timestamp,
      details: i === activeStageIdx
        ? `بدأ مرحلة "${stage.name}"`
        : `أكمل مرحلة "${stage.name}" بنجاح`,
      stageId: stage.id,
    })

    if (i === 2 || i === 3) {
      activities.push({
        id: `${itemId}-act-${idCounter++}`,
        type: 'comment',
        action: 'أضاف ملاحظة',
        actor: ARABIC_NAMES[(ownerIdx + i + 1) % ARABIC_NAMES.length],
        timestamp: timestamp + 1800000,
        details: i === 2
          ? 'تم التدقيق على جميع البيانات والتأكد من صحتها'
          : 'بإنتظار اعتماد مدير الموارد البشرية',
        stageId: stage.id,
      })
    }

    if (i === 0) {
      activities.push({
        id: `${itemId}-act-${idCounter++}`,
        type: 'attachment',
        action: 'أرفق مستند',
        actor: ARABIC_NAMES[ownerIdx],
        timestamp: timestamp + 900000,
        details: 'تم إرفاق جداول أوقات الدوام الشهرية',
        stageId: stage.id,
      })
    }

    if (i === 1) {
      activities.push({
        id: `${itemId}-act-${idCounter++}`,
        type: 'system',
        action: 'تحديث النظام',
        actor: { id: 'system', name: 'النظام' },
        timestamp: timestamp + 600000,
        details: 'تمت مطابقة ساعات الحضور مع ساعات الدوام الرسمي',
        stageId: stage.id,
      })
    }
  }

  if (activeStageIdx >= 2) {
    activities.push({
      id: `${itemId}-act-${idCounter++}`,
      type: 'approval',
      action: 'اعتماد',
      actor: ARABIC_NAMES[(ownerIdx + 3) % ARABIC_NAMES.length],
      timestamp: now - 7200000,
      details: 'تم اعتماد احتساب الراتب',
      stageId: 'calculation',
    })
  }

  return activities.sort((a, b) => b.timestamp - a.timestamp)
}

function generateApprovals(itemId: string, activeStageIdx: number, ownerIdx: number): ProcessApproval[] {
  const approvals: ProcessApproval[] = []
  const now = Date.now()
  const stage3 = STAGE_TEMPLATES[3]

  if (activeStageIdx >= 3) {
    approvals.push({
      id: `${itemId}-apr-1`,
      stageId: stage3.id,
      title: 'اعتماد كشف الرواتب الشامل',
      requestedBy: ARABIC_NAMES[(ownerIdx + 2) % ARABIC_NAMES.length],
      assignedTo: ARABIC_NAMES[(ownerIdx + 3) % ARABIC_NAMES.length],
      decision: activeStageIdx > 3 ? 'approved' : 'pending',
      comments: activeStageIdx > 3 ? 'تمت الموافقة بعد المراجعة' : undefined,
      createdAt: now - 7200000,
      respondedAt: activeStageIdx > 3 ? now - 3600000 : undefined,
    })
  }

  if (activeStageIdx >= 4) {
    approvals.push({
      id: `${itemId}-apr-2`,
      stageId: 'bank_file',
      title: 'اعتماد ملف تحويل الرواتب البنكي',
      requestedBy: ARABIC_NAMES[(ownerIdx + 4) % ARABIC_NAMES.length],
      assignedTo: ARABIC_NAMES[(ownerIdx + 3) % ARABIC_NAMES.length],
      decision: activeStageIdx > 4 ? 'approved' : 'pending',
      comments: activeStageIdx > 4 ? 'ملف البنك معتمد وجاهز للتحويل' : undefined,
      createdAt: now - 3600000,
      respondedAt: activeStageIdx > 4 ? now - 600000 : undefined,
    })
  }

  return approvals
}

const PRIORITIES: Array<ProcessItem['priority']> = ['critical', 'high', 'medium', 'low']

function generateMockItems(): ProcessItem[] {
  const items: ProcessItem[] = []

  for (let i = 0; i < 20; i++) {
    const typeIdx = i % 3
    const type = typeIdx === 0 ? 'كشف راتب' : typeIdx === 1 ? 'دورية' : 'مكافأة'
    const title = ITEM_TITLES[i % ITEM_TITLES.length]
    const refNumber = type === 'كشف راتب'
      ? `PR-${String(i + 1).padStart(4, '0')}`
      : type === 'دورية'
        ? `PRD-${String(i + 1).padStart(4, '0')}`
        : `BNS-${String(i + 1).padStart(4, '0')}`
    const priority = PRIORITIES[i % 4]
    const activeStageIdx = i < 3 ? 5 : i < 6 ? 4 : i < 9 ? 3 : i < 12 ? 2 : i < 15 ? 1 : i < 18 ? 0 : 5
    const ownerIdx = i % ARABIC_NAMES.length
    const amount = AMOUNTS[i]
    const createdAt = Date.now() - (20 - i) * 7200000
    const slaMinutes = [120, 180, 240, 360, 480][i % 5]

    const stages: ProcessStage[] = STAGE_TEMPLATES.map((tmpl, j) => {
      const status: ProcessStage['status'] =
        j < activeStageIdx ? 'completed' :
        j === activeStageIdx ? 'active' :
        'pending'
      const stage: ProcessStage = {
        id: tmpl.id,
        name: tmpl.name,
        order: tmpl.order,
        status,
        assignee: ARABIC_NAMES[(ownerIdx + j) % ARABIC_NAMES.length],
        slaMinutes: tmpl.slaMinutes,
      }
      if (j <= activeStageIdx) {
        stage.startedAt = createdAt + j * 3600000 + (j > 0 ? (j - 1) * 1800000 : 0)
      }
      if (j < activeStageIdx) {
        stage.completedAt = createdAt + j * 3600000 + 1800000 + (j > 1 ? (j - 1) * 1800000 : 0)
      }
      return stage
    })

    const currentStage = STAGE_TEMPLATES[Math.min(activeStageIdx, STAGE_TEMPLATES.length - 1)].id
    const activities = generateActivities(`item-${i}`, activeStageIdx, ownerIdx)
    const approvals = generateApprovals(`item-${i}`, activeStageIdx, ownerIdx)

    const tagSet = new Set<string>([TAGS[i % TAGS.length], TAGS[(i + 2) % TAGS.length]])

    const item: ProcessItem = {
      id: `payroll-${i}`,
      type,
      title,
      refNumber,
      priority,
      status: activeStageIdx >= 5 ? 'completed' : 'active',
      stages,
      currentStage,
      approvals,
      activities,
      owner: ARABIC_NAMES[ownerIdx],
      amount,
      currency: 'SAR',
      createdAt,
      slaMinutes,
      tags: Array.from(tagSet),
      linkedModules: SHARED_LINKED_MODULES,
      aiRecommendation: i % 3 === 0 ? AI_RECOMMENDATIONS[i % AI_RECOMMENDATIONS.length] : undefined,
    }

    items.push(item)
  }

  return items
}

function getItemStatus(item: ProcessItem): string {
  if (item.status === 'completed') return 'مكتمل'
  const activeStage = item.stages.find(s => s.status === 'active')
  if (!activeStage) return 'معلق'
  const overdue = item.stages.some(s =>
    s.status === 'active' && s.slaMinutes && s.startedAt &&
    calculateSLADisplay(s.slaMinutes, s.startedAt).status === 'breached'
  )
  if (overdue) return 'متأخر'
  return 'قيد التنفيذ'
}

function getItemStatusStyle(status: string): string {
  switch (status) {
    case 'مكتمل': return 'bg-success/10 text-success'
    case 'متأخر': return 'bg-destructive/10 text-destructive'
    case 'قيد التنفيذ': return 'bg-primary/10 text-primary'
    default: return 'bg-muted text-muted-foreground'
  }
}

export function PayrollProcessingFlow() {
  const items = useMemo(() => generateMockItems(), [])

  const [stageFilter, setStageFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'priority' | 'sla' | 'date'>('date')
  const [selectedItem, setSelectedItem] = useState<ProcessItem>(items[0])
  const [detailTab, setDetailTab] = useState('pipeline')

  const metrics = useMemo((): ProcessFlowMetrics => {
    const totalAmount = items.reduce((s, i) => s + (i.amount || 0), 0)
    const pendingApprovals = items.reduce((s, i) => s + i.approvals.filter(a => a.decision === 'pending').length, 0)
    const activeItems = items.filter(i => i.status !== 'completed').length
    const completedItems = items.filter(i => i.status === 'completed').length
    const overdueItems = items.filter(i =>
      i.stages.some(s =>
        s.status === 'active' && s.slaMinutes && s.startedAt &&
        calculateSLADisplay(s.slaMinutes, s.startedAt).status === 'breached'
      )
    ).length
    return {
      totalItems: items.length,
      activeItems,
      completedItems,
      overdueItems,
      avgCompletionTime: 0,
      totalAmount,
      pendingApprovals,
    }
  }, [items])

  const filteredItems = useMemo(() => {
    let result = [...items]

    if (stageFilter) {
      result = result.filter(item => {
        const stage = item.stages.find(s => s.id === stageFilter)
        return stage && (stage.status === 'active' || stage.status === 'completed')
      })
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.refNumber.toLowerCase().includes(q) ||
        item.owner.name.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q)
      )
    }

    result.sort((a, b) => {
      if (sortBy === 'priority') {
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
        return (order[a.priority] ?? 99) - (order[b.priority] ?? 99)
      }
      if (sortBy === 'sla') {
        const aSla = calculateSLADisplay(a.slaMinutes, a.createdAt)
        const bSla = calculateSLADisplay(b.slaMinutes, b.createdAt)
        const severity: Record<string, number> = { breached: 0, critical: 1, warning: 2, ok: 3 }
        return (severity[aSla.status] ?? 99) - (severity[bSla.status] ?? 99)
      }
      return b.createdAt - a.createdAt
    })

    return result
  }, [items, stageFilter, searchQuery, sortBy])

  function handleStageTransition(stageId: string, newStatus: 'completed' | 'failed') {
    setSelectedItem(prev => {
      const updatedStages = prev.stages.map(s => {
        if (s.id === stageId) {
          return {
            ...s,
            status: newStatus,
            completedAt: Date.now(),
          }
        }
        if (newStatus === 'completed') {
          const currentIdx = prev.stages.findIndex(st => st.id === stageId)
          const nextStage = prev.stages[currentIdx + 1]
          if (nextStage && s.id === nextStage.id) {
            return {
              ...s,
              status: 'active' as ProcessStage['status'],
              startedAt: Date.now(),
            }
          }
        }
        return s
      })

      const nextCurrent = (() => {
        if (newStatus === 'failed') return stageId
        const currentIdx = prev.stages.findIndex(s => s.id === stageId)
        const next = prev.stages[currentIdx + 1]
        return next ? next.id : stageId
      })()

      const allCompleted = updatedStages.every(s => s.status === 'completed' || s.status === 'skipped')

      const updatedActivities: ProcessActivity[] = [
        {
          id: `act-${Date.now()}`,
          type: 'stage_change',
          action: newStatus === 'completed' ? 'أكمل المرحلة' : 'فشلت المرحلة',
          actor: { id: 'current-user', name: 'المستخدم' },
          timestamp: Date.now(),
          details: newStatus === 'completed'
            ? `تم إكمال مرحلة "${STAGE_TEMPLATES.find(t => t.id === stageId)?.name}"`
            : `فشلت مرحلة "${STAGE_TEMPLATES.find(t => t.id === stageId)?.name}"`,
          stageId,
        },
        ...prev.activities,
      ]

      return {
        ...prev,
        stages: updatedStages,
        currentStage: nextCurrent,
        status: allCompleted ? 'completed' : 'active',
        activities: updatedActivities,
      }
    })
  }

  function handleApprove(id: string) {
    setSelectedItem(prev => ({
      ...prev,
      approvals: prev.approvals.map(a =>
        a.id === id ? { ...a, decision: 'approved' as const, respondedAt: Date.now() } : a
      ),
    }))
  }

  function handleReject(id: string) {
    setSelectedItem(prev => ({
      ...prev,
      approvals: prev.approvals.map(a =>
        a.id === id ? { ...a, decision: 'rejected' as const, respondedAt: Date.now(), comments: 'مرفوض - يرجى المراجعة' } : a
      ),
    }))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-card flex-shrink-0">
        <EnterpriseBreadcrumbs items={[
          { label: 'الموارد البشرية', icon: Users },
          { label: 'معالجة الرواتب' },
        ]} />
        <div className="flex items-center justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold">دورة معالجة الرواتب</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              إدارة واعتماد ومتابعة دورة صرف رواتب الموظفين
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {metrics.activeItems} قيد المعالجة
            </span>
            {metrics.overdueItems > 0 && (
              <span className="text-sm font-medium text-destructive">
                {metrics.overdueItems} متأخرة
              </span>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Banknote className="h-4 w-4" />
              إجمالي الرواتب
            </div>
            <div className="text-xl font-bold">
              {metrics.totalAmount.toLocaleString('ar-SA')}
              <span className="text-sm font-normal text-muted-foreground mr-1">ر.س</span>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              عدد الموظفين
            </div>
            <div className="text-xl font-bold">{
              new Intl.NumberFormat('ar-SA').format(items.length * 15 + 23)
            }</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              شهر المعالجة الحالي
            </div>
            <div className="text-xl font-bold">
              {new Date().toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4 bg-warning/5 border-warning/20">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <FileText className="h-4 w-4" />
              بانتظار الاعتماد
            </div>
            <div className="text-xl font-bold text-warning">{metrics.pendingApprovals}</div>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-[420px] border-l overflow-y-auto bg-muted/10 flex-shrink-0">
          {/* Stage filter */}
          <div className="flex flex-wrap gap-1 p-3 border-b bg-card">
            {FILTER_STAGES.map(fs => (
              <button
                key={fs.id ?? 'all'}
                onClick={() => setStageFilter(fs.id)}
                className={cn(
                  'px-2.5 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap',
                  stageFilter === fs.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                )}
              >
                {fs.label}
              </button>
            ))}
          </div>

          {/* Search and sort */}
          <div className="flex items-center gap-2 p-3 border-b bg-card">
            <div className="relative flex-1">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث برقم المرجع أو العنوان..."
                className="w-full h-9 pr-8 bg-background border rounded-lg text-xs outline-none px-3"
              />
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="h-9 px-2 text-xs bg-background border rounded-lg outline-none"
            >
              <option value="date">حسب التاريخ</option>
              <option value="priority">حسب الأولوية</option>
              <option value="sla">حسب SLA</option>
            </select>
          </div>

          {/* Item list */}
          <div className="divide-y">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FileText className="h-12 w-12 mb-3 opacity-30" />
                <p className="font-medium">لا توجد نتائج</p>
                <p className="text-sm">حاول تغيير معايير البحث</p>
              </div>
            ) : (
              filteredItems.map(item => {
                const sla = calculateSLADisplay(item.slaMinutes, item.createdAt)
                const isSelected = selectedItem.id === item.id
                const itemStatus = getItemStatus(item)
                const activeStage = item.stages.find(s => s.status === 'active')

                return (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedItem(item); setDetailTab('pipeline') }}
                    className={cn(
                      'w-full text-right px-4 py-3 border-b hover:bg-accent/50 transition-colors',
                      isSelected && 'bg-accent/30 border-r-2 border-r-primary',
                      item.status === 'completed' && 'opacity-70',
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn('px-1.5 py-0.5 text-[10px] rounded-full font-medium', getItemStatusStyle(itemStatus))}>
                        {itemStatus}
                      </span>
                      <PriorityBadge priority={item.priority} />
                    </div>
                    <div className="font-medium text-sm leading-snug mt-1">{item.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] font-mono text-muted-foreground">{item.refNumber}</span>
                      <span className="text-[11px] text-muted-foreground">-</span>
                      <span className="text-[11px] text-muted-foreground">{item.type}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <User className="h-3 w-3" />
                        {item.owner.name}
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="text-muted-foreground font-mono">
                          {item.amount?.toLocaleString('ar-SA')} ر.س
                        </span>
                        <SLABadge slaMinutes={item.slaMinutes} createdAt={item.createdAt} />
                      </div>
                    </div>
                    {activeStage && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <StageBadge stageId={activeStage.id} />
                      </div>
                    )}
                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.tags.map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 text-[10px] rounded-full bg-muted text-muted-foreground">
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

        {/* Detail panel */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Item header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground font-mono">{selectedItem.refNumber}</span>
                  <PriorityBadge priority={selectedItem.priority} />
                  <SLABadge slaMinutes={selectedItem.slaMinutes} createdAt={selectedItem.createdAt} />
                </div>
                <h2 className="text-xl font-semibold">{selectedItem.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedItem.type} · {selectedItem.owner.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 ml-1" /> معاينة
                </Button>
                <Button size="sm">
                  <FileText className="h-4 w-4 ml-1" /> طباعة
                </Button>
              </div>
            </div>

            {/* Amount display */}
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">قيمة كشف الرواتب</div>
                  <div className="text-3xl font-bold">
                    {selectedItem.amount?.toLocaleString('ar-SA')}
                    <span className="text-base font-normal text-muted-foreground mr-1">ر.س</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">عدد الموظفين</div>
                    <div className="text-lg font-semibold">{Math.floor((selectedItem.amount || 0) / 5500)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">متوسط الراتب</div>
                    <div className="text-lg font-semibold">
                      {((selectedItem.amount || 0) / Math.max(1, Math.floor((selectedItem.amount || 0) / 5500))).toLocaleString('ar-SA', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Detail tabs */}
            <div className="flex gap-1 border-b pb-2">
              {DETAIL_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDetailTab(tab.id)}
                  className={cn(
                    'px-4 py-2 text-sm rounded-lg transition-colors',
                    detailTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
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
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">الموافقات</h3>
                {selectedItem.approvals.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    لا توجد موافقات حتى الآن
                  </p>
                ) : (
                  selectedItem.approvals.map(approval => (
                    <ProcessApprovalCard
                      key={approval.id}
                      approval={approval}
                      onApprove={approval.decision === 'pending' ? handleApprove : undefined}
                      onReject={approval.decision === 'pending' ? handleReject : undefined}
                    />
                  ))
                )}
              </div>
            )}

            {detailTab === 'info' && (
              <div className="space-y-4">
                {/* Basic info */}
                <div className="rounded-xl border bg-card p-5">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    معلومات أساسية
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">النوع</span>
                      <p className="font-medium">{selectedItem.type}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">رقم المرجع</span>
                      <p className="font-medium font-mono">{selectedItem.refNumber}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">المالك</span>
                      <p className="font-medium">{selectedItem.owner.name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">تاريخ الإنشاء</span>
                      <p className="font-medium">{new Date(selectedItem.createdAt).toLocaleString('ar-SA')}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">إجمالي SLA</span>
                      <p className="font-medium">{selectedItem.slaMinutes} دقيقة</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">الحالة</span>
                      <p className="font-medium">{getItemStatus(selectedItem)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">الوسوم</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedItem.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 text-[11px] rounded-full bg-muted text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">المرحلة الحالية</span>
                      <div className="mt-1">
                        <StageBadge stageId={selectedItem.currentStage} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cross-module links */}
                <div className="rounded-xl border bg-card p-5">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    وحدات مرتبطة
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {selectedItem.linkedModules.map((mod, idx) => {
                      const icons: Record<string, React.ReactNode> = {
                        Users: <Users className="h-4 w-4" />,
                        FileText: <FileText className="h-4 w-4" />,
                      }
                      return (
                        <button
                          key={idx}
                          className="flex items-center gap-2 p-3 rounded-lg border hover:bg-accent transition-colors text-right"
                        >
                          {icons[mod.icon] || <FileText className="h-4 w-4" />}
                          <div>
                            <div className="text-xs font-medium">{mod.label.split(' > ')[0]}</div>
                            <div className="text-[11px] text-muted-foreground">{mod.href}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* AI recommendation */}
                {selectedItem.aiRecommendation && (
                  <div className="rounded-xl border bg-primary/5 border-primary/20 p-5">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm mb-1">توصية الذكاء الاصطناعي</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {selectedItem.aiRecommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Activity summary */}
                <div className="rounded-xl border bg-card p-5">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    ملخص النشاطات
                  </h3>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-3 rounded-lg bg-muted/30">
                      <div className="text-lg font-semibold">{selectedItem.activities.length}</div>
                      <div className="text-[11px] text-muted-foreground">إجمالي النشاطات</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-success/5">
                      <div className="text-lg font-semibold text-success">
                        {selectedItem.activities.filter(a => a.type === 'stage_change').length}
                      </div>
                      <div className="text-[11px] text-muted-foreground">تغييرات المراحل</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-warning/5">
                      <div className="text-lg font-semibold text-warning">
                        {selectedItem.activities.filter(a => a.type === 'comment').length}
                      </div>
                      <div className="text-[11px] text-muted-foreground">تعليقات</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-primary/5">
                      <div className="text-lg font-semibold text-primary">
                        {selectedItem.activities.filter(a => a.type === 'approval').length}
                      </div>
                      <div className="text-[11px] text-muted-foreground">موافقات</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
