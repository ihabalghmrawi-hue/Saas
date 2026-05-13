'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Wallet, ShoppingCart, FileText, CheckCircle2, AlertTriangle,
  Clock, User, Search, ArrowUpDown, Filter, TrendingUp, TrendingDown,
  Package, Truck, Users, Building2, Sparkles, Eye, Percent,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { ProcessPipeline } from './ProcessPipeline'
import { ProcessTimeline } from './ProcessTimeline'
import { ProcessApprovalCard } from './ProcessApprovalCard'
import { calculateSLADisplay } from '@/lib/workflow/engine'
import type { ProcessItem, ProcessStage, ProcessApproval, ProcessActivity, ProcessFlowMetrics } from '@/lib/process/types'

const STAGE_TEMPLATES = [
  { id: 'quote', name: 'عرض سعر', order: 0, slaMinutes: 120, assigneeRole: 'مندوب مبيعات' },
  { id: 'sales_order', name: 'أمر بيع', order: 1, slaMinutes: 60, assigneeRole: 'مندوب مبيعات' },
  { id: 'order_approval', name: 'اعتماد الطلب', order: 2, slaMinutes: 240, assigneeRole: 'مدير المبيعات' },
  { id: 'picking', name: 'التجهيز', order: 3, slaMinutes: 180, assigneeRole: 'المستودع' },
  { id: 'shipping', name: 'الشحن', order: 4, slaMinutes: 120, assigneeRole: 'الشحن' },
  { id: 'invoicing', name: 'إصدار الفاتورة', order: 5, slaMinutes: 60, assigneeRole: 'الحسابات المدينة' },
  { id: 'payment_collection', name: 'تحصيل الدفع', order: 6, slaMinutes: 480, assigneeRole: 'التحصيل' },
]

const TYPE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'عرض سعر': FileText,
  'أمر بيع': ShoppingCart,
  'فاتورة': Wallet,
}

