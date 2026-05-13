'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Wallet, ShoppingCart, FileText, CheckCircle2, AlertTriangle,
  Clock, User, Search, ArrowUpDown, Filter, TrendingUp, TrendingDown,
  Package, Truck, Users, Building2, Sparkles, Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { ProcessPipeline } from './ProcessPipeline'
import { ProcessTimeline } from './ProcessTimeline'
import { ProcessApprovalCard } from './ProcessApprovalCard'
import { calculateSLADisplay } from '@/lib/workflow/engine'
import type { ProcessItem, ProcessStage, ProcessApproval, ProcessActivity, ProcessFlowMetrics } from '@/lib/process/types'

const STAGE_TEMPLATES = [
  { id: 'requisition', name: 'طلب شراء', order: 0, slaMinutes: 60, assigneeRole: 'مقدم الطلب' },
  { id: 'po_creation', name: 'إنشاء أمر شراء', order: 1, slaMinutes: 120, assigneeRole: 'مشتريات' },
  { id: 'po_approval', name: 'اعتماد أمر الشراء', order: 2, slaMinutes: 240, assigneeRole: 'مدير المشتريات' },
  { id: 'goods_receipt', name: 'استلام البضائع', order: 3, slaMinutes: 120, assigneeRole: 'المستودع' },
  { id: 'invoice_verification', name: 'مطابقة الفاتورة', order: 4, slaMinutes: 180, assigneeRole: 'الحسابات الدائنة' },
  { id: 'payment_approval', name: 'اعتماد الدفع', order: 5, slaMinutes: 120, assigneeRole: 'المدير المالي' },
  { id: 'payment', name: 'الدفع', order: 6, slaMinutes: 60, assigneeRole: 'الخزينة' },
]

const ARABIC_NAMES = [
  'أحمد محمد', 'سارة خالد', 'محمد علي', 'نورة أحمد', 'فهد العتيبي', 'لينا حسن',
]

const ARABIC_TITLES = [
  'توريد مواد خام للإنتاج',
  'صيانة معدات المصنع',
  'شراء مستلزمات مكتبية',
  'تجديد عقود الخدمات السنوية',
  'توريد قطع غيار للسيارات',
  'شراء أجهزة تقنية معلومات',
  'توريد مواد تعبئة وتغليف',
  'خدمات تنظيف وصيانة المنشأة',
]

const TAG_OPTIONS = ['عاجل', 'دولي', 'محلي', 'مستعجل', 'حساس', 'روتيني']

const AI_RECOMMENDATIONS = [
  'يوصي النظام بتسريع عملية اعتماد أمر الشراء نظراً لاقتراب موعد التسليم المطلوب.',
  'تم اكتشاف تفاوت في سعر الفاتورة مع أمر الشراء. يرجى مراجعة الفرق قبل الاعتماد.',
  'المورد لديه تقييم أداء ممتاز. يمكن تفعيل خيار الدفع المبكر للحصول على خصم.',
  'يوجد طلب مستعجل لهذه المواد. يوصى بتحديث أولوية المعاملة إلى "عالية".',
  'تم تجاوز الحد الائتماني للمورد بنسبة 15%. يرجى الحصول على موافقة إضافية قبل إتمام الدفع.',
]

const MODULE_OPTIONS = [
  { label: 'المالية > قيود اليومية', href: '#', icon: 'Wallet' },
  { label: 'المخزون > المواد', href: '#', icon: 'Package' },
  { label: 'الموردون > إدارة الموردين', href: '#', icon: 'Users' },
  { label: 'المستودعات > استلام', href: '#', icon: 'Building2' },
  { label: 'الشحن > التوصيل', href: '#', icon: 'Truck' },
  { label: 'الفواتير > فواتير المشتريات', href: '#', icon: 'FileText' },
]

const PRIORITIES: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low']
const TYPES = ['طلب شراء', 'أمر شراء', 'فاتورة'] as const
const PREFIXES: Record<string, string> = { 'طلب شراء': 'PR', 'أمر شراء': 'PO', 'فاتورة': 'INV' }

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Wallet, Package, Truck, Users, Building2, FileText, ShoppingCart,
}

