export {
  registerAlertRule,
  onAlert,
  onAnyAlert,
  evaluateAlerts,
  acknowledgeAlert,
  getActiveAlerts,
  getAlertHistory,
  getAlertsBySeverity,
  registerDefaultAlertHandlers,
} from './alert-engine'

export type { Alert, AlertSeverity, AlertStatus, AlertRule, AlertEvaluation } from './alert-engine'

export {
  registerFinancialIntegrityAlerts,
  registerWorkerAlerts,
  registerPayrollAlerts,
  registerSecurityAlerts,
  registerBackupAlerts,
} from './alert-rules'
