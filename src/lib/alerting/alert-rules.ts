import { registerAlertRule, type AlertRule } from './alert-engine'

export function registerFinancialIntegrityAlerts(
  getUnbalancedEntries: () => Promise<number>,
  getReconciliationMismatches: () => Promise<{ count: number; total: number }>,
  getFailedPostings: () => Promise<{ count: number; lastError: string }>,
): void {
  registerAlertRule({
    name: 'unbalanced_journal_entries',
    severity: 'critical',
    source: 'accounting',
    description: 'Detects unbalanced journal entries that violate double-entry bookkeeping',
    evaluate: async () => {
      const count = await getUnbalancedEntries()
      return {
        firing: count > 0,
        message: count > 0 ? `${count} unbalanced journal entries detected — financial integrity at risk` : 'All journal entries are balanced',
        metadata: { unbalancedCount: count },
      }
    },
  })

  registerAlertRule({
    name: 'reconciliation_mismatch',
    severity: 'critical',
    source: 'accounting',
    description: 'Detects reconciliation mismatches between sub-ledger and general ledger',
    evaluate: async () => {
      const result = await getReconciliationMismatches()
      return {
        firing: result.count > 0,
        message: result.count > 0 ? `${result.count} reconciliation mismatches totaling ${result.total}` : 'All accounts reconciled',
        metadata: { mismatchCount: result.count, mismatchTotal: result.total },
      }
    },
  })

  registerAlertRule({
    name: 'failed_posting_operations',
    severity: 'warning',
    source: 'accounting',
    description: 'Monitors failed journal posting operations',
    evaluate: async () => {
      const result = await getFailedPostings()
      return {
        firing: result.count > 0,
        message: result.count > 0 ? `${result.count} posting failures — last: ${result.lastError}` : 'All postings successful',
        metadata: { failureCount: result.count, lastError: result.lastError },
      }
    },
  })
}

export function registerWorkerAlerts(
  getFailedJobs: (queue: string) => Promise<number>,
  getQueueDepth: (queue: string) => Promise<number>,
  getStalledJobs: (queue: string) => Promise<number>,
): void {
  const queues = ['accounting', 'reconciliation', 'recurring', 'backup', 'webhook', 'notifications']

  for (const queue of queues) {
    registerAlertRule({
      name: `queue_${queue}_saturation`,
      severity: 'warning',
      source: 'queue',
      description: `Monitors ${queue} queue for saturation (depth > 1000)`,
      evaluate: async () => {
        const depth = await getQueueDepth(queue)
        return {
          firing: depth > 1000,
          message: depth > 1000 ? `${queue} queue depth at ${depth} — possible bottleneck` : `${queue} queue healthy (${depth})`,
          metadata: { queue, depth },
        }
      },
    })

    registerAlertRule({
      name: `queue_${queue}_stalled_jobs`,
      severity: 'warning',
      source: 'queue',
      description: `Monitors ${queue} queue for stalled jobs`,
      evaluate: async () => {
        const count = await getStalledJobs(queue)
        return {
          firing: count > 0,
          message: count > 0 ? `${count} stalled jobs in ${queue} queue` : `No stalled jobs in ${queue}`,
          metadata: { queue, stalledCount: count },
        }
      },
    })
  }

  registerAlertRule({
    name: 'worker_failure_rate',
    severity: 'critical',
    source: 'worker',
    description: 'Monitors overall worker failure rate across all queues',
    evaluate: async () => {
      let totalFailed = 0
      for (const queue of queues) {
        totalFailed += await getFailedJobs(queue)
      }
      return {
        firing: totalFailed > 10,
        message: totalFailed > 10 ? `${totalFailed} total failed jobs across all queues` : `Worker failure rate normal (${totalFailed})`,
        metadata: { totalFailed },
      }
    },
  })
}

export function registerPayrollAlerts(
  getAnomalousPayments: () => Promise<{ count: number; total: number }>,
  getMissingPayrollEntries: () => Promise<string[]>,
): void {
  registerAlertRule({
    name: 'payroll_anomaly',
    severity: 'warning',
    source: 'payroll',
    description: 'Detects anomalous payroll payments (unusually high amounts)',
    evaluate: async () => {
      const result = await getAnomalousPayments()
      return {
        firing: result.count > 0,
        message: result.count > 0 ? `${result.count} anomalous payroll payments totaling ${result.total}` : 'No payroll anomalies',
        metadata: { anomalyCount: result.count, anomalyTotal: result.total },
      }
    },
  })

  registerAlertRule({
    name: 'missing_payroll_entries',
    severity: 'critical',
    source: 'payroll',
    description: 'Detects missing payroll journal entries',
    evaluate: async () => {
      const missing = await getMissingPayrollEntries()
      return {
        firing: missing.length > 0,
        message: missing.length > 0 ? `Missing payroll entries for: ${missing.join(', ')}` : 'All payroll entries present',
        metadata: { missingEmployees: missing },
      }
    },
  })
}

export function registerSecurityAlerts(
  getSuspiciousActivities: () => Promise<{ count: number; types: string[] }>,
  getFailedLogins: () => Promise<{ count: number; ip: string }>,
): void {
  registerAlertRule({
    name: 'suspicious_activity',
    severity: 'critical',
    source: 'security',
    description: 'Detects suspicious security activities (tampering, abuse)',
    evaluate: async () => {
      const result = await getSuspiciousActivities()
      return {
        firing: result.count > 0,
        message: result.count > 0 ? `${result.count} suspicious activities detected: ${result.types.join(', ')}` : 'No suspicious activity',
        metadata: { count: result.count, types: result.types },
      }
    },
  })

  registerAlertRule({
    name: 'brute_force_attempt',
    severity: 'critical',
    source: 'security',
    description: 'Detects brute force login attempts',
    evaluate: async () => {
      const result = await getFailedLogins()
      return {
        firing: result.count > 5,
        message: result.count > 5 ? `${result.count} failed login attempts from ${result.ip} — possible brute force` : 'Login attempts within normal range',
        metadata: { count: result.count, ip: result.ip },
      }
    },
  })
}

export function registerBackupAlerts(
  getLastBackupStatus: () => Promise<{ success: boolean; age: number }>,
  getRestoreValidationStatus: () => Promise<{ passed: boolean; errors: string[] }>,
): void {
  registerAlertRule({
    name: 'backup_failure',
    severity: 'critical',
    source: 'backup',
    description: 'Monitors backup job failures',
    evaluate: async () => {
      const result = await getLastBackupStatus()
      return {
        firing: !result.success,
        message: !result.success ? 'Last backup failed — data at risk' : 'Last backup successful',
        metadata: { lastBackupAge: result.age },
      }
    },
  })

  registerAlertRule({
    name: 'restore_validation_failure',
    severity: 'critical',
    source: 'backup',
    description: 'Monitors restore validation failures',
    evaluate: async () => {
      const result = await getRestoreValidationStatus()
      return {
        firing: !result.passed,
        message: !result.passed ? `Restore validation failed: ${result.errors.join('; ')}` : 'Restore validation passed',
        metadata: { errors: result.errors },
      }
    },
  })

  registerAlertRule({
    name: 'stale_backup',
    severity: 'warning',
    source: 'backup',
    description: 'Alerts when backup is older than 24 hours',
    evaluate: async () => {
      const result = await getLastBackupStatus()
      return {
        firing: result.success && result.age > 86400000,
        message: result.age > 86400000 ? `Last backup was ${Math.round(result.age / 3600000)} hours ago` : 'Backup is recent',
        metadata: { ageHours: Math.round(result.age / 3600000) },
      }
    },
  })
}