const ACTIVITY_ACTIONS: Record<string, string[]> = {
  stage_change: ['stage_completed', 'stage_started'],
  approval: ['approved', 'rejected', 'requested'],
  comment: ['comment_added'],
  system: ['system_update', 'notification'],
  escalation: ['escalation_triggered'],
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })
}

function pick<T>(arr: T[], idx: number): T {
  return arr[idx % arr.length]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function createMockItems(count: number): ProcessItem[] {
  const now = Date.now()
  const DAY_MS = 86400000

  return Array.from({ length: count }, (_, i) => {
    const type = TYPES[i % TYPES.length]
    const title = ARABIC_TITLES[i % ARABIC_TITLES.length]
    const priority = PRIORITIES[i % PRIORITIES.length]
    const currentStageIdx = i % STAGE_TEMPLATES.length
    const ownerName = pick(ARABIC_NAMES, i)
    const createdAt = now - randInt(1, 30) * DAY_MS

    const stages: ProcessStage[] = STAGE_TEMPLATES.map((tmpl, si) => {
      const stage: ProcessStage = {
        id: tmpl.id,
        name: tmpl.name,
        order: tmpl.order,
        status: 'pending',
        slaMinutes: tmpl.slaMinutes,
      }
      if (si < currentStageIdx) {
        stage.status = 'completed'
        stage.startedAt = createdAt + si * randInt(30, 120) * 60000
        stage.completedAt = stage.startedAt + randInt(10, 60) * 60000
        stage.assignee = { id: `user-${si}`, name: pick(ARABIC_NAMES, si + i) }
      } else if (si === currentStageIdx) {
        stage.status = 'active'
        stage.startedAt = createdAt + si * randInt(30, 120) * 60000
        stage.assignee = { id: `user-${si}`, name: pick(ARABIC_NAMES, si + i + 2) }
      }
      return stage
    })

    const approvals: ProcessApproval[] = []
    const approvalStages = ['po_approval', 'payment_approval']
    approvalStages.forEach((stageId) => {
      const stageIdx = STAGE_TEMPLATES.findIndex((t) => t.id === stageId)
      if (stageIdx <= currentStageIdx) {
        const isApproved = stageIdx < currentStageIdx
        approvals.push({
          id: `apr-${i}-${stageId}`,
          stageId,
          title: stageId === 'po_approval' ? 'اعتماد أمر الشراء' : 'اعتماد الدفع',
          requestedBy: { id: `user-req-${i}`, name: pick(ARABIC_NAMES, i + 3) },
          assignedTo: { id: `user-assign-${i}`, name: pick(ARABIC_NAMES, i + 5) },
          decision: isApproved ? 'approved' : 'pending',
          comments: isApproved ? 'تمت المراجعة والموافقة' : undefined,
          createdAt: createdAt + stageIdx * randInt(30, 120) * 60000,
          respondedAt: isApproved ? createdAt + stageIdx * randInt(60, 180) * 60000 : undefined,
        })
      }
    })

    const activities: ProcessActivity[] = []
    const numActivities = randInt(5, 10)
    for (let ai = 0; ai < numActivities; ai++) {
      const activityTypes: Array<ProcessActivity['type']> = ['stage_change', 'approval', 'comment', 'system', 'escalation']
      const actType = activityTypes[ai % activityTypes.length]
      const actActions = ACTIVITY_ACTIONS[actType] || ['system_update']
      const actAction = actActions[ai % actActions.length]
      const stageId = STAGE_TEMPLATES[Math.min(ai, STAGE_TEMPLATES.length - 1)].id
      const timestamp = createdAt + ai * randInt(120, 360) * 60000
      activities.push({
        id: `act-${i}-${ai}`,
        type: actType,
        action: actAction,
        actor: { id: `actor-${ai}`, name: pick(ARABIC_NAMES, ai + i) },
        timestamp,
        details: actType === 'stage_change'
          ? `تم ${actAction === 'stage_completed' ? 'إكمال' : 'بدء'} مرحلة ${pick(STAGE_TEMPLATES, ai).name}`
          : actType === 'approval'
            ? `طلب ${actAction === 'approved' ? 'تمت الموافقة على' : actAction === 'rejected' ? 'تم رفض' : 'تم تقديم'} الموافقة`
            : actType === 'comment'
              ? 'تم إضافة تعليق على المعاملة'
              : actType === 'escalation'
                ? 'تم تصعيد الطلب إلى المدير المباشر'
                : 'تحديث تلقائي للنظام',
        stageId,
      })
    }
    activities.sort((a, b) => b.timestamp - a.timestamp)

    const linkedModules = MODULE_OPTIONS.slice(i % 2 === 0 ? 0 : 1, (i % 2 === 0 ? 0 : 1) + randInt(2, 4))

    const hasAI = i % 3 === 2
    const aiRecommendation = hasAI ? pick(AI_RECOMMENDATIONS, i) : undefined

    const tags = [pick(TAG_OPTIONS, i), pick(TAG_OPTIONS, i + 3)]
    if (i % 5 === 0) tags.push(pick(TAG_OPTIONS, i + 5))

    return {
      id: `PTP-${String(i + 1).padStart(4, '0')}`,
      type,
      title,
      refNumber: `${PREFIXES[type]}-${String(i + 1).padStart(4, '0')}`,
      priority,
      status: stages.some((s) => s.status === 'active') ? 'active' : 'completed',
      stages,
      currentStage: STAGE_TEMPLATES[currentStageIdx].id,
      approvals,
      activities,
      owner: { id: `owner-${i}`, name: ownerName },
      amount: randInt(500, 50000),
      currency: 'SAR',
      createdAt,
      slaMinutes: STAGE_TEMPLATES.reduce((sum, t) => sum + t.slaMinutes, 0),
      tags,
      linkedModules,
      aiRecommendation,
    }
  })
}

const MOCK_ITEMS = createMockItems(25)

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-destructive/10 text-destructive border-destructive/20',
    high: 'bg-warning/10 text-warning border-warning/20',
    medium: 'bg-primary/10 text-primary border-primary/20',
    low: 'bg-muted text-muted-foreground border-muted',
  }
  const labels: Record<string, string> = {
    critical: 'حرج', high: 'عالية', medium: 'متوسطة', low: 'منخفضة',
  }
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', styles[priority] || styles.low)}>
      {labels[priority] || priority}
    </span>
  )
}

