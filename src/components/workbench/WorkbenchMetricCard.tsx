'use client'

import { cn } from '@/lib/utils'
import {
  TrendingUp, TrendingDown, DollarSign, Package,
  Users, ShoppingCart, AlertTriangle,
} from 'lucide-react'
import type { WorkbenchMetric } from '@/lib/workbench/types'

export interface WorkbenchMetricCardProps {
  metric: WorkbenchMetric
  className?: string
  onClick?: () => void
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  DollarSign,
  Package,
  Users,
  ShoppingCart,
  AlertTriangle,
}

const severityColors: Record<string, string> = {
  info: 'text-blue-600 bg-blue-50 border-blue-200',
  warning: 'text-amber-600 bg-amber-50 border-amber-200',
  critical: 'text-red-600 bg-red-50 border-red-200',
  success: 'text-green-600 bg-green-50 border-green-200',
}

const severityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  info: TrendingUp,
  warning: AlertTriangle,
  critical: AlertTriangle,
  success: TrendingUp,
}

export function WorkbenchMetricCard({ metric, className, onClick }: WorkbenchMetricCardProps) {
  const Icon = metric.icon ? iconMap[metric.icon] : undefined
  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : undefined
  const SeverityIcon = severityIcons[metric.severity ?? 'info']

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border bg-card p-4 text-right min-w-[200px] flex-shrink-0',
        'hover:shadow-md transition-all duration-200 hover:border-primary/30',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        onClick ? 'cursor-pointer' : 'cursor-default',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn(
          'p-2 rounded-lg',
          severityColors[metric.severity ?? 'info'],
        )}>
          {Icon ? <Icon className="h-5 w-5" /> : <SeverityIcon className="h-5 w-5" />}
        </div>
        {metric.change !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full',
            (metric.change ?? 0) >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50',
          )}>
            {TrendIcon && <TrendIcon className="h-3 w-3" />}
            <span dir="ltr">{metric.change >= 0 ? '+' : ''}{metric.change}%</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold tracking-tight mb-1" dir="ltr">
        {typeof metric.value === 'number' ? metric.value.toLocaleString('ar-SA') : metric.value}
      </div>
      <div className="text-sm text-muted-foreground">{metric.label}</div>
    </button>
  )
}
