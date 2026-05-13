'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  BarChart3, Clock, Activity, Heart, Gauge,
  AlertTriangle, TrendingUp, LayoutDashboard,
} from 'lucide-react'
import { EnterpriseBreadcrumbs } from '@/components/enterprise/Navigation/Breadcrumbs'
import { WorkflowBottleneckDashboard } from './WorkflowBottleneckDashboard'
import { SLABreachDashboard } from './SLABreachDashboard'
import { OperationalThroughputDashboard } from './OperationalThroughputDashboard'
import { ApprovalLatencyAnalytics } from './ApprovalLatencyAnalytics'
import { ProcessHealthMonitor } from './ProcessHealthMonitor'
import { generateMockDashboardSummary } from '@/lib/dashboards/mock-data'

interface OperationalDashboardsProps {
  className?: string
}

const tabs = [
  { key: 'bottlenecks', label: 'الاختناقات', icon: AlertTriangle },
  { key: 'sla', label: 'اختراقات SLA', icon: Clock },
  { key: 'throughput', label: 'الإنتاجية', icon: BarChart3 },
  { key: 'latency', label: 'زمن الموافقات', icon: Gauge },
  { key: 'health', label: 'صحة العمليات', icon: Heart },
]

export function OperationalDashboards({ className }: OperationalDashboardsProps) {
  const [activeTab, setActiveTab] = useState('bottlenecks')
  const summary = generateMockDashboardSummary()

  return (
    <div dir="rtl" className={cn('flex flex-col h-full', className)}>
      <div className="px-6 py-4 border-b bg-card">
        <EnterpriseBreadcrumbs
          items={[
            { label: 'لوحات القيادة', icon: LayoutDashboard },
            { label: 'لوحات القيادة التشغيلية' },
          ]}
        />
        <div className="flex items-center justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold">لوحات القيادة التشغيلية</h1>
            <p className="text-sm text-muted-foreground">نظرة شاملة على الأداء التشغيلي</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-b bg-muted/20">
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              <span>العمليات النشطة</span>
            </div>
            <div className="text-xl font-bold mt-1">{summary.totalActiveProcesses}</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>مكتمل اليوم</span>
            </div>
            <div className="text-xl font-bold mt-1 text-green-600">{summary.totalCompletedToday}</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Heart className="h-3.5 w-3.5" />
              <span>متوسط الصحة</span>
            </div>
            <div className="text-xl font-bold mt-1">{summary.avgHealthScore}%</div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" />
              <span>الامتثال لـ SLA</span>
            </div>
            <div className="text-xl font-bold mt-1 text-blue-600">{summary.totalSLACompliance}%</div>
          </div>
        </div>
      </div>

      <div className="px-6 py-2 border-b bg-card">
        <div className="flex items-center gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 text-sm rounded-t-lg border-b-2 transition-colors',
                  activeTab === tab.key
                    ? 'border-primary text-foreground font-medium bg-muted/30'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'bottlenecks' && (
          <WorkflowBottleneckDashboard bottlenecks={summary.bottlenecks} />
        )}
        {activeTab === 'sla' && (
          <SLABreachDashboard breaches={summary.slaBreaches} />
        )}
        {activeTab === 'throughput' && (
          <OperationalThroughputDashboard throughput={summary.throughput} />
        )}
        {activeTab === 'latency' && (
          <ApprovalLatencyAnalytics latency={summary.approvalLatency} />
        )}
        {activeTab === 'health' && (
          <ProcessHealthMonitor processes={summary.processHealth} />
        )}
      </div>
    </div>
  )
}
