'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Clock, Hourglass, CheckCircle2, AlertTriangle,
  ArrowUp, ArrowDown, BarChartHorizontal,
} from 'lucide-react'
import type { ApprovalLatencyMetric } from '@/lib/dashboards/types'

interface ApprovalLatencyAnalyticsProps {
  latency: ApprovalLatencyMetric[]
  className?: string
}

const TARGET = 240

type SortKey = 'avg' | 'pending'

export function ApprovalLatencyAnalytics({ latency, className }: ApprovalLatencyAnalyticsProps) {
  const [sortKey, setSortKey] = useState<SortKey>('avg')

  const overallAvg = latency.length > 0
    ? Math.round(latency.reduce((s, l) => s + l.avgLatency, 0) / latency.length)
    : 0
  const fastest = latency.length > 0 ? Math.min(...latency.map(l => l.minLatency)) : 0
  const slowest = latency.length > 0 ? Math.max(...latency.map(l => l.maxLatency)) : 0
  const totalPending = latency.reduce((s, l) => s + l.pendingCount, 0)

  const sorted = [...latency].sort((a, b) => {
    if (sortKey === 'avg') return b.avgLatency - a.avgLatency
    return b.pendingCount - a.pendingCount
  })

  const maxLatency = Math.max(...latency.map(l => l.avgLatency), TARGET)

  return (
    <div dir="rtl" className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hourglass className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">تحليل زمن الموافقات</h3>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border p-3 bg-primary/5 border-primary/20">
          <div className="text-xs text-muted-foreground">متوسط زمن الموافقة</div>
          <div className="text-lg font-bold">{overallAvg} دقيقة</div>
        </div>
        <div className="rounded-lg border p-3 bg-green-50/30 border-green-200">
          <div className="text-xs text-muted-foreground">أسرع موافقة</div>
          <div className="text-lg font-bold text-green-700">{fastest} دقيقة</div>
        </div>
        <div className="rounded-lg border p-3 bg-red-50/30 border-red-200">
          <div className="text-xs text-muted-foreground">أبطأ موافقة</div>
          <div className="text-lg font-bold text-red-700">{slowest} دقيقة</div>
        </div>
        <div className="rounded-lg border p-3 bg-amber-50/30 border-amber-200">
          <div className="text-xs text-muted-foreground">قيد الانتظار</div>
          <div className="text-lg font-bold text-amber-700">{totalPending}</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs">
        <BarChartHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
        {(['avg', 'pending'] as SortKey[]).map(key => (
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
            {key === 'avg' ? 'حسب المتوسط' : 'حسب المعلقة'}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Hourglass className="h-10 w-10 mb-2 opacity-40" />
          <span>لا توجد بيانات زمن الموافقات</span>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((l, idx) => {
            const barWidth = Math.min((l.avgLatency / maxLatency) * 100, 100)
            const barColor = l.avgLatency < TARGET
              ? 'bg-green-500'
              : l.avgLatency < TARGET * 2
                ? 'bg-yellow-500'
                : 'bg-red-500'
            return (
              <div key={idx} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{l.stage}</span>
                  <span className={cn(
                    'px-2 py-0.5 text-xs rounded-full border font-medium',
                    l.pendingCount > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'
                  )}>
                    {l.pendingCount} معلقة
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">متوسط زمن الموافقة</span>
                    <span className="font-medium">{l.avgLatency} دقيقة</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', barColor)}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>الأسرع: {l.minLatency} دقيقة</span>
                    <span>الأبطأ: {l.maxLatency} دقيقة</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>الهدف:</span>
                  <span className={cn(
                    'font-medium',
                    l.avgLatency <= TARGET ? 'text-green-600' : l.avgLatency < TARGET * 2 ? 'text-yellow-600' : 'text-red-600'
                  )}>
                    {TARGET} دقيقة
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
