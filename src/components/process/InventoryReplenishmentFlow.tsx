'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Wallet, ShoppingCart, FileText, CheckCircle2, AlertTriangle,
  Clock, User, Search, ArrowUpDown, Filter, TrendingUp, TrendingDown,
  Package, Truck, Users, Building2, Sparkles, Eye, Box,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { ProcessPipeline } from './ProcessPipeline'
import { ProcessTimeline } from './ProcessTimeline'
import { ProcessApprovalCard } from './ProcessApprovalCard'
import { calculateSLADisplay } from '@/lib/workflow/engine'
import type { ProcessItem, ProcessStage, ProcessApproval, ProcessActivity, ProcessFlowMetrics } from '@/lib/process/types'

const STAGE_TEMPLATES = [
  { id: 'demand_signal', name: 'إشارة الطلب', order: 0, slaMinutes: 60, assigneeRole: 'نظام' },
  { id: 'reorder_point', name: 'نقطة إعادة الطلب', order: 1, slaMinutes: 30, assigneeRole: 'نظام' },
  { id: 'po_creation', name: 'إنشاء أمر توريد', order: 2, slaMinutes: 120, assigneeRole: 'مشتريات' },
  { id: 'po_approval', name: 'اعتماد أمر التوريد', order: 3, slaMinutes: 240, assigneeRole: 'مدير المشتريات' },
  { id: 'stock_receipt', name: 'استلام المخزون', order: 4, slaMinutes: 180, assigneeRole: 'المستودع' },
  { id: 'quality_check', name: 'فحص الجودة', order: 5, slaMinutes: 120, assigneeRole: 'الجودة' },
  { id: 'bin_placement', name: 'تخزين في الموقع', order: 6, slaMinutes: 60, assigneeRole: 'المستودع' },
]

const ITEM_TITLES = [
  'تزويد مخزون المواد الخام - مجموعة أ',
  'إعادة تموين قطع الغيار - خط إنتاج 1',
  'تأمين مخزون السلامة - المواد الاستهلاكية',
  'تعبئة مخزون التعبئة والتغليف',
  'توريد مواد تنظيف وصيانة',
  'تزويد مخزون موسمي - رمضان',
]

const TAGS_POOL = ['حرج', 'موسمي', 'دوران سريع', 'دوران بطيء', 'مستورد']

const PRIORITIES: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low']

const ROLES = [
  { id: 'system', name: 'النظام' },
  { id: 'procurement', name: 'أحمد السعيد' },
  { id: 'procurement_mgr', name: 'خالد العتيبي' },
  { id: 'warehouse', name: 'سعد الحربي' },
  { id: 'quality', name: 'فيصل المالكي' },
  { id: 'warehouse2', name: 'ناصر القحطاني' },
]

const ROLE_MAP: Record<string, { id: string; name: string }> = {
  'نظام': { id: 'system', name: 'النظام' },
  'مشتريات': { id: 'procurement', name: 'أحمد السعيد' },
  'مدير المشتريات': { id: 'procurement_mgr', name: 'خالد العتيبي' },
  'المستودع': { id: 'warehouse', name: 'سعد الحربي' },
  'الجودة': { id: 'quality', name: 'فيصل المالكي' },
}

function generateRef(type: string, idx: number): string {
  const num = String(idx + 1).padStart(4, '0')
  if (type === 'إنذار مخزون') return `ALR-${num}`
  if (type === 'طلب توريد') return `REQ-${num}`
  return `PO-${num}`
}

function randomAmount(): number {
  const values = [500, 1200, 3500, 8000, 15000, 28000, 45000, 72000, 110000, 155000, 200000]
  return values[Math.floor(Math.random() * values.length)]
}

function randomSLA(): number {
  return [30, 60, 120, 240, 480][Math.floor(Math.random() * 5)]
}

function pickTags(): string[] {
  const count = 1 + Math.floor(Math.random() * 3)
  const shuffled = [...TAGS_POOL].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

function pickTitle(): string {
  return ITEM_TITLES[Math.floor(Math.random() * ITEM_TITLES.length)]
}

function pickPriority(): 'critical' | 'high' | 'medium' | 'low' {
  return PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)]
}