const PRIORITY_STYLES = {
  critical: { label: 'حرج', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800' },
  high: { label: 'عالي', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800' },
  medium: { label: 'متوسط', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' },
  low: { label: 'منخفض', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800' },
}

const STAGE_LABELS: Record<string, string> = {
  quote: 'عرض سعر',
  sales_order: 'أمر بيع',
  order_approval: 'اعتماد الطلب',
  picking: 'التجهيز',
  shipping: 'الشحن',
  invoicing: 'إصدار الفاتورة',
  payment_collection: 'تحصيل الدفع',
}

const STATUS_FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'quote', label: 'عروض' },
  { id: 'sales_order', label: 'طلبات' },
  { id: 'shipping', label: 'شحن' },
  { id: 'invoicing', label: 'فواتير' },
  { id: 'payment_collection', label: 'مدفوعات' },
]

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Wallet, ShoppingCart, FileText, Package, Truck, Users, Building2, TrendingUp,
}

const ARABIC_NAMES = [
  'أحمد الجهني', 'محمد العتيبي', 'خالد القحطاني', 'سارة الحربي', 'نورة الدوسري',
  'فهد الزهراني', 'عبدالله الشمري', 'فيصل المطيري', 'عمر الغامدي', 'علي الزهراني',
  'ليلى الشهراني', 'هدى العسيري', 'ماجد السبيعي', 'يوسف البقمي', 'حسن الثقفي',
  'منى الحارثي', 'نوف العنزي', 'بدر الجابري', 'سلطان المالكي', 'رنا القرشي',
]

const TITLE_POOL = [
  { title: 'عرض سعر لمشروع تطوير نظام محاسبة', type: 'عرض سعر', refPrefix: 'QTE' },
  { title: 'عرض سعر صيانة سنوية للبنية التحتية', type: 'عرض سعر', refPrefix: 'QTE' },
  { title: 'عرض سعر توريد أجهزة وبرمجيات', type: 'عرض سعر', refPrefix: 'QTE' },
  { title: 'عرض سعر خدمات استشارية تقنية', type: 'عرض سعر', refPrefix: 'QTE' },
  { title: 'عرض سعر تجديد تراخيص البرامج', type: 'عرض سعر', refPrefix: 'QTE' },
  { title: 'أمر بيع توريد معدات شبكات', type: 'أمر بيع', refPrefix: 'SO' },
  { title: 'أمر بيع خدمات سحابية شهرية', type: 'أمر بيع', refPrefix: 'SO' },
  { title: 'أمر بيع أجهزة حاسب آلي مكتبية', type: 'أمر بيع', refPrefix: 'SO' },
  { title: 'أمر بيع نظام مراقبة أمني', type: 'أمر بيع', refPrefix: 'SO' },
  { title: 'أمر بيع توريد طابعات وملحقات', type: 'أمر بيع', refPrefix: 'SO' },
  { title: 'فاتورة خدمات استشارات إدارية', type: 'فاتورة', refPrefix: 'INV' },
  { title: 'فاتورة صيانة دورية للأنظمة', type: 'فاتورة', refPrefix: 'INV' },
  { title: 'فاتورة تراخيص برامج سنوية', type: 'فاتورة', refPrefix: 'INV' },
  { title: 'فاتورة خدمات دعم فني شهري', type: 'فاتورة', refPrefix: 'INV' },
  { title: 'فاتورة توريد مواد تشغيلية', type: 'فاتورة', refPrefix: 'INV' },
]

const TAG_OPTIONS = ['عميل مهم', 'تصدير', 'محلي', 'جملة', 'تجزئة']
const PRIORITIES: Array<ProcessItem['priority']> = ['critical', 'high', 'medium', 'low']

const AI_RECOMMENDATIONS = [
  'يوصى بتسريع عملية اعتماد عرض السعر نظراً لقرب انتهاء صلاحية العرض المقدم للعميل',
  'تم تجاوز الحد الأدنى لمدة الاعتماد. يوصى برفع الطلب إلى المشرف المباشر',
  'العميل له تاريخ ائتماني جيد. يوصى بالموافقة على الحد الائتماني المطلوب',
  'يوصى بمراجعة شروط الدفع مع العميل قبل إصدار الفاتورة النهائية',
  'مخزون المنتج متوفر. يمكن تأكيد أمر التوريد فور اعتماد العرض',
  'يوصى بتوحيد شحنات متعددة لنفس العميل لتقليل تكاليف الشحن',
  'تم إتمام التجهيز. يوصى بجدولة الشحن خلال 24 ساعة للحفاظ على SLA',
  'الفاتورة مستحقة منذ 5 أيام. يوصى بإرسال إشعار تذكير للعميل',
  'يوصى بمراجعة هيكل التسعير للمنتجات ذات الطلب المرتفع',
  'العميل مؤهل لخصم ولاء. يوصى بتقديم خصم 5% لتشجيع التجديد',
]

function generateMockItems(): ProcessItem[] {
  const items: ProcessItem[] = []
  const baseTime = Date.now()
  let nameIdx = 0
  let titleIdx = 0
  let tagIdx = 0

  const stageOrder = STAGE_TEMPLATES.map(s => s.id)

  function pickName(): { id: string; name: string } {
    const name = ARABIC_NAMES[nameIdx % ARABIC_NAMES.length]
    nameIdx++
    return { id: `user-${nameIdx}`, name }
  }

  function pickTitle(): { title: string; type: string; refPrefix: string } {
    const t = TITLE_POOL[titleIdx % TITLE_POOL.length]
    titleIdx++
    return t
  }

  function pickTag(): string {
    const t = TAG_OPTIONS[tagIdx % TAG_OPTIONS.length]
    tagIdx++
    return t
  }

  function generateStages(atStage: string, baseTs: number): ProcessStage[] {
    const atIdx = stageOrder.indexOf(atStage)
    return STAGE_TEMPLATES.map((tpl, idx) => {
      let status: ProcessStage['status'] = 'pending'
      let startedAt: number | undefined
      let completedAt: number | undefined
      let assignee: { id: string; name: string } | undefined

      if (idx < atIdx) {
        status = 'completed'
        startedAt = baseTs - (atIdx - idx) * 3600000 - Math.random() * 1800000
        completedAt = startedAt + (tpl.slaMinutes * 60000 * (0.3 + Math.random() * 0.7))
        assignee = pickName()
      } else if (idx === atIdx) {
        status = 'active'
        startedAt = baseTs - Math.random() * 1800000
        assignee = pickName()
      } else {
        status = 'pending'
      }

      return {
        id: tpl.id,
        name: tpl.name,
        order: tpl.order,
        status,
        slaMinutes: tpl.slaMinutes,
        assignee: assignee ?? (idx === atIdx ? pickName() : undefined),
        startedAt,
        completedAt,
      }
    })
  }

  function generateActivities(stages: ProcessStage[], owner: { id: string; name: string }, baseTs: number): ProcessActivity[] {
    const activities: ProcessActivity[] = []
    const completedStages = stages.filter(s => s.status === 'completed')
    const activeStage = stages.find(s => s.status === 'active')

    completedStages.forEach((stage, idx) => {
      if (stage.startedAt) {
        activities.push({
          id: `act-${items.length}-${idx}-start`,
          type: 'stage_change',
          action: `بدأ مرحلة ${stage.name}`,
          actor: stage.assignee ?? owner,
          timestamp: stage.startedAt,
          details: `تم بدء مرحلة ${stage.name} بواسطة ${stage.assignee?.name ?? owner.name}`,
          stageId: stage.id,
        })
      }
      if (stage.completedAt) {
        activities.push({
          id: `act-${items.length}-${idx}-end`,
          type: 'stage_change',
          action: `اكتملت مرحلة ${stage.name}`,
          actor: stage.assignee ?? owner,
          timestamp: stage.completedAt,
          details: `تم إكمال مرحلة ${stage.name} بنجاح بعد ${Math.round((stage.completedAt - (stage.startedAt ?? stage.completedAt)) / 60000)} دقيقة`,
          stageId: stage.id,
        })
      }
    })

    if (activeStage && activeStage.startedAt) {
      activities.push({
        id: `act-${items.length}-active`,
        type: 'stage_change',
        action: `جاري في مرحلة ${activeStage.name}`,
        actor: activeStage.assignee ?? owner,
        timestamp: activeStage.startedAt,
        details: `المرحلة الحالية: ${activeStage.name} - المسؤول: ${activeStage.assignee?.name ?? owner.name}`,
        stageId: activeStage.id,
      })
    }

    const approvalStages = stages.filter(s =>
      s.id === 'order_approval' && (s.status === 'active' || s.status === 'completed')
    )
    approvalStages.forEach((stage, idx) => {
      if (stage.startedAt) {
        activities.push({
          id: `act-${items.length}-apr-${idx}-req`,
          type: 'approval',
          action: 'طلب اعتماد',
          actor: owner,
          timestamp: stage.startedAt + 60000,
          details: `تم إرسال طلب اعتماد لـ ${stage.name} إلى مدير المبيعات`,
          stageId: stage.id,
        })
      }
    })

    const additionalActivities = [
      {
        type: 'comment' as const,
        action: 'إضافة ملاحظة',
        actor: pickName(),
        timestamp: baseTs - Math.random() * 7200000,
        details: 'تم مراجعة المستندات المرفقة والتأكد من اكتمالها',
      },
      {
        type: 'system' as const,
        action: 'تحديث النظام',
        actor: owner,
        timestamp: baseTs - Math.random() * 3600000,
        details: 'تم تحديث حالة الطلب تلقائياً في نظام ERP',
      },
      {
        type: 'attachment' as const,
        action: 'إرفاق مستند',
        actor: pickName(),
        timestamp: baseTs - Math.random() * 5400000,
        details: 'تم إرفاق نسخة من عرض السعر المعتمد',
      },
    ]

    additionalActivities.forEach((act, idx) => {
      if (Math.random() > 0.4) {
        activities.push({
          id: `act-${items.length}-extra-${idx}`,
          ...act,
          type: act.type,
        })
      }
    })

    return activities.sort((a, b) => b.timestamp - a.timestamp)
  }

  function generateApprovals(stages: ProcessStage[], owner: { id: string; name: string }, baseTs: number): ProcessApproval[] {
    const approvals: ProcessApproval[] = []
    const approvalStage = stages.find(s => s.id === 'order_approval')

    if (approvalStage && (approvalStage.status === 'active' || approvalStage.status === 'completed')) {
      const assignee = pickName()
      const isApproved = approvalStage.status === 'completed'
      approvals.push({
        id: `apr-${items.length}-1`,
        stageId: 'order_approval',
        title: 'اعتماد أمر البيع',
        requestedBy: owner,
        assignedTo: assignee,
        decision: isApproved ? 'approved' : 'pending',
        comments: isApproved
          ? 'تمت الموافقة على العرض بعد مراجعة الشروط والأحكام'
          : 'بانتظار مراجعة مدير المبيعات',
        createdAt: baseTs - 7200000,
        respondedAt: isApproved ? baseTs - 1800000 : undefined,
      })
    }

    if (stages.some(s => s.id === 'payment_collection' && s.status === 'active')) {
      const assignee = pickName()
      approvals.push({
        id: `apr-${items.length}-2`,
        stageId: 'payment_collection',
        title: 'اعتماد تحصيل الدفع',
        requestedBy: owner,
        assignedTo: assignee,
        decision: 'pending',
        comments: 'يرجى التحقق من إتمام الدفع قبل إغلاق الطلب',
        createdAt: baseTs - 3600000,
      })
    }

    return approvals
  }

  function generateLinkedModules(type: string): { label: string; href: string; icon: string }[] {
    const modules: { label: string; href: string; icon: string }[] = []
    if (type === 'عرض سعر' || type === 'أمر بيع') {
      modules.push({ label: 'المالية > حسابات العملاء', href: '/enterprise/financial/accounts', icon: 'Building2' })
      modules.push({ label: 'المخزون > المنتجات', href: '/enterprise/inventory/products', icon: 'Package' })
    }
    if (type === 'أمر بيع') {
      modules.push({ label: 'الشحن > تتبع الشحنات', href: '/enterprise/shipping/tracking', icon: 'Truck' })
    }
    if (type === 'فاتورة') {
      modules.push({ label: 'المالية > حسابات العملاء', href: '/enterprise/financial/accounts', icon: 'Building2' })
      modules.push({ label: 'المالية > الفواتير', href: '/enterprise/financial/invoices', icon: 'Wallet' })
    }
    modules.push({ label: 'المبيعات > التقارير', href: '/enterprise/sales/reports', icon: 'TrendingUp' })
    return modules
  }

  const STAGE_DISTRIBUTION: Array<{ stage: string; count: number }> = [
    { stage: 'quote', count: 4 },
    { stage: 'sales_order', count: 4 },
    { stage: 'order_approval', count: 3 },
    { stage: 'picking', count: 3 },
    { stage: 'shipping', count: 3 },
    { stage: 'invoicing', count: 3 },
    { stage: 'payment_collection', count: 3 },
    { stage: 'completed', count: 2 },
  ]

  for (const dist of STAGE_DISTRIBUTION) {
    for (let i = 0; i < dist.count; i++) {
      const { title, type, refPrefix } = pickTitle()
      const owner = pickName()
      const stages = generateStages(dist.stage, baseTime)
      const activities = generateActivities(stages, owner, baseTime)
      const approvals = generateApprovals(stages, owner, baseTime)
      const linkedModules = generateLinkedModules(type)
      const amount = Math.round((1000 + Math.random() * 99000) / 100) * 100
      const priority = PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)]
      const tags = [pickTag()]
      if (Math.random() > 0.5) tags.push(pickTag())
      const aiRec = AI_RECOMMENDATIONS[Math.floor(Math.random() * AI_RECOMMENDATIONS.length)]

      const activeStage = stages.find(s => s.status === 'active')
      const itemSla = activeStage?.slaMinutes ?? 120

      items.push({
        id: `otc-${items.length + 1}`,
        type,
        title,
        refNumber: `${refPrefix}-${String(2026).slice(-2)}-${String(1000 + Math.floor(Math.random() * 9000))}`,
        priority,
        status: dist.stage === 'completed' ? 'completed' : 'active',
        stages,
        currentStage: dist.stage === 'completed' ? 'payment_collection' : dist.stage,
        approvals,
        activities,
        owner,
        amount,
        currency: 'SAR',
        createdAt: baseTime - Math.random() * 86400000 * 7,
        slaMinutes: itemSla,
        tags,
        linkedModules,
        aiRecommendation: aiRec,
      })
    }
  }

  return items
}

