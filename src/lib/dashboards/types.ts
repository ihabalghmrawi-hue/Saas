export interface BottleneckMetric {
  processName: string
  stageName: string
  avgWaitTime: number
  itemsQueued: number
  utilization: number
  severity: 'critical' | 'high' | 'medium' | 'low'
}

export interface SLABreachMetric {
  processName: string
  totalSLAs: number
  breached: number
  warningCount: number
  okCount: number
  avgBreachTime: number
  trend: 'up' | 'down' | 'stable'
}

export interface ThroughputMetric {
  period: string
  completed: number
  started: number
  failed: number
  avgCompletionTime: number
}

export interface ApprovalLatencyMetric {
  stage: string
  avgLatency: number
  minLatency: number
  maxLatency: number
  pendingCount: number
}

export interface ProcessHealthMetric {
  processName: string
  health: number
  activeInstances: number
  slaCompliance: number
  errorRate: number
  throughput: number
  status: 'healthy' | 'warning' | 'critical'
}

export interface DashboardSummary {
  totalActiveProcesses: number
  totalCompletedToday: number
  avgHealthScore: number
  totalSLACompliance: number
  bottlenecks: BottleneckMetric[]
  slaBreaches: SLABreachMetric[]
  throughput: ThroughputMetric[]
  approvalLatency: ApprovalLatencyMetric[]
  processHealth: ProcessHealthMetric[]
}
