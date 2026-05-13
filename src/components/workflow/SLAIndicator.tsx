'use client'

import { cn } from '@/lib/utils'
import { Clock, AlertTriangle, AlertCircle } from 'lucide-react'

interface SLADisplay {
  remainingDisplay: string
  pctElapsed: number
  status: 'ok' | 'warning' | 'critical' | 'breached'
  isBreached: boolean
}

interface SLAIndicatorProps {
  sla: SLADisplay
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  className?: string
}

const STATUS_STYLES = {
  ok: { bg: 'bg-success/10', text: 'text-success', icon: Clock },
  warning: { bg: 'bg-warning/10', text: 'text-warning', icon: Clock },
  critical: { bg: 'bg-orange-50', text: 'text-orange-600', icon: AlertTriangle },
  breached: { bg: 'bg-destructive/10', text: 'text-destructive', icon: AlertCircle },
}

export function SLAIndicator({ sla, size = 'md', showIcon = true, className }: SLAIndicatorProps) {
  const styles = STATUS_STYLES[sla.status]
  const Icon = styles.icon

  if (size === 'sm') {
    return (
      <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full', styles.bg, styles.text, className)}>
        {showIcon && <Icon className="h-2.5 w-2.5" />}
        {sla.remainingDisplay}
      </span>
    )
  }

  return (
    <div className={cn('flex items-center gap-2 p-2 rounded-lg', styles.bg, className)}>
      {showIcon && <Icon className={cn('h-4 w-4', styles.text)} />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={cn('text-xs font-medium', styles.text)}>
            {sla.isBreached ? 'تم تجاوز SLA' : 'متبقي'}
          </span>
          <span className={cn('text-xs font-bold tabular-nums', styles.text)}>
            {sla.remainingDisplay}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', styles.text.replace('text-', 'bg-'))}
            style={{ width: `${Math.min(sla.pctElapsed, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
