'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Clock, AlertCircle, CheckCircle2, TrendingUp, TrendingDown,
  Minus, Filter,
} from 'lucide-react'
import type { SLABreachMetric } from '@/lib/dashboards/types'

interface SLABreachDashboardProps {
  breaches: SLABreachMetric[]
  className?: string
}

const trendLabels: Record<string, string> = {
  all: 'الكل',
  up: 'مرتفع',
  down: 'منخفض',
  stable: 'مستقر',
}

function DonutChart({ breached, warningCount, okCount, total }: { breached: number; warningCount: number; okCount: number; total: number }) {
  if (total === 0) return <div className="h-20 w-20 rounded-full bg-muted" />

  const breachDeg = (breached / total) * 360
  const warningDeg = (warningCount / total) * 360
  const okDeg = (okCount / total) * 360

  const gradientParts: string[] = []
  if (breachDeg > 0) gradientParts.push(`#ef4444 ${0}deg ${breachDeg}deg`)
  if (warningDeg > 0) gradientParts.push(`#f59e0b ${breachDeg}deg ${breachDeg + warningDeg}deg`)
  if (okDeg > 0) gradientParts.push(`#22c55e ${breachDeg + warningDeg}deg ${breachDeg + warningDeg + okDeg}deg`)

  return (
    <div className="relative h-20 w-20">
      <div
        className="h-20 w-20 rounded-full"
        style={{ background: `conic-gradient(${gradientParts.join(', ')})` }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-card flex items-center justify-center">
          <span className="text-xs font-bold">{total}</span>
        </div>
      </div>
    </div>
  )
}

export function SLABreachDashboard({ breaches, className }: SLABreachDashboardProps) {
  const [trendFilter, setTrendFilter] = useState<string>('all')

  const filtered = breaches.filter(b => trendFilter === 'all' || b.trend === trendFilter)

  return (
    <div dir="rtl" className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-destructive" />
          <h3 className="text-lg font-semibold">تحليل اختراقات SLA</h3>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {['all', 'up', 'down', 'stable'].map(t => (
          <button
            key={t}
            onClick={() => setTrendFilter(t)}
            className={cn(
              'px-3 py-1 text-xs rounded-full border transition-colors',
              trendFilter === t
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted'
            )}
          >
            {trendLabels[t]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mb-2 opacity-40" />
          <span>لا توجد اختراقات SLA</span>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((b, idx) => (
            <div key={idx} className="rounded-lg border p-4 space-y-3 transition-shadow hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{b.processName}</span>
                {b.trend === 'up' ? (
                  <div className="flex items-center gap-1 text-xs text-red-600">
                    <TrendingUp className="h-4 w-4" />
                    <span>مرتفع</span>
                  </div>
                ) : b.trend === 'down' ? (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <TrendingDown className="h-4 w-4" />
                    <span>منخفض</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Minus className="h-4 w-4" />
                    <span>مستقر</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <DonutChart breached={b.breached} warningCount={b.warningCount} okCount={b.okCount} total={b.totalSLAs} />

                <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="text-muted-foreground">مخترق:</span>
                    <span className="font-medium">{b.breached}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                    <span className="text-muted-foreground">تحذير:</span>
                    <span className="font-medium">{b.warningCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-muted-foreground">سليم:</span>
                    <span className="font-medium">{b.okCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">متوسط الاختراق:</span>
                    <span className="font-medium">{b.avgBreachTime} دقيقة</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
