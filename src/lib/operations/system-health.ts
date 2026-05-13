import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('system-health')

export interface SystemComponent {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  lastCheck: string
  metrics: Record<string, number>
  details: string
}

export interface SystemHealthSummary {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy'
  components: SystemComponent[]
  uptime: number
  lastUpdated: string
  version: string
}

export interface QueueHealth {
  queueName: string
  depth: number
  activeWorkers: number
  processingRate: number
  errorRate: number
  avgLatency: number
  oldestJobAge: number
  status: 'healthy' | 'degraded' | 'stalled'
}

export interface WorkerStatus {
  workerId: string
  name: string
  status: 'active' | 'idle' | 'busy' | 'failed'
  currentJob?: string
  uptime: number
  jobsProcessed: number
  lastHeartbeat: string
  memoryUsage: number
  cpuUsage: number
}

export interface ReconciliationStatus {
  totalAccounts: number
  reconciledAccounts: number
  unmatchedCount: number
  totalDifference: number
  lastReconciliationRun: string
  status: 'current' | 'behind' | 'failed'
}

export interface FinancialIntegritySummary {
  trialBalanceStatus: 'balanced' | 'unbalanced'
  unbalancedEntries: number
  lastIntegrityCheck: string
  unreconciledTransactions: number
  openPeriods: number
  integrityScore: number
}

export interface DeploymentStatus {
  currentVersion: string
  previousVersion: string
  deployedAt: string
  healthCheckPassed: boolean
  rollbackAvailable: boolean
  deploymentHistory: Array<{ version: string; deployedAt: string; status: string }>
}

export interface BackupHealth {
  lastBackupAt: string
  lastBackupStatus: 'success' | 'failed'
  totalBackups: number
  totalSizeGB: number
  oldestBackup: string
  retentionDays: number
  pitrAvailable: boolean
}

const START_TIME = Date.now()

export function getSystemUptime(): number {
  return Date.now() - START_TIME
}

export function assessOverallHealth(components: SystemComponent[]): 'healthy' | 'degraded' | 'unhealthy' {
  if (components.some(c => c.status === 'unhealthy')) return 'unhealthy'
  if (components.some(c => c.status === 'degraded')) return 'degraded'
  return 'healthy'
}

export function buildSystemSummary(
  components: SystemComponent[],
  version?: string,
): SystemHealthSummary {
  return {
    overallStatus: assessOverallHealth(components),
    components,
    uptime: getSystemUptime(),
    lastUpdated: new Date().toISOString(),
    version: version || '1.0.0',
  }
}

export function createComponent(
  name: string,
  status: SystemComponent['status'],
  details: string,
  metrics?: Record<string, number>,
): SystemComponent {
  return { name, status, lastCheck: new Date().toISOString(), metrics: metrics || {}, details }
}

export function createQueueHealthReport(getQueueDetails: (name: string) => Promise<QueueHealth>): () => Promise<QueueHealth[]> {
  const queues = ['accounting', 'reconciliation', 'recurring', 'backup', 'webhook', 'notifications']

  return async () => {
    const results: QueueHealth[] = []
    for (const queue of queues) {
      try {
        const health = await getQueueDetails(queue)
        results.push(health)
      } catch (error) {
        results.push({
          queueName: queue,
          depth: -1, activeWorkers: 0, processingRate: 0, errorRate: 1,
          avgLatency: 0, oldestJobAge: 0, status: 'stalled',
        })
      }
    }
    return results
  }
}

export function createFinancialHealthSummary(
  getTrialBalance: () => Promise<{ balanced: boolean; count: number }>,
  getIntegrityStatus: () => Promise<{ passed: boolean; lastCheck: string }>,
  getUnreconciled: () => Promise<number>,
  getOpenPeriods: () => Promise<number>,
): () => Promise<FinancialIntegritySummary> {
  return async () => {
    const [tb, integrity, unreconciled, openPeriods] = await Promise.all([
      getTrialBalance(),
      getIntegrityStatus(),
      getUnreconciled(),
      getOpenPeriods(),
    ])

    const issues = (tb.balanced ? 0 : 1) + (integrity.passed ? 0 : 1) + (unreconciled > 0 ? 1 : 0)
    const integrityScore = Math.max(0, 100 - issues * 25)

    return {
      trialBalanceStatus: tb.balanced ? 'balanced' : 'unbalanced',
      unbalancedEntries: tb.count,
      lastIntegrityCheck: integrity.lastCheck,
      unreconciledTransactions: unreconciled,
      openPeriods,
      integrityScore,
    }
  }
}
