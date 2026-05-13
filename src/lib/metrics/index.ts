export {
  incrementCounter,
  setGauge,
  observeHistogram,
  getMetric,
  getAllMetrics,
  generatePrometheusFormat,
  resetMetrics,
  recordDBQuery,
  recordRPCCall,
  recordQueueOperation,
  recordWorkerHeartbeat,
  recordAccountingTransaction,
  recordCacheOperation,
  recordWebhookDelivery,
  recordBackupOperation,
} from './collector'

export type { MetricValue } from './collector'

export {
  registerHealthCheck,
  runHealthChecks,
  createDbHealthChecker,
  createRedisHealthChecker,
  createQueueHealthChecker,
  createMemoryHealthChecker,
  livenessCheck,
  startupTime,
} from './health-probes'

export type { HealthCheckResult, HealthReport, HealthChecker } from './health-probes'

export {
  recordJournalPosted,
  recordJournalReversed,
  recordPeriodClosed,
  recordReconciliationRun,
  recordIntegrityCheck,
  recordRecurringProcessed,
  recordPostingRuleApplied,
  recordAgingReportGenerated,
  recordFinancialStatementGenerated,
  recordTrialBalanceCheck,
  recordAccountBalanceRecalculated,
  recordApprovalWorkflow,
} from './accounting-metrics'
