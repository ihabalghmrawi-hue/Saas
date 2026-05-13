'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  AlertTriangle, RefreshCw, RotateCcw, CheckCircle2, XCircle, Clock,
  Search, Filter, FileText, Play, SkipForward, Ban, User,
  ChevronDown, ChevronUp, AlertCircle, Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface FailedWorkflow {
  id: string
  name: string
  type: string
  currentStep: string
  errorMessage: string
  failureTimestamp: number
  retryCount: number
  maxRetries: number
  status: 'failed' | 'stuck' | 'escalated'
  assignee: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  suggestedResolution: string
  history: WorkflowHistoryEntry[]
}

interface WorkflowHistoryEntry {
  step: string
  status: string
  timestamp: number
  actor: string
  duration: string
  error?: string
}

const MOCK_FAILED_WORKFLOWS: FailedWorkflow[] = [
  {
    id: 'wf-0001', name: 'اعتماد فاتورة مشتريات', type: 'procure-to-pay',
    currentStep: 'الموافقة المالية', errorMessage: 'تعذر الاتصال بنظام الحسابات - مهلة الاتصال منتهية',
    failureTimestamp: Date.now() - 3600000, retryCount: 3, maxRetries: 5,
    status: 'failed', assignee: 'محاسبة', priority: 'high',
    suggestedResolution: 'التحقق من اتصال نظام الحسابات وإعادة المحاولة. قد يكون الخادم متوقفاً.',
    history: [
      { step: 'إنشاء طلب شراء', status: 'completed', timestamp: Date.now() - 7200000, actor: 'أحمد محمد', duration: '5 دقائق' },
      { step: 'الموافقة المبدئية', status: 'completed', timestamp: Date.now() - 6000000, actor: 'مشرف المشتريات', duration: '20 دقيقة' },
      { step: 'الموافقة المالية', status: 'failed', timestamp: Date.now() - 3600000, actor: 'محاسبة', duration: 'ساعتان', error: 'تعذر الاتصال بنظام الحسابات - مهلة الاتصال منتهية' },
    ],
  },
  {
    id: 'wf-0002', name: 'تحويل مخزون', type: 'inventory',
    currentStep: 'تحديث المخزون', errorMessage: 'الكمية المطلوبة غير متوفرة في المخزون',
    failureTimestamp: Date.now() - 7200000, retryCount: 2, maxRetries: 3,
    status: 'stuck', assignee: 'مستودع', priority: 'medium',
    suggestedResolution: 'مراجعة رصيد المخزون للمادة المطلوبة. قد تحتاج إلى تدوين استلام إضافي.',
    history: [
      { step: 'التحقق من المخزون', status: 'completed', timestamp: Date.now() - 10800000, actor: 'نظام', duration: '1 دقيقة' },
      { step: 'طلب تحويل', status: 'completed', timestamp: Date.now() - 9000000, actor: 'فهد العتيبي', duration: '15 دقيقة' },
      { step: 'تحديث المخزون', status: 'failed', timestamp: Date.now() - 7200000, actor: 'نظام', duration: '30 دقيقة', error: 'الكمية المطلوبة غير متوفرة' },
    ],
  },
  {
    id: 'wf-0003', name: 'اعتماد أمر صرف', type: 'approval',
    currentStep: 'اعتماد المدير المالي', errorMessage: 'تم تجاوز مدة SLA - تم التصعيد تلقائياً',
    failureTimestamp: Date.now() - 14400000, retryCount: 0, maxRetries: 2,
    status: 'escalated', assignee: 'المدير المالي', priority: 'critical',
    suggestedResolution: 'تم التصعيد إلى المستوى الثاني. يرجى مراجعة طلب الاعتماد بشكل عاجل.',
    history: [
      { step: 'إنشاء الأمر', status: 'completed', timestamp: Date.now() - 18000000, actor: 'نورة عبدالله', duration: '3 دقائق' },
      { step: 'اعتماد الرئيس المباشر', status: 'completed', timestamp: Date.now() - 16000000, actor: 'ماجد الحربي', duration: '4 ساعات' },
      { step: 'اعتماد المدير المالي', status: 'failed', timestamp: Date.now() - 14400000, actor: 'المدير المالي', duration: '24 ساعة', error: 'تم تجاوز SLA' },
    ],
  },
  {
    id: 'wf-0004', name: 'مطابقة فاتورة', type: 'procure-to-pay',
    currentStep: 'مطابقة الكميات', errorMessage: 'تباين في الكميات بين الفاتورة وأمر الشراء',
    failureTimestamp: Date.now() - 5400000, retryCount: 1, maxRetries: 3,
    status: 'failed', assignee: 'محاسبة', priority: 'high',
    suggestedResolution: 'مقارنة بنود الفاتورة مع أمر الشراء. قد تكون هناك كميات إضافية في الفاتورة.',
    history: [
      { step: 'استلام الفاتورة', status: 'completed', timestamp: Date.now() - 9000000, actor: 'ريم الشهري', duration: '10 دقائق' },
      { step: 'مطابقة الكميات', status: 'failed', timestamp: Date.now() - 5400000, actor: 'نظام', duration: 'ساعة', error: 'تباين في الكميات (+5 وحدات)' },
    ],
  },
  {
    id: 'wf-0005', name: 'تسوية بنكية', type: 'reconciliation',
    currentStep: 'تسوية الحركات', errorMessage: 'فشل في تحميل كشف الحساب البنكي - تنسيق ملف غير مدعوم',
    failureTimestamp: Date.now() - 1800000, retryCount: 0, maxRetries: 2,
    status: 'failed', assignee: 'خزينة', priority: 'low',
    suggestedResolution: 'تصدير كشف الحساب البنكي بصيغة CSV أو PDF مدعومة. التنسيق الحالي غير معروف.',
    history: [
      { step: 'رفع كشف الحساب', status: 'completed', timestamp: Date.now() - 3600000, actor: 'سارة خالد', duration: '5 دقائق' },
      { step: 'تسوية الحركات', status: 'failed', timestamp: Date.now() - 1800000, actor: 'نظام', duration: '30 دقيقة', error: 'تنسيق ملف غير مدعوم' },
    ],
  },
  {
    id: 'wf-0006', name: 'صرف رواتب', type: 'payroll',
    currentStep: 'اعتماد كشوف الرواتب', errorMessage: 'تباين في إجمالي المبلغ - يتجاوز حد الاعتماد التلقائي',
    failureTimestamp: Date.now() - 28800000, retryCount: 0, maxRetries: 1,
    status: 'stuck', assignee: 'موارد بشرية', priority: 'critical',
    suggestedResolution: 'إجمالي الرواتب يتجاوز حد الاعتماد التلقائي. يرجى الحصول على موافقة الإدارة العليا.',
    history: [
      { step: 'حساب الرواتب', status: 'completed', timestamp: Date.now() - 36000000, actor: 'نظام', duration: 'ساعتان' },
      { step: 'التدقيق الداخلي', status: 'completed', timestamp: Date.now() - 32400000, actor: 'موارد بشرية', duration: 'ساعة' },
      { step: 'اعتماد كشوف الرواتب', status: 'failed', timestamp: Date.now() - 28800000, actor: 'مدير مالي', duration: '8 ساعات', error: 'إجمالي المبلغ يتجاوز الحد' },
    ],
  },
  {
    id: 'wf-0007', name: 'أمر شراء عاجل', type: 'procure-to-pay',
    currentStep: 'الموافقة على أمر الشراء', errorMessage: 'الموافقة معلقة - في انتظار رد المسؤول',
    failureTimestamp: Date.now() - 43200000, retryCount: 5, maxRetries: 5,
    status: 'stuck', assignee: 'مدير المشتريات', priority: 'high',
    suggestedResolution: 'تم استنفاذ جميع محاولات إعادة المحاولة. يرجى التواصل مع المسؤول مباشرة.',
    history: [
      { step: 'إنشاء أمر الشراء', status: 'completed', timestamp: Date.now() - 50400000, actor: 'أحمد محمد', duration: '10 دقائق' },
      { step: 'التحقق من الاعتماد', status: 'completed', timestamp: Date.now() - 46800000, actor: 'نظام', duration: '5 دقائق' },
      { step: 'الموافقة على أمر الشراء', status: 'failed', timestamp: Date.now() - 43200000, actor: 'مدير المشتريات', duration: 'يومان', error: 'في انتظار رد المسؤول' },
    ],
  },
  {
    id: 'wf-0008', name: 'تحديث أسعار المنتجات', type: 'custom',
    currentStep: 'تطبيق الأسعار الجديدة', errorMessage: 'تعذر تحديث الأسعار - خطأ في قاعدة البيانات',
    failureTimestamp: Date.now() - 900000, retryCount: 1, maxRetries: 2,
    status: 'failed', assignee: 'مبيعات', priority: 'medium',
    suggestedResolution: 'التحقق من اتصال قاعدة البيانات وإعادة المحاولة. قد يكون هناك تعارض في المفتاح الفريد.',
    history: [
      { step: 'رفع قائمة الأسعار', status: 'completed', timestamp: Date.now() - 1800000, actor: 'سارة خالد', duration: '15 دقيقة' },
      { step: 'تطبيق الأسعار الجديدة', status: 'failed', timestamp: Date.now() - 900000, actor: 'نظام', duration: '15 دقيقة', error: 'خطأ في قاعدة البيانات - مفتاح مكرر' },
    ],
  },
  {
    id: 'wf-0009', name: 'إعادة تقييم العملاء', type: 'order-to-cash',
    currentStep: 'تحديث حدود الائتمان', errorMessage: 'تعذر الاتصال بخدمة تقييم الائتمان الخارجية',
    failureTimestamp: Date.now() - 21600000, retryCount: 2, maxRetries: 4,
    status: 'escalated', assignee: 'إدارة الائتمان', priority: 'high',
    suggestedResolution: 'خدمة تقييم الائتمان الخارجية غير متوفرة. يرجى المحاولة لاحقاً أو استخدام التقييم اليدوي.',
    history: [
      { step: 'جلب بيانات العملاء', status: 'completed', timestamp: Date.now() - 25200000, actor: 'نظام', duration: '10 دقائق' },
      { step: 'تحديث حدود الائتمان', status: 'failed', timestamp: Date.now() - 21600000, actor: 'نظام', duration: 'ساعة', error: 'خدمة التقييم الخارجية غير متوفرة' },
    ],
  },
  {
    id: 'wf-0010', name: 'إغلاق الفترة المالية', type: 'financial-close',
    currentStep: 'ترحيل قيود الإقفال', errorMessage: 'فشل الترحيل - ميزان المراجعة غير متوازن',
    failureTimestamp: Date.now() - 43200000, retryCount: 0, maxRetries: 1,
    status: 'failed', assignee: 'محاسبة', priority: 'critical',
    suggestedResolution: 'ميزان المراجعة غير متوازن. يرجى مراجعة قيود اليومية والتأكد من تساوي المدين والدائن.',
    history: [
      { step: 'جرد الحسابات', status: 'completed', timestamp: Date.now() - 57600000, actor: 'محاسبة', duration: '4 ساعات' },
      { step: 'تسوية الحسابات', status: 'completed', timestamp: Date.now() - 50400000, actor: 'محاسبة', duration: 'ساعتان' },
      { step: 'ترحيل قيود الإقفال', status: 'failed', timestamp: Date.now() - 43200000, actor: 'نظام', duration: '8 ساعات', error: 'ميزان المراجعة غير متوازن - الفرق 15230 ريال' },
    ],
  },
]

