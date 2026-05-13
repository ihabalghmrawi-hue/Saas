'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  AlertCircle, AlertTriangle, CheckCircle2, Info,
  X, ChevronUp, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ValidationMessage } from '@/lib/workbench/types'

export interface RealtimeValidationBarProps {
  messages: ValidationMessage[]
  onDismiss?: (id: string) => void
  className?: string
}

const typeConfig = {
  error: { icon: AlertCircle, color: 'text-red-500 bg-red-50 border-red-200' },
  warning: { icon: AlertTriangle, color: 'text-amber-500 bg-amber-50 border-amber-200' },
  success: { icon: CheckCircle2, color: 'text-green-500 bg-green-50 border-green-200' },
  info: { icon: Info, color: 'text-blue-500 bg-blue-50 border-blue-200' },
}

export function RealtimeValidationBar({ messages, onDismiss, className }: RealtimeValidationBarProps) {
  const [collapsed, setCollapsed] = useState(true)

  if (messages.length === 0) return null

  const errorCount = messages.filter((m) => m.type === 'error').length
  const warningCount = messages.filter((m) => m.type === 'warning').length
  const infoCount = messages.filter((m) => m.type === 'info').length
  const successCount = messages.filter((m) => m.type === 'success').length

  return (
    <div className={cn('border-t bg-background', className)}>
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full px-4 py-2 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">رسائل التحقق</span>
          <div className="flex items-center gap-2 text-xs">
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <AlertCircle className="h-3.5 w-3.5" />
                {errorCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                {warningCount}
              </span>
            )}
            {infoCount > 0 && (
              <span className="flex items-center gap-1 text-blue-600">
                <Info className="h-3.5 w-3.5" />
                {infoCount}
              </span>
            )}
            {successCount > 0 && (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {successCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {messages.length} {messages.length === 1 ? 'رسالة' : 'رسائل'}
          </span>
          {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {!collapsed && (
        <div className="border-t max-h-[240px] overflow-y-auto">
          {messages.map((msg) => {
            const config = typeConfig[msg.type]
            const Icon = config.icon
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-2.5 border-b last:border-b-0',
                  config.color.replace('bg-', 'bg-opacity-20 bg-').split(' ').slice(0, 2).join(' '),
                )}
              >
                <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', config.color.split(' ')[0])} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{msg.message}</p>
                  {msg.field && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      الحقل: {msg.field}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {msg.action && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={msg.action.handler}
                      className="h-7 text-xs px-2"
                    >
                      {msg.action.label}
                    </Button>
                  )}
                  {onDismiss && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDismiss(msg.id)}
                      className="h-7 w-7"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
