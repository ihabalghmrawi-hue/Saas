'use client'

import { cn } from '@/lib/utils'
import { User, Edit3, Lock, Unlock, Clock, AlertTriangle } from 'lucide-react'
import type { EntityLock } from '@/lib/workflow/types'

interface PresenceIndicatorProps {
  users: Array<{ id: string; name: string; color?: string }>
  maxVisible?: number
  size?: 'sm' | 'md'
  className?: string
}

export function PresenceIndicator({ users, maxVisible = 3, size = 'sm', className }: PresenceIndicatorProps) {
  const visible = users.slice(0, maxVisible)
  const overflow = users.length - maxVisible

  const sizeClasses = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs'

  return (
    <div className={cn('flex items-center', className)}>
      <div className="flex -space-x-1.5 rtl:space-x-reverse">
        {visible.map(user => (
          <div
            key={user.id}
            className={cn(
              'rounded-full border-2 border-background flex items-center justify-center font-medium',
              sizeClasses,
              user.color ?? 'bg-primary/10 text-primary'
            )}
            title={user.name}
          >
            {user.name.charAt(0)}
          </div>
        ))}
        {overflow > 0 && (
          <div className={cn('rounded-full border-2 border-background bg-muted text-muted-foreground flex items-center justify-center font-medium', sizeClasses)}>
            +{overflow}
          </div>
        )}
      </div>
    </div>
  )
}

interface EntityLockBadgeProps {
  lock?: EntityLock | null
  currentSessionId?: string
  onRelease?: () => void
  className?: string
}

export function EntityLockBadge({ lock, currentSessionId, onRelease, className }: EntityLockBadgeProps) {
  if (!lock) return null

  const isOwn = lock.sessionId === currentSessionId
  const isExpired = Date.now() > lock.expiresAt

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs',
      isExpired ? 'bg-muted text-muted-foreground' :
      isOwn ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning',
      className
    )}>
      {isExpired ? (
        <Unlock className="h-3.5 w-3.5" />
      ) : isOwn ? (
        <Lock className="h-3.5 w-3.5" />
      ) : (
        <Lock className="h-3.5 w-3.5" />
      )}
      <span>
        {isExpired ? 'انتهت صلاحية القفل' :
         isOwn ? 'أنت تملك حق التحرير' :
         `مقفول بواسطة ${lock.lockedBy.name}`}
      </span>
      <span className="text-[10px] text-muted-foreground">
        {Math.ceil((lock.expiresAt - Date.now()) / 60000)}د متبقية
      </span>
      {isOwn && onRelease && (
        <button onClick={onRelease} className="p-0.5 hover:bg-accent rounded">
          <Unlock className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

interface CollaborativeEditingBadgeProps {
  editors: Array<{ id: string; name: string }>
  className?: string
}

export function CollaborativeEditingBadge({ editors, className }: CollaborativeEditingBadgeProps) {
  if (editors.length === 0) return null

  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <Edit3 className="h-3.5 w-3.5" />
      <span>يقوم بالتحرير:</span>
      <div className="flex -space-x-1 rtl:space-x-reverse">
        {editors.map(editor => (
          <div
            key={editor.id}
            className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-medium border border-background"
            title={editor.name}
          >
            {editor.name.charAt(0)}
          </div>
        ))}
      </div>
    </div>
  )
}

interface ConcurrentOperationPanelProps {
  operations: Array<{ id: string; user: string; action: string; entity: string; timestamp: number }>
}

export function ConcurrentOperationPanel({ operations }: ConcurrentOperationPanelProps) {
  return (
    <div className="space-y-1">
      {operations.map(op => (
        <div key={op.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 text-xs">
          <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-medium">
            {op.user.charAt(0)}
          </div>
          <span className="text-muted-foreground">{op.user}</span>
          <span>{op.action}</span>
          <span className="text-muted-foreground font-medium">{op.entity}</span>
        </div>
      ))}
      {operations.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">لا توجد عمليات متزامنة</p>
      )}
    </div>
  )
}

interface RealtimeKPIsProps {
  metrics: Array<{ label: string; value: string | number; change?: number; trend?: 'up' | 'down'; icon?: React.ReactNode }>
}

export function RealtimeKPIs({ metrics }: RealtimeKPIsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {metrics.map((metric, idx) => (
        <div key={idx} className="p-3 rounded-xl bg-card border hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{metric.label}</span>
            {metric.icon}
          </div>
          <div className="text-xl font-bold mt-1 tabular-nums">{metric.value}</div>
          {metric.change !== undefined && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className={cn('text-xs', metric.trend === 'up' ? 'text-success' : 'text-destructive')}>
                {metric.change > 0 ? '+' : ''}{metric.change}%
              </span>
              <span className="text-[10px] text-muted-foreground">خلال 5 دقائق</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