const STATUS_FILTERS = [
  { value: 'all', label: 'الكل' },
  { value: 'failed', label: 'فاشل' },
  { value: 'stuck', label: 'معلق' },
  { value: 'escalated', label: 'تم التصعيد' },
]

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

const STATUS_STYLES: Record<string, 'destructive' | 'warning' | 'default'> = {
  failed: 'destructive',
  stuck: 'warning',
  escalated: 'default',
}

const STATUS_LABELS: Record<string, string> = {
  failed: 'فاشل',
  stuck: 'معلق',
  escalated: 'تم التصعيد',
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `منذ ${mins} دقيقة`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `منذ ${hours} ساعة`
  const days = Math.floor(hours / 24)
  return `منذ ${days} يوم`
}

export function WorkflowRecoveryTool() {
  const [workflows] = useState(MOCK_FAILED_WORKFLOWS)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: string } | null>(null)

  const filteredWorkflows = useMemo(() => {
    let result = [...workflows]
    if (statusFilter !== 'all') {
      result = result.filter(w => w.status === statusFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(w =>
        w.name.toLowerCase().includes(q) ||
        w.id.toLowerCase().includes(q) ||
        w.currentStep.toLowerCase().includes(q) ||
        w.errorMessage.toLowerCase().includes(q)
      )
    }
    result.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99))
    return result
  }, [workflows, searchQuery, statusFilter])

  function handleAction(workflowId: string, action: string) {
    setConfirmAction({ id: workflowId, action })
  }

  function confirmDestructiveAction() {
    setConfirmAction(null)
  }

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-destructive/10 p-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">استعادة سير العمل</h2>
            <p className="text-sm text-muted-foreground">إدارة ومعالجة سير العمل الفاشلة والمعلقة</p>
          </div>
        </div>
        <Button variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          إعادة المحاولة للكل
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث في سير العمل..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          options={STATUS_FILTERS}
          className="w-36"
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'المجموع', count: workflows.length, icon: FileText, color: 'text-foreground' },
          { label: 'فاشل', count: workflows.filter(w => w.status === 'failed').length, icon: XCircle, color: 'text-destructive' },
          { label: 'معلق', count: workflows.filter(w => w.status === 'stuck').length, icon: Clock, color: 'text-warning' },
          { label: 'تم التصعيد', count: workflows.filter(w => w.status === 'escalated').length, icon: AlertTriangle, color: 'text-orange-500' },
        ].map((stat, idx) => (
          <Card key={idx}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <stat.icon className={cn('h-5 w-5', stat.color)} />
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stat.count}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredWorkflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <CheckCircle2 className="h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">لا توجد نتائج</h3>
          <p className="text-sm text-muted-foreground">لم يتم العثور على سير عمل مطابقة لمعايير البحث</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWorkflows.map(wf => (
            <Card key={wf.id} className={cn(
              'transition-all',
              wf.priority === 'critical' && 'border-destructive/50',
              wf.priority === 'high' && 'border-orange-200',
            )}>
              <CardContent className="p-0">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpand(wf.id)}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className={cn(
                      'rounded-lg p-2',
                      wf.priority === 'critical' ? 'bg-destructive/10' :
                      wf.priority === 'high' ? 'bg-orange-50' :
                      'bg-muted'
                    )}>
                      {wf.priority === 'critical' ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : wf.priority === 'high' ? (
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                      ) : (
                        <Info className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">{wf.name}</span>
                        <Badge variant={STATUS_STYLES[wf.status]}>
                          {STATUS_LABELS[wf.status]}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {wf.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{wf.id}</span>
                        <span>•</span>
                        <span>{wf.currentStep}</span>
                        <span>•</span>
                        <span>{formatTime(wf.failureTimestamp)}</span>
                        <span>•</span>
                        <span>محاولات: {wf.retryCount}/{wf.maxRetries}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={e => { e.stopPropagation(); handleAction(wf.id, 'retry') }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      إعادة المحاولة
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={e => { e.stopPropagation(); handleAction(wf.id, 'skip') }}
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                      تخطي
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                      onClick={e => { e.stopPropagation(); toggleExpand(wf.id) }}
                    >
                      {expandedId === wf.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {expandedId === wf.id && (
                  <div className="border-t px-4 py-4 space-y-4 animate-fade-in">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">معلومات سير العمل</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">المعرف</span>
                            <span className="font-mono">{wf.id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">المسؤول</span>
                            <span>{wf.assignee}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">الأولوية</span>
                            <span className={cn(
                              'font-medium',
                              wf.priority === 'critical' && 'text-destructive',
                              wf.priority === 'high' && 'text-orange-500',
                            )}>
                              {wf.priority === 'critical' ? 'حرجة' : wf.priority === 'high' ? 'عالية' : wf.priority === 'medium' ? 'متوسطة' : 'منخفضة'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">الخطوة الحالية</span>
                            <span>{wf.currentStep}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">الحل المقترح</h4>
                        <div className="p-3 bg-muted rounded-lg text-sm text-foreground">
                          {wf.suggestedResolution}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">سجل التنفيذ</h4>
                      <div className="space-y-2">
                        {wf.history.map((entry, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                            <div className={cn(
                              'rounded-full p-1 mt-0.5',
                              entry.status === 'completed' ? 'bg-success/10' :
                              entry.status === 'failed' ? 'bg-destructive/10' :
                              'bg-muted'
                            )}>
                              {entry.status === 'completed' ? (
                                <CheckCircle2 className="h-3 w-3 text-success" />
                              ) : entry.status === 'failed' ? (
                                <XCircle className="h-3 w-3 text-destructive" />
                              ) : (
                                <Clock className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-foreground">{entry.step}</span>
                                <span className="text-xs text-muted-foreground">{entry.duration}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span>{entry.actor}</span>
                                <span>•</span>
                                <span>{formatTime(entry.timestamp)}</span>
                              </div>
                              {entry.error && (
                                <div className="mt-1.5 p-2 bg-destructive/5 rounded text-xs text-destructive">
                                  {entry.error}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleAction(wf.id, 'retry')}>
                          <RefreshCw className="h-3.5 w-3.5" />
                          إعادة المحاولة
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleAction(wf.id, 'skip')}>
                          <SkipForward className="h-3.5 w-3.5" />
                          تخطي الخطوة
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => handleAction(wf.id, 'cancel')}>
                          <Ban className="h-3.5 w-3.5" />
                          إلغاء سير العمل
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleAction(wf.id, 'reassign')}>
                          <User className="h-3.5 w-3.5" />
                          إعادة التوجيه
                        </Button>
                      </div>
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => toggleExpand(wf.id)}>
                        طي
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
          <div className="relative bg-background border rounded-xl shadow-2xl p-6 max-w-md w-full mx-4" dir="rtl">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-destructive/10 p-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <h3 className="text-lg font-bold text-foreground">تأكيد الإجراء</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {confirmAction.action === 'retry' && 'هل أنت متأكد من إعادة محاولة هذه الخطوة؟'}
              {confirmAction.action === 'skip' && 'هل أنت متأكد من تخطي هذه الخطوة؟ قد يؤثر ذلك على سلامة سير العمل.'}
              {confirmAction.action === 'cancel' && 'هل أنت متأكد من إلغاء سير العمل بالكامل؟ هذا الإجراء لا يمكن التراجع عنه.'}
              {confirmAction.action === 'reassign' && 'هل أنت متأكد من إعادة توجيه سير العمل إلى مستخدم آخر؟'}
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmAction(null)}>
                إلغاء
              </Button>
              <Button
                variant={confirmAction.action === 'cancel' ? 'destructive' : 'default'}
                onClick={confirmDestructiveAction}
              >
                {confirmAction.action === 'retry' && 'إعادة المحاولة'}
                {confirmAction.action === 'skip' && 'تخطي'}
                {confirmAction.action === 'cancel' && 'إلغاء'}
                {confirmAction.action === 'reassign' && 'إعادة توجيه'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
