'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  CheckCircle2, Circle, Loader2, AlertTriangle, XCircle, SkipForward,
  Clock, User, ArrowLeft,
} from 'lucide-react'
import type { ProcessItem, ProcessStage } from '@/lib/process/types'
import { calculateSLADisplay } from '@/lib/workflow/engine'
import { SLAIndicator } from '@/components/workflow/SLAIndicator'

interface ProcessPipelineProps {
  item: ProcessItem
  onStageTransition?: (stageId: string, newStatus: 'completed' | 'failed') => void
}

const STATUS_ICONS = {
  pending: Circle,
  active: Loader2,
  completed: CheckCircle2,
  skipped: SkipForward,
  failed: XCircle,
}

const STATUS_COLORS = {
  pending: 'text-muted-foreground border-muted-foreground/30',
  active: 'text-primary border-primary',
  completed: 'text-success border-success/30',
  skipped: 'text-muted-foreground/50 border-muted-foreground/10',
  failed: 'text-destructive border-destructive/30',
}

export function ProcessPipeline({ item, onStageTransition }: ProcessPipelineProps) {
  const slas = useMemo(() => {
    return item.stages.reduce<Record<string, ReturnType<typeof calculateSLADisplay>>>((acc, stage) => {
      if (stage.slaMinutes && stage.startedAt) {
        acc[stage.id] = calculateSLADisplay(stage.slaMinutes, stage.startedAt)
      }
      return acc
    }, {})
  }, [item.stages])

  const currentIdx = item.stages.findIndex((s) => s.id === item.currentStage)

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-medium text-muted-foreground">مراحل سير العمل</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>إجمالي SLA: {item.slaMinutes} دقيقة</span>
        </div>
      </div>

      <div className="relative">
        <div className="absolute right-[19px] top-0 bottom-0 w-0.5 bg-muted-foreground/20" />

        <div className="space-y-6">
          {item.stages.map((stage, idx) => {
            const Icon = STATUS_ICONS[stage.status]
            const color = STATUS_COLORS[stage.status]
            const sla = stage.id ? slas[stage.id] : undefined
            const isCurrent = stage.id === item.currentStage
            const isPast = idx < currentIdx
            const isFuture = idx > currentIdx

            return (
              <div key={stage.id} className="relative pr-10">
                <div className={cn(
                  'absolute right-0 top-1 flex items-center justify-center w-9 h-9 rounded-full border-2 bg-background transition-all',
                  color,
                  isCurrent && 'ring-2 ring-primary/20 ring-offset-2',
                )}>
                  <Icon className={cn('h-4 w-4', isCurrent && 'animate-spin')} />
                </div>

                <div className={cn(
                  'rounded-lg border p-4 transition-all',
                  isCurrent && 'border-primary/30 bg-primary/5 shadow-sm',
                  isPast && 'border-success/20 bg-success/5',
                  isFuture && 'border-muted bg-muted/30 opacity-60',
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'font-medium text-sm',
                        isCurrent && 'text-primary',
                        isPast && 'text-success',
                        isFuture && 'text-muted-foreground',
                      )}>
                        {stage.name}
                      </span>
                      {stage.status === 'completed' && (
                        <span className="text-[10px] text-success bg-success/10 px-1.5 py-0.5 rounded-full">
                          مكتمل
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          جاري
                        </span>
                      )}
                    </div>

                    {stage.assignee && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{stage.assignee.name}</span>
                      </div>
                    )}
                  </div>

                  {sla && stage.status !== 'completed' && stage.status !== 'skipped' && (
                    <div className="mb-2">
                      <SLAIndicator sla={sla} size="sm" />
                    </div>
                  )}

                  {stage.startedAt && (
                    <div className="text-[11px] text-muted-foreground">
                      {stage.status === 'completed' && stage.completedAt
                        ? `اكتملت في ${new Date(stage.completedAt).toLocaleString('ar-SA')}`
                        : `بدأت في ${new Date(stage.startedAt).toLocaleString('ar-SA')}`
                      }
                    </div>
                  )}

                  {isCurrent && onStageTransition && (
                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      <button
                        onClick={() => onStageTransition(stage.id, 'completed')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-success text-success-foreground hover:bg-success/90 transition-colors"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        إكمال المرحلة
                      </button>
                      <button
                        onClick={() => onStageTransition(stage.id, 'failed')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        تعليم كفشل
                      </button>
                    </div>
                  )}

                  {idx < item.stages.length - 1 && (
                    <div className="absolute -bottom-3 right-[15px] z-10">
                      <div className="w-8 h-8 rounded-full bg-background border border-muted-foreground/20 flex items-center justify-center">
                        <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
