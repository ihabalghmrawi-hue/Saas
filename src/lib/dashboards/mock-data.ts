import type {
  BottleneckMetric, SLABreachMetric, ThroughputMetric,
  ApprovalLatencyMetric, ProcessHealthMetric, DashboardSummary,
} from './types'

export function generateMockBottlenecks(): BottleneckMetric[] {
  return [
    { processName: 'دورة المشتريات للدفع', stageName: 'اعتماد أمر الشراء', avgWaitTime: 480, itemsQueued: 12, utilization: 92, severity: 'critical' },
    { processName: 'دورة المشتريات للدفع', stageName: 'مطابقة الفاتورة', avgWaitTime: 360, itemsQueued: 8, utilization: 85, severity: 'high' },
    { processName: 'دورة الطلب إلى النقد', stageName: 'اعتماد الطلب', avgWaitTime: 420, itemsQueued: 10, utilization: 88, severity: 'high' },
    { processName: 'معالجة الرواتب', stageName: 'اعتماد كشوف الرواتب', avgWaitTime: 300, itemsQueued: 3, utilization: 75, severity: 'medium' },
    { processName: 'الإغلاق المالي', stageName: 'تسوية الحسابات', avgWaitTime: 540, itemsQueued: 5, utilization: 90, severity: 'critical' },
    { processName: 'تزويد المخزون', stageName: 'فحص الجودة', avgWaitTime: 240, itemsQueued: 6, utilization: 70, severity: 'medium' },
    { processName: 'دورة التسوية', stageName: 'التحقق من الفروقات', avgWaitTime: 600, itemsQueued: 9, utilization: 95, severity: 'critical' },
    { processName: 'دورة الطلب إلى النقد', stageName: 'التجهيز', avgWaitTime: 180, itemsQueued: 15, utilization: 80, severity: 'medium' },
  ]
}

export function generateMockSLABreaches(): SLABreachMetric[] {
  return [
    { processName: 'دورة المشتريات للدفع', totalSLAs: 45, breached: 8, warningCount: 12, okCount: 25, avgBreachTime: 120, trend: 'up' },
    { processName: 'دورة الطلب إلى النقد', totalSLAs: 52, breached: 5, warningCount: 10, okCount: 37, avgBreachTime: 90, trend: 'stable' },
    { processName: 'الإغلاق المالي', totalSLAs: 20, breached: 3, warningCount: 5, okCount: 12, avgBreachTime: 180, trend: 'down' },
    { processName: 'معالجة الرواتب', totalSLAs: 15, breached: 1, warningCount: 3, okCount: 11, avgBreachTime: 60, trend: 'down' },
    { processName: 'تزويد المخزون', totalSLAs: 30, breached: 6, warningCount: 8, okCount: 16, avgBreachTime: 150, trend: 'up' },
    { processName: 'دورة التسوية', totalSLAs: 25, breached: 4, warningCount: 6, okCount: 15, avgBreachTime: 100, trend: 'stable' },
  ]
}

export function generateMockThroughput(): ThroughputMetric[] {
  const now = Date.now()
  const day = 86400000
  return Array.from({ length: 14 }, (_, i) => ({
    period: new Date(now - (13 - i) * day).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' }),
    completed: Math.floor(Math.random() * 20) + 10,
    started: Math.floor(Math.random() * 15) + 5,
    failed: Math.floor(Math.random() * 3),
    avgCompletionTime: Math.floor(Math.random() * 240) + 60,
  }))
}

export function generateMockApprovalLatency(): ApprovalLatencyMetric[] {
  return [
    { stage: 'اعتماد أمر الشراء', avgLatency: 320, minLatency: 45, maxLatency: 960, pendingCount: 12 },
    { stage: 'اعتماد الطلب', avgLatency: 280, minLatency: 30, maxLatency: 720, pendingCount: 10 },
    { stage: 'اعتماد كشوف الرواتب', avgLatency: 180, minLatency: 20, maxLatency: 480, pendingCount: 3 },
    { stage: 'اعتماد الدفع', avgLatency: 240, minLatency: 15, maxLatency: 600, pendingCount: 7 },
    { stage: 'اعتماد التسوية', avgLatency: 420, minLatency: 60, maxLatency: 1440, pendingCount: 5 },
    { stage: 'اعتماد الإقفال', avgLatency: 360, minLatency: 90, maxLatency: 1080, pendingCount: 4 },
  ]
}

export function generateMockProcessHealth(): ProcessHealthMetric[] {
  return [
    { processName: 'دورة المشتريات للدفع', health: 72, activeInstances: 18, slaCompliance: 82, errorRate: 5, throughput: 34, status: 'warning' },
    { processName: 'دورة الطلب إلى النقد', health: 85, activeInstances: 22, slaCompliance: 90, errorRate: 3, throughput: 45, status: 'healthy' },
    { processName: 'تزويد المخزون', health: 68, activeInstances: 12, slaCompliance: 73, errorRate: 8, throughput: 20, status: 'critical' },
    { processName: 'معالجة الرواتب', health: 92, activeInstances: 5, slaCompliance: 93, errorRate: 2, throughput: 8, status: 'healthy' },
    { processName: 'الإغلاق المالي', health: 65, activeInstances: 8, slaCompliance: 75, errorRate: 10, throughput: 12, status: 'critical' },
    { processName: 'دورة التسوية', health: 78, activeInstances: 14, slaCompliance: 84, errorRate: 6, throughput: 22, status: 'warning' },
  ]
}

export function generateMockDashboardSummary(): DashboardSummary {
  return {
    totalActiveProcesses: 79,
    totalCompletedToday: 145,
    avgHealthScore: 77,
    totalSLACompliance: 83,
    bottlenecks: generateMockBottlenecks(),
    slaBreaches: generateMockSLABreaches(),
    throughput: generateMockThroughput(),
    approvalLatency: generateMockApprovalLatency(),
    processHealth: generateMockProcessHealth(),
  }
}
