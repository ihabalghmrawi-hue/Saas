'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Clock, CheckCircle2, XCircle, AlertTriangle, User, ArrowRight,
  MessageSquare, Paperclip, MoreHorizontal, Play, Pause, Ban,
} from 'lucide-react'
import type { WorkflowInstance, WorkflowEvent, WorkflowStep, StepStatus } from '@/lib/workflow/types'
import { calculateSLADisplay, findNextExecutableSteps } from '@/lib/workflow/engine'
import { WorkflowVisualizer } from './WorkflowVisualizer'
import { ApprovalChain } from './ApprovalChain'
import { SLAIndicator } from './SLAIndicator'

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: 'مسودة', className: 'bg-muted text-muted-foreground' },
  active: { label: 'نشط', className: 'bg-primary/10 text-primary' },
  paused: { label: 'متوقف', className: 'bg-warning/10 text-warning' },
  completed: { label: 'مكتمل', className: 'bg-success/10 text-success' },
  cancelled: { label: 'ملغي', className: 'bg-destructive/10 text-destructive' },
  failed: { label: 'فاشل', className: 'bg-destructive/10 text-destructive' },
}

const EVENT_ICONS: Record<string, typeof Clock> = {
  started: Play, step_completed: CheckCircle2, step_failed: XCircle,
  approved: CheckCircle2, rejected: XCircle, escalated: AlertTriangle,
  delegated: User, paused: Pause, cancelled: Ban, sla_breach: AlertTriangle,
  reminder: Clock, comment_added: MessageSquare, attachment_added: Paperclip,
}

const EVENT_LABELS: Record<string, string> = {
  started: 'بدأت العملية', step_completed: 'اكتملت خطوة',
  step_failed: 'فشلت خطوة', approved: 'تمت الموافقة',
  rejected: 'تم الرفض', escalated: 'تم التصعيد',
  delegated: 'تم التفويض', paused: 'تم الإيقاف',
  cancelled: 'ألغيت', sla_breach: 'تجاوز SLA',
  reminder: 'تذكير', comment_added: 'أضاف تعليق',
  attachment_added: 'أضاف مرفق',
}

interface WorkflowEngineProps {
  instance: WorkflowInstance
  events: WorkflowEvent[]
  onTransition?: (stepId: string, status: StepStatus) => void
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
  onApprove?: (requestId: string) => void
  onReject?: (requestId: string) => void
}

export function WorkflowEngine({ instance, events, onTransition, onPause, onResume, onCancel, onApprove, onReject }: WorkflowEngineProps) {
  const [activeSection, setActiveSection] = useState<'pipeline' | 'timeline' | 'info'>('pipeline')
  const statusBadge = STATUS_BADGES[instance.status]
  const slaDisplay = calculateSLADisplay(60, instance.createdAt)
  const nextSteps = useMemo(() => findNextExecutableSteps(instance), [instance])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{instance.name}</h1>
              <span className={cn('px-2 py-0.5 text-xs rounded-full font-medium', statusBadge?.className)}>
                {statusBadge?.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">تم الإنشاء {new Date(instance.createdAt).toLocaleString('ar-SA')}</p>
          </div>
          <div className="flex items-center gap-2">
            <SLAIndicator sla={slaDisplay} />
            {instance.status === 'active' && (
              <>
                <button onClick={onPause} className="p-2 hover:bg-accent rounded-lg"><Pause className="h-4 w-4" /></button>
                <button onClick={onCancel} className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg"><Ban className="h-4 w-4" /></button>
              </>
            )}
            {instance.status === 'paused' && (
              <button onClick={onResume} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg">
                <Play className="h-4 w-4" /> استئناف
              </button>
            )}
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-1">
          {[
            { id: 'pipeline' as const, label: ' pipeline', icon: ArrowRight },
            { id: 'timeline' as const, label: 'الأحداث', icon: Clock },
            { id: 'info' as const, label: 'معلومات', icon: User },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                activeSection === tab.id ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeSection === 'pipeline' && (
          <div className="max-w-3xl space-y-6">
            {/* Next actions hint */}
            {nextSteps.length > 0 && instance.status === 'active' && (
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm">
                <span className="font-medium text-primary">الخطوات التالية:</span>
                <div className="flex items-center gap-2 mt-1">
                  {nextSteps.map(s => (
                    <span key={s.id} className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-lg">{s.name}</span>
                  ))}
                </div>
              </div>
            )}

            <WorkflowVisualizer
              instance={instance}
              onTransition={onTransition}
              onStepClick={() => {}}
            />

            {/* Approval chain if any approval steps exist */}
            {instance.steps.some(s => s.type === 'approval') && (
              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold text-sm mb-3">سلسلة الاعتماد</h3>
                <ApprovalChain
                  requests={[]}
                  onApprove={onApprove}
                  onReject={onReject}
                  compact
                />
              </div>
            )}
          </div>
        )}

        {activeSection === 'timeline' && (
          <div className="max-w-2xl space-y-2">
            {events.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>لا توجد أحداث بعد</p>
              </div>
            )}
            {events.slice().reverse().map(event => {
              const Icon = EVENT_ICONS[event.type] || Clock
              return (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{EVENT_LABELS[event.type] || event.type}</span>
                      <span className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString('ar-SA')}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{event.userName}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeSection === 'info' && (
          <div className="max-w-md space-y-4">
            <div className="bg-muted/20 rounded-xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">المالك</span>
                <span className="font-medium">{instance.owner.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الأولوية</span>
                <span className={cn('font-medium', instance.priority === 'high' || instance.priority === 'critical' ? 'text-destructive' : '')}>
                  {instance.priority === 'critical' ? 'حرجة' : instance.priority === 'high' ? 'عالية' : instance.priority === 'medium' ? 'متوسطة' : 'منخفضة'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">تاريخ الإنشاء</span>
                <span>{new Date(instance.createdAt).toLocaleString('ar-SA')}</span>
              </div>
              {instance.completedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">تاريخ الإكمال</span>
                  <span>{new Date(instance.completedAt).toLocaleString('ar-SA')}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الخطوات</span>
                <span>{instance.steps.filter(s => s.status === 'completed').length}/{instance.steps.length} مكتملة</span>
              </div>
            </div>

            {instance.tags.length > 0 && (
              <div className="flex items-center gap-2">
                {instance.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 text-xs bg-muted rounded-full">{tag}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
