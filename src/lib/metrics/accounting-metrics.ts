import { incrementCounter, observeHistogram, setGauge } from './collector'

export function recordJournalPosted(type: string, duration: number): void {
  incrementCounter('accounting_journals_posted_total', { type })
  observeHistogram('accounting_journal_post_duration_ms', duration, { type })
}

export function recordJournalReversed(type: string): void {
  incrementCounter('accounting_journals_reversed_total', { type })
}

export function recordPeriodClosed(periodId: string): void {
  incrementCounter('accounting_periods_closed_total')
  setGauge('accounting_last_period_closed', Date.now(), { period: periodId })
}

export function recordReconciliationRun(status: string): void {
  incrementCounter('accounting_reconciliations_total', { status })
}

export function recordIntegrityCheck(status: string, issues: number): void {
  incrementCounter('accounting_integrity_checks_total', { status })
  setGauge('accounting_integrity_issues', issues)
}

export function recordRecurringProcessed(status: string): void {
  incrementCounter('accounting_recurring_processed_total', { status })
}

export function recordPostingRuleApplied(ruleName: string): void {
  incrementCounter('accounting_posting_rules_applied_total', { rule: ruleName })
}

export function recordAgingReportGenerated(reportType: string): void {
  incrementCounter('accounting_aging_reports_total', { type: reportType })
}

export function recordFinancialStatementGenerated(statementType: string): void {
  incrementCounter('accounting_financial_statements_total', { type: statementType })
}

export function recordTrialBalanceCheck(status: string): void {
  incrementCounter('accounting_trial_balance_checks_total', { status })
}

export function recordAccountBalanceRecalculated(): void {
  incrementCounter('accounting_balance_recalculations_total')
}

export function recordApprovalWorkflow(workflowType: string, status: string): void {
  incrementCounter('accounting_approval_workflows_total', { type: workflowType, status })
}
