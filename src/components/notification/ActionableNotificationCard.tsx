'use client'

import { cn } from '@/lib/utils'
import {
  Bell, BellRing, AlertTriangle, CheckCircle2, Clock, User,
  MessageSquare, ArrowRight, X, Eye, Shield, Zap, Archive,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { calculateSLADisplay } from '@/lib/workflow/engine'
import type { OperationalNotification } from '@/lib/notification/types'
import type { ReactNode } from 'react'

interface ActionableNotificationCardProps {
  notification: OperationalNotification
  onClick?: () => void
  onAction?: (actionId: string) => void
  selected?: boolean
}

const priorityBorder: Record<string, string> = {
  critical: 'border-r-red-500',
  high: 'border-r-orange-500',
  medium: 'border-r-yellow-500',
  low: 'border-r-gray-400',
}

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-gray-100 text-gray-800 border-gray-200',
}

const priorityLabels: Record<string, string> = {
  critical: 'حرج',
  high: 'عالٍ',
  medium: 'متوسط',
  low: 'منخفض',
}

const categoryIcon: Record<string, ReactNode> = {
  approval: <Bell className="h-5 w-5 text-blue-600" />,
  escalation: <AlertTriangle className="h-5 w-5 text-red-600" />,
  reminder: <Clock className="h-5 w-5 text-amber-600" />,
  alert: <Shield className="h-5 w-5 text-orange-600" />,
  system: <Zap className="h-5 w-5 text-purple-600" />,
  workflow: <BellRing className="h-5 w-5 text-teal-600" />,
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

const actionColors: Record<string, { variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'; className: string }> = {
  primary: { variant: 'default', className: 'bg-blue-600 hover:bg-blue-700 text-white' },
  secondary: { variant: 'outline', className: '' },
  danger: { variant: 'destructive', className: '' },
}

function getActionStyle(actionType: string) {
  return actionColors[actionType] ?? actionColors.secondary
}

export function ActionableNotificationCard({
  notification,
  onClick,
  onAction,
  selected,
}: ActionableNotificationCardProps) {
  const slaInfo = notification.slaMinutes
    ? calculateSLADisplay(notification.slaMinutes, notification.timestamp)
    : null

  return (
    <div
      dir="rtl"
      onClick={onClick}
      className={cn(
        'relative rounded-xl border bg-white p-4 pr-5 cursor-pointer transition-all duration-200 hover:shadow-md',
        'border-r-4',
        priorityBorder[notification.priority],
        selected && 'ring-2 ring-blue-500 shadow-md',
        notification.status === 'archived' && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {categoryIcon[notification.category]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {notification.status === 'unread' && (
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600 shrink-0" />
            )}
            {notification.status === 'archived' && (
              <Archive className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            )}
            <h4 className={cn(
              'text-sm font-medium leading-snug',
              notification.status === 'unread' ? 'text-gray-900' : 'text-gray-700',
            )}>
              {notification.title}
            </h4>
          </div>

          <p className="text-xs text-gray-500 mb-2 line-clamp-2">
            {notification.description}
          </p>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-gray-700">
              <span className="text-[10px]">{notification.source}</span>
            </span>

            <Badge className={cn('border text-[10px] px-1.5 py-0', priorityColors[notification.priority])}>
              {priorityLabels[notification.priority]}
            </Badge>

            <span className="text-gray-400">{relativeTime(notification.timestamp)}</span>

            {slaInfo && (
              <span className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px]',
                slaInfo.isBreached ? 'bg-red-50 text-red-700' :
                slaInfo.status === 'critical' ? 'bg-red-50 text-red-600' :
                slaInfo.status === 'warning' ? 'bg-amber-50 text-amber-700' :
                'bg-green-50 text-green-700',
              )}>
                <Clock className="h-3 w-3" />
                {slaInfo.remainingDisplay}
              </span>
            )}

            {notification.escalationCount && (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[10px] text-red-700">
                <AlertTriangle className="h-3 w-3" />
                تصعيد #{notification.escalationCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {notification.status === 'unread' && notification.actions.length > 0 && (
        <div className="flex items-center gap-2 mt-3 mr-8">
          {notification.actions.map((action) => {
            const style = getActionStyle(action.type)
            return (
              <Button
                key={action.id}
                variant={style.variant}
                size="sm"
                className={cn('text-xs h-8 px-3', style.className)}
                onClick={(e) => {
                  e.stopPropagation()
                  onAction?.(action.id)
                }}
              >
                {action.label}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