const MOCK_ITEMS = generateMockItems()

function PriorityBadge({ priority }: { priority: ProcessItem['priority'] }) {
  const style = PRIORITY_STYLES[priority]
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', style.className)}>
      {style.label}
    </span>
  )
}

function StageBadge({ stageId }: { stageId: string }) {
  const stageName = STAGE_LABELS[stageId] ?? stageId
  const colorMap: Record<string, string> = {
    quote: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    sales_order: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    order_approval: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    picking: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    shipping: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    invoicing: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    payment_collection: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  }
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', colorMap[stageId] ?? 'bg-gray-100 text-gray-700')}>
      {stageName}
    </span>
  )
}

function SLABadge({ slaMinutes, createdAt }: { slaMinutes: number; createdAt: number }) {
  const sla = calculateSLADisplay(slaMinutes, createdAt)
  const colorMap: Record<string, string> = {
    ok: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    critical: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    breached: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1', colorMap[sla.status])}>
      <Clock className="h-3 w-3" />
      {sla.remainingDisplay}
    </span>
  )
}

export function OrderToCashFlow() {
  const [selectedItem, setSelectedItem] = useState<ProcessItem | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'amount' | 'createdAt' | 'priority'>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [activeTab, setActiveTab] = useState<'pipeline' | 'timeline' | 'approvals' | 'info'>('pipeline')

  const metrics: ProcessFlowMetrics = useMemo(() => {
    const totalItems = MOCK_ITEMS.length
    const activeItems = MOCK_ITEMS.filter(i => i.status === 'active').length
    const completedItems = MOCK_ITEMS.filter(i => i.status === 'completed').length
    const overdueItems = MOCK_ITEMS.filter(i => {
      const activeStage = i.stages.find(s => s.id === i.currentStage)
      if (!activeStage || !activeStage.slaMinutes || !activeStage.startedAt) return false
      const sla = calculateSLADisplay(activeStage.slaMinutes, activeStage.startedAt)
      return sla.isBreached
    }).length
    const totalAmount = MOCK_ITEMS.reduce((sum, i) => sum + (i.amount ?? 0), 0)
    const pendingApprovals = MOCK_ITEMS.reduce((sum, i) => sum + i.approvals.filter(a => a.decision === 'pending').length, 0)
    const avgCompletionTime = completedItems > 0
      ? MOCK_ITEMS.filter(i => i.status === 'completed').reduce((sum, i) => {
          const firstStage = i.stages[0]
          const lastStage = i.stages[i.stages.length - 1]
          if (firstStage?.startedAt && lastStage?.completedAt) {
            return sum + (lastStage.completedAt - firstStage.startedAt)
          }
          return sum
        }, 0) / completedItems
      : 0

    return { totalItems, activeItems, completedItems, overdueItems, avgCompletionTime, totalAmount, pendingApprovals }
  }, [])

  const filteredItems = useMemo(() => {
    let items = [...MOCK_ITEMS]

    if (statusFilter !== 'all') {
      items = items.filter(i => i.currentStage === statusFilter || (statusFilter === 'quote' && i.currentStage === 'quote'))
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.refNumber.toLowerCase().includes(q) ||
        i.owner.name.toLowerCase().includes(q) ||
        i.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    items.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'amount') {
        cmp = (a.amount ?? 0) - (b.amount ?? 0)
      } else if (sortBy === 'createdAt') {
        cmp = a.createdAt - b.createdAt
      } else if (sortBy === 'priority') {
        const order = { critical: 0, high: 1, medium: 2, low: 3 }
        cmp = (order[a.priority] ?? 0) - (order[b.priority] ?? 0)
      }
      return sortDir === 'desc' ? -cmp : cmp
    })

    return items
  }, [statusFilter, searchQuery, sortBy, sortDir])

  const handleStageTransition = (stageId: string, newStatus: 'completed' | 'failed') => {
    if (!selectedItem) return
    const updatedStages = selectedItem.stages.map(s => {
      if (s.id === stageId) {
        return {
          ...s,
          status: newStatus,
          completedAt: newStatus === 'completed' ? Date.now() : undefined,
        }
      }
      if (newStatus === 'completed') {
        const stageIdx = STAGE_TEMPLATES.findIndex(t => t.id === s.id)
        const currentIdx = STAGE_TEMPLATES.findIndex(t => t.id === stageId)
        if (stageIdx === currentIdx + 1) {
          return { ...s, status: 'active' as const, startedAt: Date.now() }
        }
      }
      return s
    })
    const nextStage = STAGE_TEMPLATES.find((_, idx) => {
      const currentIdx = STAGE_TEMPLATES.findIndex(t => t.id === stageId)
      return idx === currentIdx + 1
    })
    const updatedItem: ProcessItem = {
      ...selectedItem,
      stages: updatedStages,
      currentStage: newStatus === 'completed'
        ? (nextStage?.id ?? selectedItem.currentStage)
        : selectedItem.currentStage,
      status: updatedStages.every(s => s.status === 'completed') ? 'completed' : 'active',
    }
    setSelectedItem(updatedItem)
    const idx = MOCK_ITEMS.findIndex(i => i.id === selectedItem.id)
    if (idx >= 0) {
      MOCK_ITEMS[idx] = updatedItem
    }
  }

  const handleApprove = (approvalId: string) => {
    if (!selectedItem) return
    const updatedApprovals = selectedItem.approvals.map(a =>
      a.id === approvalId ? { ...a, decision: 'approved' as const, respondedAt: Date.now() } : a
    )
    const updatedItem = { ...selectedItem, approvals: updatedApprovals }
    setSelectedItem(updatedItem)
    const idx = MOCK_ITEMS.findIndex(i => i.id === selectedItem.id)
    if (idx >= 0) {
      MOCK_ITEMS[idx] = updatedItem
    }
  }

  const handleReject = (approvalId: string) => {
    if (!selectedItem) return
    const updatedApprovals = selectedItem.approvals.map(a =>
      a.id === approvalId ? { ...a, decision: 'rejected' as const, respondedAt: Date.now() } : a
    )
    const updatedItem = { ...selectedItem, approvals: updatedApprovals }
    setSelectedItem(updatedItem)
    const idx = MOCK_ITEMS.findIndex(i => i.id === selectedItem.id)
    if (idx >= 0) {
      MOCK_ITEMS[idx] = updatedItem
    }
  }

  function renderKpiCards() {
    const kpis = [
      {
        label: 'إجمالي المبيعات',
        value: `${(metrics.totalAmount / 1000).toFixed(0)} ألف`,
        sub: `${metrics.totalItems} معاملة`,
        icon: TrendingUp,
        color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30',
      },
      {
        label: 'طلبات نشطة',
        value: metrics.activeItems,
        sub: `${((metrics.activeItems / metrics.totalItems) * 100).toFixed(0)}% من الإجمالي`,
        icon: ShoppingCart,
        color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
      },
      {
        label: 'بانتظار الاعتماد',
        value: metrics.pendingApprovals,
        sub: 'موافقة معلقة',
        icon: AlertTriangle,
        color: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
      },
      {
        label: 'متأخرة عن SLA',
        value: metrics.overdueItems,
        sub: `${metrics.overdueItems > 0 ? `نسبة ${((metrics.overdueItems / metrics.activeItems) * 100).toFixed(0)}%` : 'جميع المعاملات ضمن المدة'}`,
        icon: Clock,
        color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
      },
    ]

    return (
      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon
          return (
            <div key={idx} className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
                <div className={cn('p-2 rounded-lg', kpi.color)}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-bold mb-0.5">{kpi.value}</div>
              <div className="text-[11px] text-muted-foreground">{kpi.sub}</div>
            </div>
          )
        })}
      </div>
    )
  }

  function renderSidebar() {
    return (
      <div className="w-[420px] shrink-0 border-l flex flex-col bg-card">
        <div className="p-4 border-b">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors',
                  statusFilter === f.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-b space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث بالرقم أو العنوان أو المسؤول..."
              className="w-full pr-9 pl-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (sortBy === 'amount') { setSortBy('createdAt'); setSortDir('desc') }
                else if (sortBy === 'createdAt') { setSortBy('priority'); setSortDir('asc') }
                else { setSortBy('amount'); setSortDir('desc') }
              }}
              className="text-xs"
            >
              <ArrowUpDown className="h-3.5 w-3.5 ml-1" />
              {sortBy === 'amount' ? 'المبلغ' : sortBy === 'createdAt' ? 'التاريخ' : 'الأولوية'}
            </Button>
            <button
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className={cn(
                'p-1.5 rounded-lg border text-xs transition-colors',
                sortDir === 'desc' ? 'bg-muted' : 'bg-background'
              )}
            >
              {sortDir === 'desc' ? '↓' : '↑'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">لا توجد نتائج للبحث</p>
            </div>
          ) : (
            filteredItems.map(item => {
              const TypeIcon = TYPE_ICON_MAP[item.type] ?? FileText
              const isSelected = selectedItem?.id === item.id
              const activeStage = item.stages.find(s => s.id === item.currentStage)
              const slaDisplay = activeStage?.slaMinutes && activeStage?.startedAt
                ? calculateSLADisplay(activeStage.slaMinutes, activeStage.startedAt)
                : null

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={cn(
                    'p-4 border-b cursor-pointer transition-all hover:bg-muted/50',
                    isSelected && 'bg-primary/5 border-r-2 border-r-primary'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'p-2 rounded-lg shrink-0',
                      item.type === 'عرض سعر' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                      item.type === 'أمر بيع' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' :
                      'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                    )}>
                      <TypeIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-medium truncate">{item.refNumber}</span>
                        <PriorityBadge priority={item.priority} />
                      </div>
                      <p className="text-sm font-medium truncate mb-1">{item.title}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1.5">
                        <User className="h-3 w-3" />
                        <span className="truncate">{item.owner.name}</span>
                        {item.amount && (
                          <>
                            <span>·</span>
                            <span>{(item.amount).toLocaleString()} {item.currency}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <StageBadge stageId={item.currentStage} />
                        {slaDisplay && (
                          <SLABadge slaMinutes={activeStage!.slaMinutes!} createdAt={activeStage!.startedAt!} />
                        )}
                        {item.tags.map((tag, tidx) => (
                          <span key={tidx} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  function renderDetailPanel() {
    if (!selectedItem) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-muted/10">
          <Eye className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">اختر معاملة من القائمة لعرض التفاصيل</p>
        </div>
      )
    }

    const tabs = [
      { id: 'pipeline' as const, label: 'مسار العمل' },
      { id: 'timeline' as const, label: 'النشاطات' },
      { id: 'approvals' as const, label: 'الموافقات' },
      { id: 'info' as const, label: 'المعلومات' },
    ]

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b bg-card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-bold">{selectedItem.refNumber}</span>
                <PriorityBadge priority={selectedItem.priority} />
              </div>
              <h2 className="text-sm text-muted-foreground">{selectedItem.title}</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>{selectedItem.owner.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <StageBadge stageId={selectedItem.currentStage} />
            <span className="text-xs text-muted-foreground">|</span>
            <span className="text-xs text-muted-foreground">{selectedItem.type}</span>
            {selectedItem.amount && (
              <>
                <span className="text-xs text-muted-foreground">|</span>
                <span className="text-xs font-medium">{(selectedItem.amount).toLocaleString()} {selectedItem.currency}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex border-b bg-card">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2.5 text-xs font-medium transition-colors relative',
                activeTab === tab.id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
            <div className="rounded-xl border bg-card p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">الموافقات</h3>
              {selectedItem.approvals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  لا توجد موافقات مطلوبة حالياً
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

          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">تفاصيل المعاملة</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">رقم المرجع</span>
                    <p className="font-medium">{selectedItem.refNumber}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">النوع</span>
                    <p className="font-medium">{selectedItem.type}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">المسؤول</span>
                    <p className="font-medium">{selectedItem.owner.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">المبلغ</span>
                    <p className="font-medium">{selectedItem.amount?.toLocaleString()} {selectedItem.currency}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">تاريخ الإنشاء</span>
                    <p className="font-medium">{new Date(selectedItem.createdAt).toLocaleString('ar-SA')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">الحالة</span>
                    <p className="font-medium">{selectedItem.status === 'completed' ? 'مكتمل' : 'نشط'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground text-xs">الوسوم</span>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {selectedItem.tags.map((tag, idx) => (
                        <span key={idx} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">الوحدات المرتبطة</h3>
                <div className="space-y-2">
                  {selectedItem.linkedModules.map((mod, idx) => {
                    const ModIcon = ICON_MAP[mod.icon] ?? Building2
                    return (
                      <a
                        key={idx}
                        href={mod.href}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                      >
                        <div className="p-1.5 rounded-lg bg-muted text-muted-foreground group-hover:text-primary transition-colors">
                          <ModIcon className="h-4 w-4" />
                        </div>
                        <span className="text-sm group-hover:text-primary transition-colors">{mod.label}</span>
                      </a>
                    )
                  })}
                </div>
              </div>

              {selectedItem.aiRecommendation && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-primary">توصية الذكاء الاصطناعي</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{selectedItem.aiRecommendation}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl border bg-card p-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">الوحدات الأخرى</h3>
                <div className="grid grid-cols-3 gap-3">
                  <a
                    href="/enterprise/financial/accounts"
                    className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                  >
                    <Building2 className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-xs group-hover:text-primary transition-colors">المالية &gt; حسابات العملاء</span>
                  </a>
                  <a
                    href="/enterprise/inventory/products"
                    className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                  >
                    <Package className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-xs group-hover:text-primary transition-colors">المخزون &gt; المنتجات</span>
                  </a>
                  <a
                    href="/enterprise/shipping/tracking"
                    className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                  >
                    <Truck className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-xs group-hover:text-primary transition-colors">الشحن &gt; تتبع الشحنات</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-0 space-y-4">
        <EnterpriseBreadcrumbs
          items={[
            { label: 'المبيعات', href: '/enterprise/sales' },
            { label: 'دورة الطلب إلى النقد' },
          ]}
        />
        <div>
          <h1 className="text-2xl font-bold">دورة الطلب إلى النقد</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة ومتابعة دورة حياة المبيعات من عرض السعر إلى تحصيل الدفع
          </p>
        </div>
        {renderKpiCards()}
      </div>
      <div className="flex flex-1 mt-4 overflow-hidden border-t">
        {renderSidebar()}
        {renderDetailPanel()}
      </div>
    </div>
  )
}
