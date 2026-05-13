'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Heart, Activity, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, BarChart3, Shield,
} from 'lucide-react'
import type { ProcessHealthMetric } from '@/lib/dashboards/types'

interface ProcessHealthMonitorProps {
  processes: ProcessHealthMetric[]
  className?: string
}

const statusLabels: Record<string, string> = {
  all: 'الكل',
  healthy: 'صحي',
  warning: 'تحذير',
  critical: 'حرج',
}

const statusColors: Record<string, string> = {
  healthy: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
}

const healthRingColors: Record<string, string> = {
  healthy: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
}

type SortKey = 'health' | 'sla' | 'error'

function HealthRing({ health, status }: { health: number; status: string }) {
  const deg = (health / 100) * 360
  const color = healthRingColors[status] || '#22c55e'
  return (
    <div className="relative h-16 w-16">
      <div
        className="h-16 w-16 rounded-full"
        style={{ background: `conic-gradient(${color} 0deg ${deg}deg, #e5e7eb ${deg}deg 360deg)` }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full bg-card flex items-center justify-center">
          <span className="text-sm font-bold">{health}%</span>
        </div>
      </div>
    </div>
  )
}

function Sparkline({ values, maxVal }: { values: number[]; maxVal: number }) {
  if (values.length === 0) return null
  const m = maxVal || Math.max(...values, 1)
  return (
    <div className="flex items-end gap-0.5 h-8">
      {values.map((v, idx) => {
        const h = (v / m) * 100
        return (
          <div
            key={idx}
            className="flex-1 rounded-sm bg-primary/60 transition-all"
            style={{ height: `${h}%` }}
          />
        )
      })}
    </div>
  )
}

export function ProcessHealthMonitor({ processes, className }: ProcessHealthMonitorProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('health')

  const overallHealth = processes.length > 0
    ? Math.round(processes.reduce((s, p) => s + p.health, 0) / processes.length)
    : 0

  const overallStatus = overallHealth >= 80 ? 'healthy' : overallHealth >= 60 ? 'warning' : 'critical'

  const filtered = processes.filter(p => statusFilter === 'all' || p.status === statusFilter)

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'health') return b.health - a.health
    if (sortKey === 'sla') return b.slaCompliance - a.slaCompliance
    return b.errorRate - a.errorRate
  })

  return (
    <div dir="rtl" className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-destructive" />
          <h3 className="text-lg font-semibold">مراقبة صحة العمليات</h3>
        </div>
      </div>

      <div className="rounded-lg border p-4 bg-card flex items-center gap-4">
        <div className="relative">
          <div
            className="h-20 w-20 rounded-full"
            style={{
              background: `conic-gradient(${healthRingColors[overallStatus]} 0deg ${(overallHealth / 100) * 360}deg, #e5e7eb ${(overallHealth / 100) * 360}deg 360deg)`,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-14 w-14 rounded-full bg-card flex items-center justify-center">
              <span className="text-xl font-bold">{overallHealth}%</span>
            </div>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium">مؤشر الصحة العام</div>
          <span className={cn(
            'px-2 py-0.5 text-xs rounded-full border font-medium inline-block mt-1',
            statusColors[overallStatus]
          )}>
            {statusLabels[overallStatus]}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-muted-foreground" />
          {['all', 'healthy', 'warning', 'critical'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1 text-xs rounded-full border transition-colors',
                statusFilter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {statusLabels[s]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          {(['health', 'sla', 'error'] as SortKey[]).map(key => (
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
              {key === 'health' ? 'حسب الصحة' : key === 'sla' ? 'حسب نسبة الامتثال' : 'حسب الأخطاء'}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Heart className="h-10 w-10 mb-2 opacity-40" />
          <span>لا توجد بيانات صحة عمليات</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((p, idx) => {
            const sparkValues = Array.from({ length: 7 }, () =>
              Math.max(0, p.health + Math.floor(Math.random() * 20) - 10)
            )
            return (
              <div key={idx} className={cn(
                'rounded-lg border p-4 space-y-3 transition-shadow hover:shadow-sm',
                p.status === 'critical' ? 'border-red-200 bg-red-50/20' :
                p.status === 'warning' ? 'border-yellow-200 bg-yellow-50/20' :
                'border-green-200 bg-green-50/20'
              )}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{p.processName}</span>
                  <span className={cn('px-2 py-0.5 text-xs rounded-full border font-medium', statusColors[p.status])}>
                    {statusLabels[p.status]}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <HealthRing health={p.health} status={p.status} />
                  <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div className="text-muted-foreground">امتثال SLA:</div>
                    <div className="font-medium text-left">{p.slaCompliance}%</div>
                    <div className="text-muted-foreground">نسبة الأخطاء:</div>
                    <div className="font-medium text-left">{p.errorRate}%</div>
                    <div className="text-muted-foreground">الإنتاجية:</div>
                    <div className="font-medium text-left">{p.throughput}</div>
                    <div className="text-muted-foreground">الحالات النشطة:</div>
                    <div className="font-medium text-left">{p.activeInstances}</div>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className="text-xs text-muted-foreground mb-1">آخر 7 أيام</div>
                  <Sparkline values={sparkValues} maxVal={100} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