function buildStages(completedUpTo: number, currentStageId: string): ProcessStage[] {
  return STAGE_TEMPLATES.map((t, idx) => {
    const isCompleted = idx < completedUpTo
    const isCurrent = t.id === currentStageId
    const isPending = !isCompleted && !isCurrent
    const roleId = ROLE_MAP[t.assigneeRole]
    return {
      id: t.id,
      name: t.name,
      order: t.order,
      status: isCompleted ? 'completed' as const : isCurrent ? 'active' as const : 'pending' as const,
      slaMinutes: t.slaMinutes,
      assignee: isCompleted || isCurrent ? roleId : undefined,
      startedAt: isCompleted || isCurrent ? Date.now() - (t.slaMinutes * 60000 * (Math.random() * 0.6 + 0.2)) : undefined,
      completedAt: isCompleted ? Date.now() - (t.slaMinutes * 60000 * (Math.random() * 0.3)) : undefined,
    }
  })
}

function buildApprovals(stages: ProcessStage[], itemType: string): ProcessApproval[] {
  const approvals: ProcessApproval[] = []
  const poApprovalStage = stages.find(s => s.id === 'po_approval')
  if (poApprovalStage && (poApprovalStage.status === 'completed' || poApprovalStage.status === 'active')) {
    approvals.push({
      id: `apr-${stages[0].id}-po`,
      stageId: 'po_approval',
      title: 'اعتماد أمر التوريد',
      requestedBy: { id: 'procurement', name: 'أحمد السعيد' },
      assignedTo: { id: 'procurement_mgr', name: 'خالد العتيبي' },
      decision: poApprovalStage.status === 'completed' ? 'approved' as const : 'pending' as const,
      comments: poApprovalStage.status === 'completed' ? 'تمت الموافقة على أمر التوريد' : undefined,
      createdAt: Date.now() - 7200000,
      respondedAt: poApprovalStage.status === 'completed' ? Date.now() - 3600000 : undefined,
    })
  }
  if (itemType === 'أمر توريد') {
    const qcStage = stages.find(s => s.id === 'quality_check')
    if (qcStage && qcStage.status === 'active') {
      approvals.push({
        id: `apr-${stages[0].id}-qc`,
        stageId: 'quality_check',
        title: 'نتائج فحص الجودة',
        requestedBy: { id: 'warehouse', name: 'سعد الحربي' },
        assignedTo: { id: 'quality', name: 'فيصل المالكي' },
        decision: 'pending' as const,
        createdAt: Date.now() - 1800000,
      })
    }
  }
  return approvals
}

function buildActivities(stages: ProcessStage[], itemType: string, refNumber: string): ProcessActivity[] {
  const activities: ProcessActivity[] = []
  stages.filter(s => s.status !== 'pending').forEach((stage, idx) => {
    activities.push({
      id: `act-${stage.id}-${idx}`,
      type: 'stage_change' as const,
      action: `الوصول إلى مرحلة ${stage.name}`,
      actor: stage.assignee ?? { id: 'system', name: 'النظام' },
      timestamp: stage.startedAt ?? Date.now(),
      details: `تم الوصول إلى مرحلة ${stage.name}`,
      stageId: stage.id,
    })
    if (stage.status === 'completed' && stage.completedAt) {
      activities.push({
        id: `act-${stage.id}-complete-${idx}`,
        type: 'stage_change' as const,
        action: `اكتمال مرحلة ${stage.name}`,
        actor: stage.assignee ?? { id: 'system', name: 'النظام' },
        timestamp: stage.completedAt,
        details: `تم اكتمال مرحلة ${stage.name} بنجاح`,
        stageId: stage.id,
      })
    }
  })
  if (itemType === 'أمر توريد') {
    activities.push({
      id: `act-create-${refNumber}`,
      type: 'system' as const,
      action: 'إنشاء أمر توريد',
      actor: { id: 'system', name: 'النظام' },
      timestamp: Date.now() - 86400000,
      details: `تم إنشاء أمر التوريد ${refNumber} بناءً على طلب التوريد`,
    })
  }
  return activities.sort((a, b) => b.timestamp - a.timestamp)
}

