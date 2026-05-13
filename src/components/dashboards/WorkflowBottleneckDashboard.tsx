'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  AlertTriangle, Clock, ArrowUp, ArrowDown,
  Filter, TrendingUp,
} from 'lucide-react'
import type { BottleneckMetric } from '@/lib/dashboards/types'

interface WorkflowBottleneckDashboardProps {
  bottlenecks: BottleneckMetric[]
  className?: string
}

const severityLabels: Record<string, string> = {
  all: 'الكل',
  critical: 'حرج',
  high: 'عالي',
  medium: 'متوسط',
  low: 'منخفض',
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
}

const severityFillColors: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
}

const severityProgressColors: Record<string, string> = {
  critical: 'text-red-600',
  high: 'text-orange-600',
  medium: 'text-yellow-600',
  low: 'text-green-600',
}

type SortKey = 'wait' | 'items' | 'utilization'

export function WorkflowBottleneckDashboard({ bottlenecks, className }: WorkflowBottleneckDashboardProps) {
  const [filter, setFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('wait')

  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

  const filtered = bottlenecks.filter(b => filter === 'all' || b.severity === filter)

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'wait') return b.avgWaitTime - a.avgWaitTime
    if (sortKey === 'items') return b.itemsQueued - a.itemsQueued
    return b.utilization - a.utilization
  })

  return (
    <div dir="rtl" className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h3 className="text-lg font-semibold">اختناقات سير العمل</h3>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {['all', 'critical', 'high', 'medium', 'low'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'px-3 py-1 text-xs rounded-full border transition-colors',
                filter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {severityLabels[s]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          {(['wait', 'items', 'utilization'] as SortKey[]).map(key => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={cn(
                'px-2 py-1 rounded transition-colors',
                sortKey === key
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {key === 'wait' ? 'حسب وقت الانتظار' : key === 'items' ? 'حسب العناصر' : 'حسب الاستخدام'}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mb-2 opacity-40" />
          <span>لا توجد اختناقات حالياً</span>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((b, idx) => (
            <div
              key={idx}
              className={cn(
                'rounded-lg border p-4 space-y-3 transition-shadow hover:shadow-sm',
                b.severity === 'critical' ? 'border-red-200 bg-red-50/30' :
                b.severity === 'high' ? 'border-orange-200 bg-orange-50/30' :
                b.severity === 'medium' ? 'border-yellow-200 bg-yellow-50/30' :
                'border-green-200 bg-green-50/30'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{b.processName}</span>
                  <span className="text-xs text-muted-foreground">/ {b.stageName}</span>
                </div>
                <span className={cn('px-2 py-0.5 text-xs rounded-full border font-medium', severityColors[b.severity])}>
                  {severityLabels[b.severity]}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>استخدام الموارد</span>
                  <span className={cn('font-medium', severityProgressColors[b.severity])}>{b.utilization}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', severityFillColors[b.severity])}
                    style={{ width: `${b.utilization}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{b.avgWaitTime} ساعة</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>{b.itemsQueued} عناصر في الانتظار</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
