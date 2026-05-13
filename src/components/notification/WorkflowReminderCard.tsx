'use client'

import { cn } from '@/lib/utils'
import {
  Clock, Bell, Calendar, ArrowRight, AlertTriangle,
  CheckCircle2, RefreshCw, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { calculateSLADisplay } from '@/lib/workflow/engine'
import type { OperationalNotification } from '@/lib/notification/types'
import { useState } from 'react'

interface WorkflowReminderCardProps {
  notification: OperationalNotification
  onDismiss?: () => void
  onSnooze?: () => void
  onAction?: () => void
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

function daysRemaining(expiryDate?: number): number | null {
  if (!expiryDate) return null
  const diff = expiryDate - Date.now()
  if (diff <= 0) return 0
  return Math.ceil(diff / 86400000)
}

export function WorkflowReminderCard({
  notification,
  onDismiss,
  onSnooze,
  onAction,
}: WorkflowReminderCardProps) {
  const [snoozed, setSnoozed] = useState(false)

  const slaInfo = notification.slaMinutes
    ? calculateSLADisplay(notification.slaMinutes, notification.timestamp)
    : null

  const remaining = daysRemaining(notification.expiryDate)

  const handleSnooze = () => {
    setSnoozed(true)
    onSnooze?.()
  }

  return (
    <div
      dir="rtl"
      className={cn(
        'rounded-xl border bg-white p-5 shadow-sm transition-all duration-200',
        remaining !== null && remaining <= 3 && remaining > 0 && 'border-amber-300 bg-amber-50/30',
        remaining === 0 && 'border-red-300 bg-red-50/30',
      )}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full shrink-0',
          remaining === 0 ? 'bg-red-100' :
          remaining !== null && remaining <= 3 ? 'bg-amber-100' :
          'bg-blue-100',
        )}>
          <Clock className={cn(
            'h-5 w-5',
            remaining === 0 ? 'text-red-600' :
            remaining !== null && remaining <= 3 ? 'text-amber-600' :
            'text-blue-600',
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 mb-0.5">
            {notification.title}
          </h3>
          <p className="text-xs text-gray-600">
            {notification.description}
          </p>
        </div>
      </div>

      {remaining !== null && (
        <div className={cn(
          'rounded-lg border p-3 mb-4 text-center',
          remaining === 0 ? 'bg-red-50 border-red-200' :
          remaining <= 3 ? 'bg-amber-50 border-amber-200' :
          'bg-blue-50 border-blue-200',
        )}>
          <div className="text-lg font-bold mb-0.5">
            {remaining === 0 ? (
              <span className="text-red-700">منتهي</span>
            ) : (
              <span className={cn(
                remaining <= 3 ? 'text-amber-700' : 'text-blue-700',
              )}>
                متبقي {remaining} {remaining === 1 ? 'يوم' : 'أيام'}
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-500">
            {remaining === 0
              ? 'تم تجاوز الموعد النهائي'
              : `الموعد النهائي: ${new Date(notification.expiryDate!).toLocaleDateString('ar-SA')}`
            }
          </p>
        </div>
      )}

      {slaInfo && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">SLA</span>
            <span className={cn(
              'text-xs font-medium',
              slaInfo.isBreached ? 'text-red-600' :
              slaInfo.status === 'critical' ? 'text-red-600' :
              slaInfo.status === 'warning' ? 'text-amber-600' :
              'text-green-600',
            )}>
              {slaInfo.remainingDisplay}
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
        </div>
      )}

      {notification.relatedEntity && (
        <div className="flex items-center gap-1.5 mb-4 text-xs text-gray-500">
          <Calendar className="h-3.5 w-3.5" />
          <span>{notification.relatedEntity.name}</span>
          <span className="text-gray-300 mx-1">|</span>
          <span>{notification.source}</span>
          <span className="text-gray-300 mx-1">|</span>
          <span>{relativeTime(notification.timestamp)}</span>
        </div>
      )}

      {snoozed ? (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 mb-2">
          <RefreshCw className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-xs text-amber-800">
            تم تأجيل التذكير لمدة ساعة
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="mr-auto h-6 px-2 text-xs"
            onClick={() => setSnoozed(false)}
          >
            تراجع
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 px-4"
            onClick={onAction}
          >
            <ArrowRight className="h-4 w-4 ml-1" />
            عرض المهمة
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-9 px-4"
            onClick={handleSnooze}
          >
            <RefreshCw className="h-4 w-4 ml-1" />
            تذكير لاحقاً
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs h-9 px-4 text-gray-500"
            onClick={onDismiss}
          >
            <X className="h-4 w-4 ml-1" />
            تجاهل
          </Button>
        </div>
      )}
    </div>
  )
}