function generateMockItems(): ProcessItem[] {
  const items: ProcessItem[] = []
  const configs = [
    { type: 'إنذار مخزون', stagesUpTo: [0, 0, 0, 1, 1, 1, 0, 1, 0] as number[], currentStages: ['demand_signal', 'demand_signal', 'demand_signal', 'reorder_point', 'reorder_point', 'reorder_point', 'demand_signal', 'reorder_point', 'demand_signal'] as string[] },
    { type: 'طلب توريد', stagesUpTo: [1, 2, 2, 3, 2, 1, 3, 2] as number[], currentStages: ['po_creation', 'po_approval', 'po_creation', 'po_approval', 'po_creation', 'reorder_point', 'po_approval', 'po_creation'] as string[] },
    { type: 'أمر توريد', stagesUpTo: [3, 4, 5, 6, 6, 5, 4, 7] as number[], currentStages: ['po_approval', 'stock_receipt', 'quality_check', 'bin_placement', 'bin_placement', 'quality_check', 'stock_receipt', 'bin_placement'] as string[] },
  ]

  let globalIdx = 0
  for (const cfg of configs) {
    for (let i = 0; i < cfg.stagesUpTo.length; i++) {
      const type = cfg.type
      const refNumber = generateRef(type, globalIdx)
      const title = pickTitle()
      const priority = pickPriority()
      const slaMin = randomSLA()
      const amount = type === 'إنذار مخزون' ? undefined : randomAmount()
      const tags = pickTags()
      const completedUpTo = cfg.stagesUpTo[i]
      const currentStageId = cfg.currentStages[i]
      const itemSlaMinutes = slaMin

      const stages = buildStages(completedUpTo, currentStageId)

      if (completedUpTo >= 7) {
        stages[stages.length - 1].status = 'completed'
      }

      const approvals = buildApprovals(stages, type)
      const activities = buildActivities(stages, type, refNumber)

      const linkedModules = [
        { label: 'المشتريات > أوامر الشراء', href: '/enterprise/procurement/purchase-orders', icon: 'ShoppingCart' },
        { label: 'المالية > قيود المخزون', href: '/enterprise/finance/inventory-entries', icon: 'Wallet' },
        { label: 'الجودة > فحوصات الجودة', href: '/enterprise/quality/inspections', icon: 'CheckCircle2' },
      ]

      let aiRec: string | undefined
      if (type === 'إنذار مخزون') {
        aiRec = 'بناءً على أنماط الاستهلاك، يُوصى برفع نقطة إعادة الطلب لهذا الصنف بنسبة 15% لتجنب نفاد المخزون خلال الموسم القادم.'
      } else if (type === 'طلب توريد' && priority === 'critical') {
        aiRec = 'تم تحديد هذا الطلب كحرج. يُوصى بتسريع إجراءات الاعتماد وتحويله إلى أمر توريد خلال ساعتين.'
      } else if (type === 'أمر توريد') {
        aiRec = 'معدل دوران هذا الصنف مرتفع. يُوصى بزيادة كمية التوريد بنسبة 20% للاستفادة من وفورات الحجم.'
      }

      const status: ProcessStage['status'] = completedUpTo >= 7 ? 'completed' : 'active'

      items.push({
        id: `inv-${String(globalIdx + 1).padStart(3, '0')}`,
        type,
        title,
        refNumber,
        priority,
        status,
        stages,
        currentStage: currentStageId,
        approvals,
        activities,
        owner: ROLE_MAP['المستودع'],
        amount,
        currency: 'SAR',
        createdAt: Date.now() - (itemSlaMinutes * 60000 * (Math.random() * 3 + 1)),
        slaMinutes: itemSlaMinutes,
        tags,
        linkedModules,
        aiRecommendation: aiRec,
      })
      globalIdx++
    }
  }

  return items
}

const MOCK_ITEMS = generateMockItems()

type StatusFilter = 'الكل' | 'إنذارات' | 'طلبات' | 'أوامر شراء' | 'مستودع'
type SortBy = 'الأحدث' | 'الأقدم' | 'الأعلى قيمة' | 'الأدنى قيمة' | 'أولوية'
type DetailTab = 'pipeline' | 'timeline' | 'approvals' | 'info'

