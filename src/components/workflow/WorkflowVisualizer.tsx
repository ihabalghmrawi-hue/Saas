'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  CheckCircle2, Circle, Clock, AlertTriangle, XCircle, SkipForward,
  ArrowDown, User, ChevronLeft, Loader2,
} from 'lucide-react'
import type { WorkflowInstance, WorkflowStep, StepStatus } from '@/lib/workflow/types'
import { calculateSLADisplay } from '@/lib/workflow/engine'
import { SLAIndicator } from './SLAIndicator'

const STATUS_ICONS: Record<StepStatus, typeof Circle> = {
  pending: Circle,
  in_progress: Loader2,
  completed: CheckCircle2,
  skipped: SkipForward,
  failed: XCircle,
  escalated: AlertTriangle,
}

const STATUS_COLORS: Record<StepStatus, string> = {
  pending: 'text-muted-foreground border-muted-foreground/30',
  in_progress: 'text-primary border-primary',
  completed: 'text-success border-success',
  skipped: 'text-muted-foreground/50 border-muted-foreground/20',
  failed: 'text-destructive border-destructive',
  escalated: 'text-warning border-warning',
}

const TYPE_LABELS: Record<string, string> = {
  approval: 'اعتماد',
  task: 'مهمة',
  notification: 'إشعار',
  condition: 'شرط',
  sub_process: 'عملية فرعية',
  escalation: 'تصعيد',
}

interface WorkflowVisualizerProps {
  instance: WorkflowInstance
  onStepClick?: (step: WorkflowStep) => void
  onTransition?: (stepId: string, status: StepStatus) => void
  readOnly?: boolean
  compact?: boolean
}

export function WorkflowVisualizer({ instance, onStepClick, onTransition, readOnly = false, compact = false }: WorkflowVisualizerProps) {
  const { steps, status } = instance

  const progressPct = useMemo(() => {
    const completed = steps.filter(s => s.status === 'completed' || s.status === 'skipped').length
    return steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0
  }, [steps])

  return (
    <div className={cn('space-y-1', compact && 'space-y-0')}>
      {/* Progress header */}
      {!compact && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden w-48">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', status === 'completed' ? 'bg-success' : 'bg-primary')}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-muted-foreground font-medium">{progressPct}%</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{steps.filter(s => s.status === 'in_progress' || s.status === 'pending').length} متبقي</span>
          </div>
        </div>
      )}

      {/* Pipeline */}
      <div className="relative">
        {/* Vertical connector line */}
        <div className="absolute right-[15px] top-0 bottom-0 w-px bg-border hidden sm:block" />

        <div className="space-y-3">
          {steps.map((step, idx) => {
            const Icon = STATUS_ICONS[step.status]
            const isActive = step.status === 'in_progress'
            const isPending = step.status === 'pending'
            const slaDisplay = step.slaMinutes ? calculateSLADisplay(step.slaMinutes, step.startTime ?? instance.createdAt) : null

            return (
              <button
                key={step.id}
                onClick={() => onStepClick?.(step)}
                disabled={readOnly}
                className={cn(
                  'w-full flex items-start gap-3 p-3 rounded-xl border-2 transition-all text-right group',
                  'hover:bg-accent/50',
                  isActive ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent bg-card',
                  isPending && 'opacity-60',
                  step.status === 'completed' && 'bg-success/5',
                  step.status === 'failed' && 'bg-destructive/5 border-destructive/30',
                )}
              >
                {/* Status indicator */}
                <div className={cn('relative z-10 mt-0.5', STATUS_COLORS[step.status])}>
                  <Icon className={cn('h-5 w-5', isActive && 'animate-spin')} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-medium', isActive && 'text-primary')}>
                        {step.name}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] bg-muted rounded text-muted-foreground">
                        {TYPE_LABELS[step.type]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {slaDisplay && <SLAIndicator sla={slaDisplay} size="sm" />}
                      {step.assignee && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span className="hidden sm:inline">{step.assignee.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dependencies */}
                  {step.dependsOn.length > 0 && !compact && (
                    <div className="flex items-center gap-1 mt-1">
                      {step.dependsOn.map(depId => {
                        const dep = steps.find(s => s.id === depId)
                        return (
                          <span key={depId} className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded',
                            dep?.status === 'completed' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                          )}>
                            ← {dep?.name ?? depId}
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {/* Action buttons for in_progress steps */}
                  {isActive && !readOnly && onTransition && (
                    <div className="flex items-center gap-1 mt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onTransition(step.id, 'completed') }}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-success text-white rounded-lg hover:bg-success/90 transition-colors"
                      >
                        <CheckCircle2 className="h-3 w-3" /> إكمال
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onTransition(step.id, 'failed') }}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
                      >
                        <XCircle className="h-3 w-3" /> فشل
                      </button>
                    </div>
                  )}
                </div>

                <ChevronLeft className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
