import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('restore-validator')

export interface RestoreValidation {
  restoreId: string
  backupId: string
  status: 'pending' | 'running' | 'passed' | 'failed'
  checks: RestoreCheck[]
  startedAt: string
  completedAt?: string
  summary: string
}

export interface RestoreCheck {
  name: string
  status: 'passed' | 'failed' | 'warning'
  message: string
  details?: Record<string, unknown>
}

export type TableValidator = (table: string, rowCount: number) => Promise<RestoreCheck>
export type IntegrityValidator = () => Promise<RestoreCheck>
export type DataConsistencyValidator = (companyId: string) => Promise<RestoreCheck[]>

export async function validateRestore(
  backupId: string,
  companyId: string,
  tableRowCounts: Record<string, number>,
  validateTable: TableValidator,
  validateIntegrity: IntegrityValidator,
  validateDataConsistency: DataConsistencyValidator,
): Promise<RestoreValidation> {
  const startedAt = new Date().toISOString()
  const restoreId = `restore_validate_${backupId}_${Date.now()}`
  const checks: RestoreCheck[] = []

  const validation: RestoreValidation = {
    restoreId,
    backupId,
    status: 'running',
    checks,
    startedAt,
    summary: 'Restore validation in progress',
  }

  try {
    for (const [table, count] of Object.entries(tableRowCounts)) {
      const check = await validateTable(table, count)
      checks.push(check)
    }

    const integrityCheck = await validateIntegrity()
    checks.push(integrityCheck)

    const dataChecks = await validateDataConsistency(companyId)
    checks.push(...dataChecks)

    const hasFailed = checks.some(c => c.status === 'failed')
    validation.status = hasFailed ? 'failed' : 'passed'
    validation.completedAt = new Date().toISOString()
    validation.summary = hasFailed
      ? `Restore validation failed: ${checks.filter(c => c.status === 'failed').length} check(s) failed`
      : 'Restore validation passed successfully'

    if (hasFailed) {
      logger.error('Restore validation failed', undefined, {
        data: { restoreId, backupId, failedChecks: checks.filter(c => c.status === 'failed').map(c => c.name) },
      })
    } else {
      logger.info('Restore validation passed', { data: { restoreId, backupId, totalChecks: checks.length } })
    }
  } catch (error) {
    validation.status = 'failed'
    validation.completedAt = new Date().toISOString()
    validation.summary = `Restore validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    logger.error('Restore validation threw exception', error instanceof Error ? error : undefined, { data: { restoreId, backupId } })
  }

  return validation
}

export function createReconciliationValidator(
  getReconciliationStatus: (companyId: string) => Promise<{ matched: number; unmatched: number; totalDifference: number }>,
): DataConsistencyValidator {
  return async (companyId: string) => {
    const status = await getReconciliationStatus(companyId)
    return [{
      name: 'reconciliation_consistency',
      status: status.unmatched === 0 ? 'passed' : 'failed',
      message: status.unmatched === 0
        ? `All ${status.matched} accounts reconciled`
        : `${status.unmatched} unmatched accounts with total difference of ${status.totalDifference}`,
      details: { matched: status.matched, unmatched: status.unmatched, totalDifference: status.totalDifference },
    }]
  }
}

export function createTrialBalanceValidator(
  checkTrialBalance: (companyId: string) => Promise<{ balanced: boolean; difference: number; entryCount: number }>,
): DataConsistencyValidator {
  return async (companyId: string) => {
    const tb = await checkTrialBalance(companyId)
    return [{
      name: 'trial_balance',
      status: tb.balanced ? 'passed' : 'failed',
      message: tb.balanced
        ? `Trial balance balanced with ${tb.entryCount} entries`
        : `Trial balance off by ${tb.difference}`,
      details: { balanced: tb.balanced, difference: tb.difference, entryCount: tb.entryCount },
    }]
  }
}