function StageBadge({ stages, currentStage }: { stages: ProcessStage[]; currentStage: string }) {
  const stage = stages.find((s) => s.id === currentStage)
  if (!stage) return null
  const statusStyles: Record<string, string> = {
    active: 'bg-primary/10 text-primary border-primary/20',
    completed: 'bg-success/10 text-success border-success/20',
    pending: 'bg-muted text-muted-foreground border-muted',
    failed: 'bg-destructive/10 text-destructive border-destructive/20',
    skipped: 'bg-muted/50 text-muted-foreground/50 border-muted/30',
  }
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium whitespace-nowrap', statusStyles[stage.status] || statusStyles.pending)}>
      {stage.name}
    </span>
  )
}

function SLABadge({ slaMinutes, createdAt }: { slaMinutes: number; createdAt: number }) {
  const sla = calculateSLADisplay(slaMinutes, createdAt)
  const statusStyles: Record<string, string> = {
    ok: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    critical: 'text-destructive bg-destructive/10',
    breached: 'text-destructive bg-destructive/20 font-bold',
  }
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap', statusStyles[sla.status] || '')}>
      {sla.isBreached ? 'متأخر' : sla.remainingDisplay}
    </span>
  )
}

export function ProcureToPayFlow() {
  const [selectedItem, setSelectedItem] = useState<ProcessItem | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('الكل')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'amount'>('date')
  const [activeTab, setActiveTab] = useState<'pipeline' | 'timeline' | 'approvals' | 'info'>('pipeline')
  const [showAiSuggestion, setShowAiSuggestion] = useState(true)

  const filteredItems = useMemo(() => {
    let items = [...MOCK_ITEMS]

    if (statusFilter !== 'الكل') {
      items = items.filter((item) => item.type === statusFilter)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.refNumber.toLowerCase().includes(q)
      )
    }

    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

    items.sort((a, b) => {
      if (sortBy === 'date') return b.createdAt - a.createdAt
      if (sortBy === 'priority') return (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99)
      if (sortBy === 'amount') return (b.amount ?? 0) - (a.amount ?? 0)
      return 0
    })

    return items
  }, [statusFilter, searchQuery, sortBy])

  const kpis = useMemo(() => {
    const totalAmount = MOCK_ITEMS.reduce((sum, item) => sum + (item.amount ?? 0), 0)
    const activeRequests = MOCK_ITEMS.filter(
      (item) => item.currentStage === 'requisition' || item.currentStage === 'po_creation'
    ).length
    const pendingApprovals = MOCK_ITEMS.reduce(
      (count, item) => count + item.approvals.filter((a) => a.decision === 'pending').length,
      0
    )
    const overdueSLA = MOCK_ITEMS.filter((item) => {
      const sla = calculateSLADisplay(item.slaMinutes, item.createdAt)
      return sla.isBreached
    }).length

    return { totalAmount, activeRequests, pendingApprovals, overdueSLA }
  }, [])

  const handleStageTransition = (stageId: string, newStatus: 'completed' | 'failed') => {
    setSelectedItem((prev) => {
      if (!prev) return prev
      const now = Date.now()
      const updatedStages = prev.stages.map((s) => {
        if (s.id !== stageId) return s
        return {
          ...s,
          status: newStatus,
          completedAt: newStatus === 'completed' ? now : undefined,
        }
      })
      const currentIdx = updatedStages.findIndex((s) => s.id === stageId)
      const nextStage = updatedStages.find((s, i) => i > currentIdx && s.status === 'pending')
      const newActivity: ProcessActivity = {
        id: `act-${now}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'stage_change',
        action: newStatus === 'completed' ? 'stage_completed' : 'stage_failed',
        actor: { id: 'user-1', name: 'المستخدم الحالي' },
        timestamp: now,
        details: newStatus === 'completed'
          ? `تم إكمال مرحلة ${updatedStages.find((s) => s.id === stageId)?.name}`
          : `فشلت مرحلة ${updatedStages.find((s) => s.id === stageId)?.name}`,
        stageId,
      }
      return {
        ...prev,
        stages: updatedStages,
        currentStage: nextStage?.id ?? prev.currentStage,
        activities: [newActivity, ...prev.activities],
        status: nextStage ? 'active' : 'completed',
      }
    })
  }

  const activeItem = selectedItem ?? null

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b bg-card shrink-0">
        <EnterpriseBreadcrumbs
          items={[
            { label: 'المشتريات', icon: ShoppingCart },
            { label: 'دورة المشتريات للدفع' },
          ]}
        />
        <div className="flex items-center justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold">دورة المشتريات للدفع</h1>
            <p className="text-sm text-muted-foreground">إدارة دورة المشتريات من طلب الشراء إلى الدفع</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">إجمالي المشتريات</span>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold">
              {kpis.totalAmount.toLocaleString('ar-SA')} <span className="text-xs font-normal text-muted-foreground">ريال</span>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">طلبات شراء نشطة</span>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold text-primary">{kpis.activeRequests}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">بانتظار الاعتماد</span>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-xl font-bold text-warning">{kpis.pendingApprovals}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">متأخرة عن SLA</span>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div className={cn('text-xl font-bold', kpis.overdueSLA > 0 ? 'text-destructive' : '')}>{kpis.overdueSLA}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[420px] border-l flex flex-col shrink-0 bg-card">
          <div className="flex gap-1 p-3 border-b overflow-x-auto">
            {['الكل', 'طلب شراء', 'أمر شراء', 'فاتورة'].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
                  statusFilter === filter
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {filter}
                {filter !== 'الكل' && (
                  <span className="mr-1 text-[10px] opacity-70">
                    ({MOCK_ITEMS.filter((item) => item.type === filter).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-3 border-b flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="بحث..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pr-8 pl-3 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'priority' | 'amount')}
              className="h-9 px-2 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="date">حسب التاريخ</option>
              <option value="priority">حسب الأولوية</option>
              <option value="amount">حسب المبلغ</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">لا توجد نتائج</p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-all',
                    selectedItem?.id === item.id && 'border-primary bg-primary/5 shadow-sm'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-medium">{item.refNumber}</span>
                        <PriorityBadge priority={item.priority} />
                      </div>
                      <p className="text-sm line-clamp-1">{item.title}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatDate(item.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{item.owner.name}</span>
                        </div>
                      </div>
                      {item.amount != null && (
                        <div className="text-xs font-medium mt-1">
                          {item.amount.toLocaleString('ar-SA')} {item.currency}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 mr-2 shrink-0">
                      <StageBadge stages={item.stages} currentStage={item.currentStage} />
                      <SLABadge slaMinutes={item.slaMinutes} createdAt={item.createdAt} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-background">
          {activeItem ? (
            <div className="p-6 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold">{activeItem.title}</h2>
                    <PriorityBadge priority={activeItem.priority} />
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{activeItem.refNumber}</span>
                    <span>•</span>
                    <span>{activeItem.type}</span>
                    {activeItem.amount != null && (
                      <>
                        <span>•</span>
                        <span className="font-medium text-foreground">
                          {activeItem.amount.toLocaleString('ar-SA')} {activeItem.currency}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-b">
                <div className="flex gap-1">
                  {[
                    { id: 'pipeline', label: 'مسار العمل' },
                    { id: 'timeline', label: 'النشاطات' },
                    { id: 'approvals', label: 'الموافقات' },
                    { id: 'info', label: 'المعلومات' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={cn(
                        'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
                        activeTab === tab.id
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {tab.label}
                      {tab.id === 'approvals' && activeItem.approvals.filter((a) => a.decision === 'pending').length > 0 && (
                        <span className="mr-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-warning/10 text-warning">
                          {activeItem.approvals.filter((a) => a.decision === 'pending').length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === 'pipeline' && (
                <ProcessPipeline item={activeItem} onStageTransition={handleStageTransition} />
              )}

              {activeTab === 'timeline' && (
                <ProcessTimeline activities={activeItem.activities} />
              )}

              {activeTab === 'approvals' && (
                <div className="space-y-3">
                  {activeItem.approvals.length > 0 ? (
                    activeItem.approvals.map((approval) => (
                      <ProcessApprovalCard key={approval.id} approval={approval} />
                    ))
                  ) : (
                    <div className="rounded-xl border bg-card p-6">
                      <p className="text-sm text-muted-foreground text-center py-8">لا توجد موافقات</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'info' && (
                <div className="space-y-6">
                  <div className="rounded-xl border bg-card p-6">
                    <h3 className="text-sm font-medium mb-4">معلومات العنصر</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">المالك:</span>
                        <p className="font-medium mt-0.5">{activeItem.owner.name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">تاريخ الإنشاء:</span>
                        <p className="font-medium mt-0.5">
                          {new Date(activeItem.createdAt).toLocaleDateString('ar-SA', {
                            day: 'numeric', month: 'long', year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">المبلغ:</span>
                        <p className="font-medium mt-0.5">
                          {activeItem.amount?.toLocaleString('ar-SA')} {activeItem.currency}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">مدة SLA:</span>
                        <p className="font-medium mt-0.5">{activeItem.slaMinutes} دقيقة</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">الأولوية:</span>
                        <div className="mt-0.5">
                          <PriorityBadge priority={activeItem.priority} />
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">الحالة:</span>
                        <p className="font-medium mt-0.5">{activeItem.status === 'active' ? 'نشط' : 'مكتمل'}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">الوسوم:</span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {activeItem.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {activeItem.linkedModules.length > 0 && (
                    <div className="rounded-lg border p-4">
                      <h4 className="text-sm font-medium mb-3">الوحدات المرتبطة</h4>
                      <div className="flex flex-wrap gap-2">
                        {activeItem.linkedModules.map((mod, idx) => {
                          const Icon = ICON_MAP[mod.icon] || Eye
                          return (
                            <button
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border bg-card hover:bg-muted transition-colors"
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {mod.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {activeItem.aiRecommendation && showAiSuggestion && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-primary">توصية الذكاء الاصطناعي</span>
                        </div>
                        <button
                          onClick={() => setShowAiSuggestion(false)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          إخفاء
                        </button>
                      </div>
                      <p className="text-sm text-muted-foreground">{activeItem.aiRecommendation}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">اختر عنصراً من القائمة لعرض تفاصيل سير العمل</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
