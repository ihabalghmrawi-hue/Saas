'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  ArrowUp, Plus, X, Clock, User,
  Shield, Settings, Mail, Bell,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { EscalationLevel } from '@/lib/automation/types'

interface EscalationRuleConfigProps {
  levels: EscalationLevel[]
  onChange?: (levels: EscalationLevel[]) => void
  readOnly?: boolean
  className?: string
}

const actionLabels: Record<string, string> = {
  notify: 'إشعار',
  reassign: 'إعادة توجيه',
  notify_manager: 'إشعار المدير',
  escalate_to_director: 'تصعيد للمدير',
}

const actionDescriptions: Record<string, string> = {
  notify: 'إرسال إشعار إلى المستخدم المحدد',
  reassign: 'إعادة توجيه المهمة إلى مستخدم آخر',
  notify_manager: 'إشعار المدير المباشر للمستخدم',
  escalate_to_director: 'تصعيد المهمة إلى الإدارة العليا',
}

let levelCounter = 0

function generateLevelId() {
  levelCounter += 1
  return `level-${Date.now()}-${levelCounter}`
}

function createLevel(levelNum: number): EscalationLevel {
  return {
    level: levelNum,
    afterMinutes: 60,
    action: 'notify',
    target: '',
    notifyChannels: ['in_app'],
  }
}