const STATUS_FILTERS: StatusFilter[] = ['الكل', 'إنذارات', 'طلبات', 'أوامر شراء', 'مستودع']

const ICON_MAP: Record<string, typeof AlertTriangle> = {
  'إنذار مخزون': AlertTriangle,
  'طلب توريد': FileText,
  'أمر توريد': ShoppingCart,
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('ar-SA')
}

function StageBadge({ stageName }: { stageName: string }) {
  const stage = STAGE_TEMPLATES.find(s => s.name === stageName)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
      <Clock className="h-3 w-3" />
      {stage?.name ?? stageName}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-blue-100 text-blue-700 border-blue-200',
    low: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  const labels: Record<string, string> = {
    critical: 'حرج',
    high: 'عالية',
    medium: 'متوسطة',
    low: 'منخفضة',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border', styles[priority] || styles.medium)}>
      {labels[priority] || priority}
    </span>
  )
}

function SLABadge({ slaMinutes, createdAt }: { slaMinutes: number; createdAt: number }) {
  const sla = calculateSLADisplay(slaMinutes, createdAt)
  const colors: Record<string, string> = {
    ok: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    critical: 'bg-orange-100 text-orange-700',
    breached: 'bg-red-100 text-red-700',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', colors[sla.status] || colors.ok)}>
      <Clock className="h-3 w-3" />
      {sla.remainingDisplay}
    </span>
  )
}

