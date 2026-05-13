'use client'

import { cn } from '@/lib/utils'
import {
  AlertTriangle, ArrowUp, Clock, User, Shield, CheckCircle2,
  ChevronUp, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { calculateSLADisplay } from '@/lib/workflow/engine'
import type { OperationalNotification } from '@/lib/notification/types'

interface EscalationAlertProps {
  notification: OperationalNotification
  onAcknowledge?: () => void
  onEscalate?: () => void
  onAssign?: () => void
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} دقيقة`
  if (hours < 24) return `منذ ${hours} ساعة`
  if (days < 7) return `منذ ${days} أيام`
  return new Date(ts).toLocaleDateString('ar-SA')
}

const escalationLevels = [
  { level: 1, label: 'المشرف المباشر', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { level: 2, label: 'مدير الإدارة', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { level: 3, label: 'الإدارة العليا', color: 'bg-red-100 text-red-800 border-red-300' },
]

export function EscalationAlert({
  notification,
  onAcknowledge,
  onEscalate,
  onAssign,
}: EscalationAlertProps) {
  const slaInfo = notification.slaMinutes
    ? calculateSLADisplay(notification.slaMinutes, notification.timestamp)
    : null

  const escCount = notification.escalationCount ?? 1
  const currentLevel = escalationLevels[Math.min(escCount - 1, escalationLevels.length - 1)]
  const previousLevels = escalationLevels.slice(0, Math.min(escCount, escalationLevels.length))

  return (
    <div
      dir="rtl"
      className={cn(
        'rounded-xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-white p-5 shadow-md',
        'relative overflow-hidden',
      )}
    >
      <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500" />

      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 shrink-0">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-red-900">
              {notification.title}
            </h3>
            <Badge className="bg-red-600 text-white border-red-600 text-[10px] px-2">
              التصعيد رقم {escCount}
            </Badge>
          </div>
          <p className="text-sm text-red-700 mb-1">
            {notification.description}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          <ArrowUp className="h-3.5 w-3.5 text-red-500" />
          مسار التصعيد
        </h4>
        <div className="flex items-center gap-1">
          {previousLevels.map((level, idx) => (
            <div key={level.level} className="flex items-center gap-1">
              <div className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-medium',
                level.color,
                idx === previousLevels.length - 1 && 'ring-2 ring-red-400 ring-offset-1',
              )}>
                {level.label}
              </div>
              {idx < previousLevels.length - 1 && (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              )}
            </div>
          ))}
        </div>
      </div>

      {slaInfo && (
        <div className={cn(
          'rounded-lg border p-3 mb-4',
          slaInfo.isBreached ? 'bg-red-50 border-red-200' :
          slaInfo.status === 'critical' ? 'bg-red-50 border-red-200' :
          slaInfo.status === 'warning' ? 'bg-amber-50 border-amber-200' :
          'bg-green-50 border-green-200',
        )}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              SLA
            </span>
            <span className={cn(
              'text-xs font-bold',
              slaInfo.isBreached ? 'text-red-700' :
              slaInfo.status === 'critical' ? 'text-red-600' :
              slaInfo.status === 'warning' ? 'text-amber-700' :
              'text-green-700',
            )}>
              {slaInfo.isBreached ? 'تم تجاوز المهلة' : slaInfo.remainingDisplay}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                slaInfo.isBreached ? 'bg-red-500' :
                slaInfo.status === 'critical' ? 'bg-red-500' :
                slaInfo.status === 'warning' ? 'bg-amber-500' :
                'bg-green-500',
              )}
              style={{ width: `${Math.min(slaInfo.pctElapsed, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            {slaInfo.isBreached
              ? 'تم تجاوز المهلة الزمنية المحددة للاستجابة'
              : `تم استهلاك ${slaInfo.pctElapsed}% من المهلة المحددة`
            }
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
        <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1">
          {notification.source}
        </span>
        {notification.relatedEntity && (
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1">
            {notification.relatedEntity.name}
          </span>
        )}
        <span>{relativeTime(notification.timestamp)}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="bg-red-600 hover:bg-red-700 text-white text-xs h-9 px-4"
          onClick={onAcknowledge}
        >
          <CheckCircle2 className="h-4 w-4 ml-1" />
          استلام
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="text-xs h-9 px-4"
          onClick={onEscalate}
        >
          <ArrowUp className="h-4 w-4 ml-1" />
          تصعيد
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-9 px-4"
          onClick={onAssign}
        >
          <User className="h-4 w-4 ml-1" />
          إعادة توجيه
        </Button>
      </div>
    </div>
  )
}
