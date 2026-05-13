'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  BarChart3, TrendingUp, TrendingDown,
  Activity, ArrowUp, ArrowDown,
} from 'lucide-react'
import type { ThroughputMetric } from '@/lib/dashboards/types'

interface OperationalThroughputDashboardProps {
  throughput: ThroughputMetric[]
  className?: string
}

type RangeKey = 7 | 14 | 30

export function OperationalThroughputDashboard({ throughput, className }: OperationalThroughputDashboardProps) {
  const [range, setRange] = useState<RangeKey>(14)

  const sliced = throughput.slice(-range)

  const completedToday = sliced.reduce((s, d) => s + d.completed, 0)
  const inProgress = sliced.reduce((s, d) => s + d.started, 0)
  const avgTime = sliced.length > 0
    ? Math.round(sliced.reduce((s, d) => s + d.avgCompletionTime, 0) / sliced.length)
    : 0

  const maxCompleted = Math.max(...sliced.map(d => d.completed), 1)
  const maxStarted = Math.max(...sliced.map(d => d.started), 1)
  const maxVal = Math.max(maxCompleted, maxStarted, ...sliced.map(d => d.failed), 1)

  return (
    <div dir="rtl" className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">تحليل الإنتاجية التشغيلية</h3>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 bg-green-50/30 border-green-200">
          <div className="text-xs text-muted-foreground">مكتمل اليوم</div>
          <div className="text-xl font-bold text-green-700">{completedToday}</div>
        </div>
        <div className="rounded-lg border p-3 bg-blue-50/30 border-blue-200">
          <div className="text-xs text-muted-foreground">قيد التنفيذ</div>
          <div className="text-xl font-bold text-blue-700">{inProgress}</div>
        </div>
        <div className="rounded-lg border p-3 bg-amber-50/30 border-amber-200">
          <div className="text-xs text-muted-foreground">متوسط وقت الإنجاز</div>
          <div className="text-xl font-bold text-amber-700">{avgTime} دقيقة</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {([7, 14, 30] as RangeKey[]).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={cn(
              'px-3 py-1 text-xs rounded-full border transition-colors',
              range === r
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted'
            )}
          >
            {r} أيام
          </button>
        ))}
      </div>

      {sliced.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <BarChart3 className="h-10 w-10 mb-2 opacity-40" />
          <span>لا توجد بيانات إنتاجية متاحة</span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-end gap-1" style={{ height: '160px' }}>
            {sliced.map((d, idx) => {
              const completedH = (d.completed / maxVal) * 140
              const startedH = (d.started / maxVal) * 140
              const failedH = (d.failed / maxVal) * 140
              return (
                <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full gap-0.5">
                  <div className="w-full flex flex-col items-center justify-end" style={{ height: '140px' }}>
                    <div
                      className="w-full rounded-t-sm bg-red-400 transition-all"
                      style={{ height: `${failedH}px` }}
                    />
                    <div
                      className="w-full bg-blue-400 transition-all"
                      style={{ height: `${startedH}px` }}
                    />
                    <div
                      className="w-full bg-green-400 transition-all"
                      style={{ height: `${completedH}px` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 truncate w-full text-center">
                    {d.period}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm bg-green-400" />
              <span>مكتمل</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm bg-blue-400" />
              <span>بدأ</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-2.5 rounded-sm bg-red-400" />
              <span>فشل</span>
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-1">
            <div className="text-xs text-muted-foreground">متوسط وقت الإنجاز</div>
            <div className="flex items-end gap-1" style={{ height: '60px' }}>
              {sliced.map((d, idx) => {
                const maxAvg = Math.max(...sliced.map(x => x.avgCompletionTime), 1)
                const h = (d.avgCompletionTime / maxAvg) * 50
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div
                      className="w-full rounded-sm bg-amber-400 transition-all"
                      style={{ height: `${h}px` }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