function KPICard({ icon: Icon, label, value, trend, trendLabel }: {
  icon: typeof Wallet
  label: string
  value: string
  trend?: 'up' | 'down'
  trendLabel?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex-1 min-w-0">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      {trend && trendLabel && (
        <div className={cn('flex items-center gap-1 text-xs', trend === 'up' ? 'text-success' : 'text-destructive')}>
          {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>{trendLabel}</span>
        </div>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <Package className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

export function InventoryReplenishmentFlow() {
  const [selectedItem, setSelectedItem] = useState<ProcessItem | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('الكل')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('الأحدث')
  const [activeTab, setActiveTab] = useState<DetailTab>('pipeline')

  const metrics = useMemo<ProcessFlowMetrics>(() => {
    const active = MOCK_ITEMS.filter(i => i.status === 'active')
    const pendingInspection = MOCK_ITEMS.filter(i =>
      i.currentStage === 'quality_check' && i.stages.find(s => s.id === 'quality_check')?.status === 'active'
    )
    const overdue = MOCK_ITEMS.filter(i => {
      const activeStage = i.stages.find(s => s.status === 'active' || s.status === 'pending')
      if (!activeStage || !activeStage.slaMinutes || !activeStage.startedAt) return false
      const elapsed = Date.now() - activeStage.startedAt
      return elapsed > activeStage.slaMinutes * 60000
    })
    return {
      totalItems: MOCK_ITEMS.length,
      activeItems: active.length,
      completedItems: MOCK_ITEMS.filter(i => i.status === 'completed').length,
      overdueItems: overdue.length,
      avgCompletionTime: 0,
      totalAmount: MOCK_ITEMS.reduce((sum, i) => sum + (i.amount ?? 0), 0),
      pendingApprovals: MOCK_ITEMS.reduce((sum, i) => sum + i.approvals.filter(a => a.decision === 'pending').length, 0),
    }
  }, [])

  const totalAmountFormatted = useMemo(() => {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(metrics.totalAmount)
  }, [metrics.totalAmount])

  const filteredItems = useMemo(() => {
    let items = [...MOCK_ITEMS]

    if (statusFilter !== 'الكل') {
      if (statusFilter === 'إنذارات') items = items.filter(i => i.type === 'إنذار مخزون')
      else if (statusFilter === 'طلبات') items = items.filter(i => i.type === 'طلب توريد')
      else if (statusFilter === 'أوامر شراء') items = items.filter(i => i.type === 'أمر توريد')
      else if (statusFilter === 'مستودع') items = items.filter(i =>
        i.stages.some(s => s.assignee?.id === 'warehouse' || s.assignee?.id === 'warehouse2')
      )
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.refNumber.toLowerCase().includes(q) ||
        i.tags.some(t => t.includes(q))
      )
    }

    if (sortBy === 'الأحدث') items.sort((a, b) => b.createdAt - a.createdAt)
    else if (sortBy === 'الأقدم') items.sort((a, b) => a.createdAt - b.createdAt)
    else if (sortBy === 'الأعلى قيمة') items.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
    else if (sortBy === 'الأدنى قيمة') items.sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0))
    else if (sortBy === 'أولوية') {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      items.sort((a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99))
    }

    return items
  }, [statusFilter, searchQuery, sortBy])

  const handleStageTransition = (stageId: string, newStatus: 'completed' | 'failed') => {
    if (!selectedItem) return
    setSelectedItem((prev) => {
      if (!prev) return prev
      const updatedStages = prev.stages.map(s => {
        if (s.id === stageId) {
          return {
            ...s,
            status: newStatus,
            completedAt: newStatus === 'completed' ? Date.now() : s.completedAt,
          }
        }
        if (newStatus === 'completed') {
          const currentIdx = prev.stages.findIndex(st => st.id === stageId)
          const stageIdx = prev.stages.findIndex(st => st.id === s.id)
          if (stageIdx === currentIdx + 1 && s.status === 'pending') {
            return { ...s, status: 'active' as const, startedAt: Date.now(), assignee: ROLE_MAP[STAGE_TEMPLATES.find(t => t.id === s.id)?.assigneeRole ?? ''] }
          }
        }
        return s
      })
      const nextActive = updatedStages.find(s => s.status === 'active')
      return {
        ...prev,
        stages: updatedStages,
        currentStage: nextActive?.id ?? (updatedStages.every(s => s.status === 'completed' || s.status === 'skipped') ? updatedStages[updatedStages.length - 1].id : prev.currentStage),
        status: updatedStages.every(s => s.status === 'completed' || s.status === 'skipped') ? 'completed' as const : 'active' as const,
        activities: [
          {
            id: `act-transition-${Date.now()}`,
            type: 'stage_change' as const,
            action: newStatus === 'completed' ? 'إكمال المرحلة' : 'فشل المرحلة',
            actor: { id: 'user', name: 'المستخدم' },
            timestamp: Date.now(),
            details: `تم ${newStatus === 'completed' ? 'إكمال' : 'تحديد فشل'} مرحلة ${prev.stages.find(s => s.id === stageId)?.name}`,
            stageId,
          },
          ...prev.activities,
        ],
      }
    })
  }

  const handleApprove = (approvalId: string) => {
    if (!selectedItem) return
    setSelectedItem((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        approvals: prev.approvals.map(a =>
          a.id === approvalId ? { ...a, decision: 'approved' as const, respondedAt: Date.now() } : a
        ),
        activities: [
          {
            id: `act-approve-${Date.now()}`,
            type: 'approval' as const,
            action: 'موافقة',
            actor: { id: 'user', name: 'المستخدم' },
            timestamp: Date.now(),
            details: `تمت الموافقة على طلب الاعتماد`,
          },
          ...prev.activities,
        ],
      }
    })
  }

  const handleReject = (approvalId: string) => {
    if (!selectedItem) return
    setSelectedItem((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        approvals: prev.approvals.map(a =>
          a.id === approvalId ? { ...a, decision: 'rejected' as const, respondedAt: Date.now() } : a
        ),
        activities: [
          {
            id: `act-reject-${Date.now()}`,
            type: 'approval' as const,
            action: 'رفض',
            actor: { id: 'user', name: 'المستخدم' },
            timestamp: Date.now(),
            details: `تم رفض طلب الاعتماد`,
          },
          ...prev.activities,
        ],
      }
    })
  }

  const itemCounts = useMemo(() => ({
    'الكل': MOCK_ITEMS.length,
    'إنذارات': MOCK_ITEMS.filter(i => i.type === 'إنذار مخزون').length,
    'طلبات': MOCK_ITEMS.filter(i => i.type === 'طلب توريد').length,
    'أوامر شراء': MOCK_ITEMS.filter(i => i.type === 'أمر توريد').length,
    'مستودع': MOCK_ITEMS.filter(i => i.stages.some(s => s.assignee?.id === 'warehouse' || s.assignee?.id === 'warehouse2')).length,
  }), [])

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <EnterpriseBreadcrumbs
          items={[
            { label: 'المخزون', href: '/enterprise/inventory' },
            { label: 'تزويد المخزون' },
          ]}
        />
      </div>

      <div>
        <h1 className="text-2xl font-bold">دورة تزويد المخزون</h1>
        <p className="text-sm text-muted-foreground mt-1">
          إدارة ومتابعة عمليات تزويد المخزون من إشارات الطلب وحتى التخزين في الموقع
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KPICard
          icon={Box}
          label="قيمة المخزون قيد التزويد"
          value={totalAmountFormatted}
          trend="up"
          trendLabel="+12% عن الشهر الماضي"
        />
        <KPICard
          icon={FileText}
          label="طلبات توريد نشطة"
          value={String(metrics.activeItems)}
          trend={metrics.activeItems > 10 ? 'up' : 'down'}
          trendLabel={metrics.activeItems > 10 ? 'مرتفعة' : 'منخفضة'}
        />
        <KPICard
          icon={CheckCircle2}
          label="بانتظار الفحص"
          value={String(MOCK_ITEMS.filter(i => i.currentStage === 'quality_check').length)}
          trend="down"
          trendLabel="5 قيد الفحص حالياً"
        />
        <KPICard
          icon={AlertTriangle}
          label="متأخرة عن SLA"
          value={String(metrics.overdueItems)}
          trend="up"
          trendLabel="بحاجة إلى متابعة"
        />
      </div>

      <div className="flex gap-6">
        <div className="w-[420px] shrink-0 space-y-4">
          <div className="flex gap-1 p-1 rounded-lg bg-muted">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={cn(
                  'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  statusFilter === f
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {f}
                <span className="mr-1 text-[10px] opacity-60">({itemCounts[f]})</span>
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="بحث في طلبات التزويد..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pr-10 pl-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span>{filteredItems.length} عنصر</span>
            </div>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="appearance-none h-8 pr-3 pl-8 rounded-lg border bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="الأحدث">الأحدث</option>
                <option value="الأقدم">الأقدم</option>
                <option value="الأعلى قيمة">الأعلى قيمة</option>
                <option value="الأدنى قيمة">الأدنى قيمة</option>
                <option value="أولوية">أولوية</option>
              </select>
              <ArrowUpDown className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredItems.length === 0 ? (
              <EmptyState message="لا توجد عناصر تطابق معايير البحث" />
            ) : (
              filteredItems.map((item) => {
                const Icon = ICON_MAP[item.type] || Package
                const activeStage = item.stages.find(s => s.status === 'active')
                const stageName = activeStage
                  ? STAGE_TEMPLATES.find(t => t.id === activeStage.id)?.name
                  : item.status === 'completed'
                    ? 'مكتمل'
                    : STAGE_TEMPLATES.find(t => t.id === item.currentStage)?.name
                return (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedItem(item); setActiveTab('pipeline') }}
                    className={cn(
                      'w-full text-right rounded-xl border p-4 transition-all hover:shadow-sm hover:border-primary/30',
                      selectedItem?.id === item.id ? 'border-primary/50 bg-primary/5 shadow-sm' : 'bg-card'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                        item.type === 'إنذار مخزون' ? 'bg-red-100 text-red-600' :
                        item.type === 'طلب توريد' ? 'bg-blue-100 text-blue-600' :
                        'bg-emerald-100 text-emerald-600'
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-muted-foreground">{item.refNumber}</span>
                          <PriorityBadge priority={item.priority} />
                        </div>
                        <p className="text-sm font-medium leading-snug mb-2 line-clamp-2">{item.title}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                            item.type === 'إنذار مخزون' ? 'bg-red-50 text-red-600' :
                            item.type === 'طلب توريد' ? 'bg-blue-50 text-blue-600' :
                            'bg-emerald-50 text-emerald-600'
                          )}>
                            {item.type}
                          </span>
                          {stageName && <StageBadge stageName={stageName} />}
                          <SLABadge slaMinutes={item.slaMinutes} createdAt={item.createdAt} />
                        </div>
                        {item.tags.length > 0 && (
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            {item.tags.map((tag) => (
                              <span key={tag} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.amount != null && (
                          <div className="mt-2 text-xs font-medium text-muted-foreground">
                            {new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(item.amount)}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {selectedItem ? (
            <div className="space-y-4">
              <div className="rounded-xl border bg-card">
                <div className="flex border-b">
                  {([
                    { id: 'pipeline' as const, label: 'Pipeline', icon: Box },
                    { id: 'timeline' as const, label: 'Timeline', icon: Clock },
                    { id: 'approvals' as const, label: 'Approvals', icon: CheckCircle2 },
                    { id: 'info' as const, label: 'Info', icon: FileText },
                  ]).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors',
                        activeTab === tab.id
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="p-6">
                  {activeTab === 'pipeline' && (
                    <ProcessPipeline
                      item={selectedItem}
                      onStageTransition={handleStageTransition}
                    />
                  )}
                  {activeTab === 'timeline' && (
                    <ProcessTimeline activities={selectedItem.activities} />
                  )}
                  {activeTab === 'approvals' && (
                    <div className="space-y-4">
                      {selectedItem.approvals.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">لا توجد موافقات</p>
                      ) : (
                        selectedItem.approvals.map((approval) => (
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
                  {activeTab === 'info' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="rounded-lg border p-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <Package className="h-3.5 w-3.5" />
                            <span>نوع العنصر</span>
                          </div>
                          <span className="text-sm font-medium">{selectedItem.type}</span>
                        </div>
                        <div className="rounded-lg border p-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <User className="h-3.5 w-3.5" />
                            <span>المالك</span>
                          </div>
                          <span className="text-sm font-medium">{selectedItem.owner.name}</span>
                        </div>
                        <div className="rounded-lg border p-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <Clock className="h-3.5 w-3.5" />
                            <span>تاريخ الإنشاء</span>
                          </div>
                          <span className="text-sm font-medium">{formatDate(selectedItem.createdAt)}</span>
                        </div>
                        {selectedItem.amount != null && (
                          <div className="rounded-lg border p-4">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                              <Wallet className="h-3.5 w-3.5" />
                              <span>القيمة</span>
                            </div>
                            <span className="text-sm font-medium">
                              {new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(selectedItem.amount)}
                            </span>
                          </div>
                        )}
                        <div className="rounded-lg border p-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>الأولوية</span>
                          </div>
                          <PriorityBadge priority={selectedItem.priority} />
                        </div>
                        <div className="rounded-lg border p-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <Clock className="h-3.5 w-3.5" />
                            <span>SLA</span>
                          </div>
                          <SLABadge slaMinutes={selectedItem.slaMinutes} createdAt={selectedItem.createdAt} />
                        </div>
                      </div>

                      {selectedItem.tags.length > 0 && (
                        <div>
                          <h4 className="text-xs text-muted-foreground mb-2">الوسوم</h4>
                          <div className="flex items-center gap-2">
                            {selectedItem.tags.map((tag) => (
                              <span key={tag} className="text-xs bg-muted px-2.5 py-1 rounded-full">{tag}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <h4 className="text-xs text-muted-foreground mb-3">وحدات مرتبطة</h4>
                        <div className="grid grid-cols-3 gap-3">
                          {selectedItem.linkedModules.map((mod, idx) => (
                            <a
                              key={idx}
                              href={mod.href}
                              className="flex items-center gap-2 rounded-lg border p-3 text-xs font-medium hover:bg-muted/50 hover:border-primary/30 transition-colors"
                            >
                              {mod.icon === 'ShoppingCart' && <ShoppingCart className="h-4 w-4 text-primary" />}
                              {mod.icon === 'Wallet' && <Wallet className="h-4 w-4 text-primary" />}
                              {mod.icon === 'CheckCircle2' && <CheckCircle2 className="h-4 w-4 text-primary" />}
                              <span>{mod.label}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedItem.aiRecommendation && (
                <div className="rounded-xl border bg-gradient-to-r from-primary/5 to-purple-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-primary">توصية الذكاء الاصطناعي</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{selectedItem.aiRecommendation}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border bg-card h-full flex items-center justify-center">
              <div className="text-center">
                <Eye className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">اختر عنصراً من القائمة لعرض التفاصيل</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