export function EscalationRuleConfig({
  levels: externalLevels,
  onChange,
  readOnly = false,
  className,
}: EscalationRuleConfigProps) {
  const [internalLevels, setInternalLevels] = useState<EscalationLevel[]>(externalLevels)

  const levels = onChange ? externalLevels : internalLevels

  const updateLevels = (next: EscalationLevel[]) => {
    if (onChange) {
      onChange(next)
    } else {
      setInternalLevels(next)
    }
  }

  const addLevel = () => {
    if (levels.length >= 5) return
    const nextNum = levels.length > 0 ? Math.max(...levels.map((l) => l.level)) + 1 : 1
    updateLevels([...levels, createLevel(nextNum)])
  }

  const removeLevel = (level: number) => {
    const next = levels
      .filter((l) => l.level !== level)
      .map((l, idx) => ({ ...l, level: idx + 1 }))
    updateLevels(next)
  }

  const updateLevel = (level: number, updates: Partial<EscalationLevel>) => {
    updateLevels(
      levels.map((l) => (l.level === level ? { ...l, ...updates } : l))
    )
  }

  const toggleChannel = (level: number, channel: 'in_app' | 'email') => {
    const lvl = levels.find((l) => l.level === level)
    if (!lvl) return
    const channels = lvl.notifyChannels.includes(channel)
      ? lvl.notifyChannels.filter((c) => c !== channel)
      : [...lvl.notifyChannels, channel]
    updateLevel(level, { notifyChannels: channels })
  }

  const buildDescription = () => {
    if (levels.length === 0) return ''
    const descriptions = levels.map((l) => {
      const actionLabel = actionLabels[l.action]
      return `المستوى ${l.level}: بعد ${l.afterMinutes} دقيقة → ${actionLabel} إلى ${l.target || 'غير محدد'}`
    })
    return descriptions.join(' ← ')
  }

  if (levels.length === 0) {
    return (
      <div className={cn('space-y-4', className)} dir="rtl">
        <div className="flex items-center gap-2 mb-4">
          <ArrowUp className="h-5 w-5 text-destructive" />
          <h3 className="text-lg font-semibold">قواعد التصعيد</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl border-muted-foreground/20">
          <ArrowUp className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm max-w-xs">
            لم يتم تكوين مستويات التصعيد بعد
          </p>
          {!readOnly && (
            <Button variant="outline" size="sm" className="mt-4" onClick={addLevel}>
              <Plus className="h-4 w-4 ml-1" />
              إضافة مستوى تصعيد
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)} dir="rtl">
      <div className="flex items-center gap-2 mb-4">
        <ArrowUp className="h-5 w-5 text-destructive" />
        <h3 className="text-lg font-semibold">قواعد التصعيد</h3>
      </div>

      <div className="space-y-0">
        {levels.map((level, idx) => (
          <div key={level.level} className="relative">
            <div className={cn(
              'border rounded-xl p-4 bg-card shadow-sm',
              idx === 0 ? 'rounded-b-none' : idx === levels.length - 1 ? 'rounded-t-none' : 'rounded-none'
            )}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white',
                    level.level === 1
                      ? 'bg-amber-500'
                      : level.level === 2
                      ? 'bg-orange-500'
                      : level.level === 3
                      ? 'bg-red-500'
                      : 'bg-purple-600'
                  )}>
                    {level.level}
                  </div>
                  <span className="text-sm font-medium">المستوى {level.level}</span>
                </div>
                {!readOnly && levels.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLevel(level.level)}
                    className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    <Clock className="h-3 w-3 inline ml-1" />
                    المهلة الزمنية
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="43200"
                      value={level.afterMinutes}
                      onChange={(e) =>
                        updateLevel(level.level, { afterMinutes: parseInt(e.target.value) || 1 })
                      }
                      disabled={readOnly}
                      className="h-9 w-20 rounded-lg border border-input bg-background px-2 text-sm text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <span className="text-sm text-muted-foreground">دقيقة</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    <Settings className="h-3 w-3 inline ml-1" />
                    نوع الإجراء
                  </label>
                  <select
                    value={level.action}
                    onChange={(e) =>
                      updateLevel(level.level, {
                        action: e.target.value as EscalationLevel['action'],
                      })
                    }
                    disabled={readOnly}
                    className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="notify">إشعار</option>
                    <option value="reassign">إعادة توجيه</option>
                    <option value="notify_manager">إشعار المدير</option>
                    <option value="escalate_to_director">تصعيد للمدير</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    <User className="h-3 w-3 inline ml-1" />
                    المستهدف
                  </label>
                  <input
                    type="text"
                    value={level.target}
                    onChange={(e) => updateLevel(level.level, { target: e.target.value })}
                    disabled={readOnly}
                    placeholder="اسم المستخدم أو البريد"
                    className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    <Bell className="h-3 w-3 inline ml-1" />
                    قنوات الإشعار
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggleChannel(level.level, 'in_app')}
                      disabled={readOnly}
                      className={cn(
                        'flex items-center gap-1 text-xs px-3 h-9 rounded-lg border transition-colors cursor-pointer',
                        level.notifyChannels.includes('in_app')
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-input'
                      )}
                    >
                      <Bell className="h-3.5 w-3.5" />
                      التطبيق
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleChannel(level.level, 'email')}
                      disabled={readOnly}
                      className={cn(
                        'flex items-center gap-1 text-xs px-3 h-9 rounded-lg border transition-colors cursor-pointer',
                        level.notifyChannels.includes('email')
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-input'
                      )}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      البريد الإلكتروني
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                {actionDescriptions[level.action]}
              </p>
            </div>

            {idx < levels.length - 1 && (
              <div className="flex justify-center py-1">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                  <ArrowUp className="h-4 w-4 text-destructive" />
                  <span className="text-[10px] text-muted-foreground">
                    {levels[idx + 1].afterMinutes - level.afterMinutes > 0
                      ? `+${levels[idx + 1].afterMinutes - level.afterMinutes} د`
                      : ''}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {!readOnly && levels.length < 5 && (
        <Button variant="outline" size="sm" onClick={addLevel}>
          <Plus className="h-4 w-4 ml-1" />
          إضافة مستوى تصعيد
        </Button>
      )}

      {!readOnly && levels.length >= 5 && (
        <p className="text-xs text-muted-foreground">الحد الأقصى 5 مستويات تصعيد</p>
      )}

      {levels.length > 0 && (
        <div className="p-3 rounded-lg bg-muted/30 border">
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">مسار التصعيد:</span>
              <p className="mt-1">{buildDescription()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
