'use client'

import { cn } from '@/lib/utils'
import {
  Activity, FileText, CheckCircle2, AlertTriangle,
  Info, Shield, Zap, RefreshCw,
} from 'lucide-react'
import type { TimelineEntry } from '@/lib/timeline/types'

const typeIcons: Record<TimelineEntry['type'], typeof Activity> = {
  entity: Activity,
  workflow: FileText,
  audit: Shield,
  approval: CheckCircle2,
  operation: Zap,
  system: RefreshCw,
}

const severityConfig: Record<string, { icon: typeof Info; className: string }> = {
  info: { icon: Info, className: 'text-blue-500' },
  warning: { icon: AlertTriangle, className: 'text-amber-500' },
  error: { icon: AlertTriangle, className: 'text-destructive' },
  success: { icon: CheckCircle2, className: 'text-success' },
}

interface TimelineCardProps {
  entry: TimelineEntry
  onClick?: () => void
  compact?: boolean
}

export function TimelineCard({ entry, onClick, compact = false }: TimelineCardProps) {
  const TypeIcon = typeIcons[entry.type] || Activity
  const severity = severityConfig[entry.severity || 'info'] || severityConfig.info
  const SeverityIcon = severity.icon

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() }}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50 cursor-pointer',
        'rtl:flex-row-reverse',
        compact ? 'py-2' : 'py-3',
      )}
    >
      <div className="flex items-center justify-center rounded-full bg-muted p-2 shrink-0">
        <TypeIcon className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityIcon className={cn('h-3.5 w-3.5', severity.className)} />
          <span className="text-xs text-muted-foreground">{entry.actor.name}</span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">
            {new Date(entry.timestamp).toLocaleString('ar-SA')}
          </span>
        </div>

        {compact ? (
          <p className="text-sm font-medium leading-snug truncate">{entry.action}</p>
        ) : (
          <>
            <p className="text-sm font-medium leading-snug">{entry.action}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{entry.details}</p>
          </>
        )}
      </div>
    </div>
  )
}
