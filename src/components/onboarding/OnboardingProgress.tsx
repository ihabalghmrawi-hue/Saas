'use client'

import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, Clock, AlertTriangle, Building2, Users, Database, Settings, Rocket } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface OnboardingStep {
  id: string
  label: string
  status: 'completed' | 'in_progress' | 'pending' | 'skipped'
  icon?: LucideIcon
}

interface OnboardingProgressProps {
  steps: OnboardingStep[]
  currentStep?: string
  compact?: boolean
  className?: string
}

export const DEFAULT_ONBOARDING_STEPS: OnboardingStep[] = [
  { id: 'company', label: 'معلومات الشركة', status: 'pending', icon: Building2 },
  { id: 'financial', label: 'الإعدادات المالية', status: 'pending', icon: Settings },
  { id: 'accounts', label: 'دليل الحسابات', status: 'pending', icon: Database },
  { id: 'warehouses', label: 'المستودعات', status: 'pending', icon: Building2 },
  { id: 'import', label: 'استيراد البيانات', status: 'pending', icon: Users },
  { id: 'review', label: 'مراجعة وتأكيد', status: 'pending', icon: Rocket },
]

function StatusIcon({ status, isCompact }: { status: OnboardingStep['status']; isCompact?: boolean }) {
  const size = isCompact ? 'h-3 w-3' : 'h-5 w-5'

  switch (status) {
    case 'completed':
      return <CheckCircle2 className={cn(size, 'text-emerald-500')} />
    case 'in_progress':
      return <Clock className={cn(size, 'text-primary animate-pulse')} />
    case 'skipped':
      return <AlertTriangle className={cn(size, 'text-muted-foreground/50')} />
    default:
      return <Circle className={cn(size, 'text-muted-foreground/30')} />
  }
}

function statusBarColor(status: OnboardingStep['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500'
    case 'in_progress':
      return 'bg-primary'
    case 'skipped':
      return 'bg-muted-foreground/20'
    default:
      return 'bg-muted-foreground/20'
  }
}

export function OnboardingProgress({
  steps,
  currentStep,
  compact = false,
  className,
}: OnboardingProgressProps) {
  if (steps.length === 0) {
    return (
      <div className={cn('text-sm text-muted-foreground text-center py-4', className)}>
        لا توجد خطوات إعداد متاحة
      </div>
    )
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1.5', className)} dir="rtl">
        {steps.map((step, idx) => {
          const isActive = step.id === currentStep
          const Icon = step.icon
          return (
            <div
              key={step.id}
              className="group relative"
            >
              <div
                className={cn(
                  'h-2.5 w-2.5 rounded-full transition-all',
                  step.status === 'completed' && 'bg-emerald-500',
                  step.status === 'in_progress' && 'bg-primary shadow-sm shadow-primary/50',
                  step.status === 'pending' && 'bg-muted-foreground/20',
                  step.status === 'skipped' && 'bg-muted-foreground/10',
                  isActive && 'ring-2 ring-primary/30'
                )}
              />
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="bg-popover text-popover-foreground text-xs rounded px-2 py-1 shadow-md border whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    {Icon && <Icon className="h-3 w-3" />}
                    <span>{step.label}</span>
                  </div>
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-2.5 h-px bg-muted-foreground/20" />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)} dir="rtl">
      <div className="space-y-0">
        {steps.map((step, idx) => {
          const isActive = step.id === currentStep
          const isLast = idx === steps.length - 1
          const Icon = step.icon

          return (
            <div key={step.id} className="relative flex gap-4">
              {!isLast && (
                <div
                  className={cn(
                    'absolute right-[11px] top-8 w-0.5 h-full',
                    statusBarColor(step.status)
                  )}
                />
              )}
              <div className="flex flex-col items-center shrink-0 pt-1">
                <div
                  className={cn(
                    'flex items-center justify-center rounded-full transition-all',
                    isActive && !compact && 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background'
                  )}
                >
                  {Icon ? (
                    <div
                      className={cn(
                        'flex items-center justify-center rounded-full transition-colors',
                        step.status === 'completed' && 'bg-emerald-500 text-white',
                        step.status === 'in_progress' && 'bg-primary text-primary-foreground',
                        step.status === 'pending' && 'bg-muted-foreground/10 text-muted-foreground/50',
                        step.status === 'skipped' && 'bg-muted-foreground/5 text-muted-foreground/30',
                        compact ? 'h-6 w-6' : 'h-7 w-7'
                      )}
                    >
                      <Icon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                    </div>
                  ) : (
                    <StatusIcon status={step.status} />
                  )}
                </div>
              </div>
              <div className={cn('pb-8 flex-1 min-w-0', isLast && 'pb-0')}>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      step.status === 'completed' && 'text-emerald-600',
                      step.status === 'in_progress' && 'text-primary',
                      step.status === 'pending' && 'text-muted-foreground/50',
                      step.status === 'skipped' && 'text-muted-foreground/30 line-through'
                    )}
                  >
                    {step.label}
                  </span>
                  {step.status === 'completed' && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full font-medium">مكتمل</span>
                  )}
                  {step.status === 'in_progress' && (
                    <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full font-medium">قيد التنفيذ</span>
                  )}
                  {step.status === 'skipped' && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full font-medium">تم التخطي</span>
                  )}
                </div>
                {isActive && step.status === 'in_progress' && (
                  <p className="text-xs text-muted-foreground mt-0.5">هذه الخطوة قيد التنفيذ حالياً</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
