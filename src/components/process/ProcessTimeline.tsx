'use client'

import { cn } from '@/lib/utils'
import {
  ArrowRight, CheckCircle2, XCircle, MessageSquare, AlertTriangle,
  Paperclip, Clock,
} from 'lucide-react'
import type { ProcessActivity } from '@/lib/process/types'

interface ProcessTimelineProps {
  activities: ProcessActivity[]
  className?: string
}

const ACTIVITY_ICONS = {
  stage_change: ArrowRight,
  approval: CheckCircle2,
  comment: MessageSquare,
  system: Clock,
  escalation: AlertTriangle,
  attachment: Paperclip,
}

const ACTIVITY_COLORS = {
  stage_change: 'text-primary bg-primary/10',
  approval: 'text-success bg-success/10',
  comment: 'text-muted-foreground bg-muted',
  system: 'text-muted-foreground bg-muted',
  escalation: 'text-destructive bg-destructive/10',
  attachment: 'text-warning bg-warning/10',
}

export function ProcessTimeline({ activities, className }: ProcessTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className={cn('rounded-xl border bg-card p-6', className)}>
        <h3 className="text-sm font-medium text-muted-foreground mb-4">النشاطات</h3>
        <p className="text-sm text-muted-foreground text-center py-8">
          لا توجد نشاطات حتى الآن
        </p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border bg-card p-6', className)}>
      <h3 className="text-sm font-medium text-muted-foreground mb-4">النشاطات</h3>

      <div className="relative">
        <div className="absolute right-[11px] top-2 bottom-2 w-0.5 bg-muted-foreground/10" />

        <div className="space-y-3">
          {activities.map((activity) => {
            const Icon = ACTIVITY_ICONS[activity.type]
            const colorClass = ACTIVITY_COLORS[activity.type]

            return (
              <div key={activity.id} className="relative pr-8">
                <div className={cn(
                  'absolute right-0 top-1 flex items-center justify-center w-6 h-6 rounded-full',
                  colorClass,
                )}>
                  <Icon className="h-3 w-3" />
                </div>

                <div className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{activity.actor.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleString('ar-SA')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{activity.details}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
