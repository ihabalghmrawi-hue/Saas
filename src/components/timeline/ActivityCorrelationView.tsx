'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  GitBranch, ArrowLeft, Clock, CheckCircle2,
  AlertTriangle, Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { TimelineCard } from './TimelineCard'
import type { ActivityCorrelation, TimelineEntry } from '@/lib/timeline/types'

interface ActivityCorrelationViewProps {
  correlations: ActivityCorrelation[]
  className?: string
}

const statusConfig: Record<string, { icon: typeof CheckCircle2; className: string; label: string }> = {
  completed: { icon: CheckCircle2, className: 'text-green-600', label: 'مكتمل' },
  in_progress: { icon: Loader2, className: 'text-blue-600', label: 'قيد التنفيذ' },
  failed: { icon: AlertTriangle, className: 'text-destructive', label: 'فشل' },
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours} ساعة ${minutes % 60} دقيقة`
  if (minutes > 0) return `${minutes} دقيقة ${seconds % 60} ثانية`
  return `${seconds} ثانية`
}

function CorrelationChain({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="relative pr-6 space-y-2">
      <div className="absolute right-2.5 top-2 bottom-2 w-px bg-border" />
      {entries.map((entry, i) => (
        <div key={entry.id} className="relative">
          <div className={cn(
            'absolute -right-4 top-5 h-2 w-2 rounded-full border-2',
            i === entries.length - 1 ? 'bg-primary border-primary' : 'bg-background border-muted-foreground/30'
          )} />
          {i < entries.length - 1 && (
            <div className="absolute -right-[7px] top-7 h-px w-4 bg-border rotate-45" />
          )}
          <TimelineCard entry={entry} compact />
        </div>
      ))}
    </div>
  )
}

export function ActivityCorrelationView({ correlations, className }: ActivityCorrelationViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (correlations.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-10 text-muted-foreground', className)} dir="rtl">
        <GitBranch className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">لا توجد تسلسلات نشاط مرتبطة</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)} dir="rtl">
      <div className="flex items-center gap-2">
        <GitBranch className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-sm font-semibold">تسلسل النشاطات المرتبطة</h3>
      </div>

      <div className="space-y-2">
        {correlations.map((corr) => {
          const status = statusConfig[corr.status] || statusConfig.in_progress
          const StatusIcon = status.icon
          const isOpen = expanded.has(corr.id)

          return (
            <div key={corr.id} className="rounded-lg border bg-card transition-colors">
              <button
                onClick={() => toggle(corr.id)}
                className="w-full flex items-center justify-between p-3 text-right transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    status.className, 'bg-muted'
                  )}>
                    <StatusIcon className={cn('h-4 w-4', corr.status === 'in_progress' && 'animate-spin')} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{corr.correlationKey}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(corr.duration)}
                      </span>
                      <span>{corr.entries.length} نشاطات</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={cn('text-[10px]', status.className)}>
                    {status.label}
                  </Badge>
                  <ArrowLeft className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform',
                    isOpen && 'rotate-90'
                  )} />
                </div>
              </button>

              {isOpen && (
                <div className="border-t px-3 pb-3 pt-2">
                  <CorrelationChain entries={corr.entries} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
