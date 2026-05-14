import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('retention-engine')

export interface RetentionPolicy {
  category: string
  retentionDays: number
  action: 'delete' | 'archive' | 'anonymize'
  legalHold: boolean
  description: string
}

export interface LegalHold {
  id: string
  entityType: string
  entityIds: string[]
  reason: string
  placedBy: string
  placedAt: string
  expiresAt?: string
  active: boolean
}

const policies: RetentionPolicy[] = []
const legalHolds: LegalHold[] = []

const DEFAULT_POLICIES: RetentionPolicy[] = [
  { category: 'audit_logs', retentionDays: 3650, action: 'archive', legalHold: true, description: 'Audit logs retained for 10 years' },
  { category: 'financial_records', retentionDays: 3650, action: 'archive', legalHold: true, description: 'Financial records retained for 10 years (regulatory)' },
  { category: 'journal_entries', retentionDays: 3650, action: 'archive', legalHold: true, description: 'Journal entries retained for 10 years' },
  { category: 'tax_records', retentionDays: 3650, action: 'archive', legalHold: true, description: 'Tax records retained for 10 years' },
  { category: 'customer_records', retentionDays: 1825, action: 'anonymize', legalHold: false, description: 'Customer records retained for 5 years then anonymized' },
  { category: 'session_logs', retentionDays: 90, action: 'delete', legalHold: false, description: 'Session logs retained for 90 days' },
  { category: 'api_logs', retentionDays: 365, action: 'delete', legalHold: false, description: 'API logs retained for 1 year' },
  { category: 'temporary_data', retentionDays: 30, action: 'delete', legalHold: false, description: 'Temporary data retained for 30 days' },
  { category: 'backup_snapshots', retentionDays: 30, action: 'delete', legalHold: false, description: 'Backup snapshots retained for 30 days' },
  { category: 'error_logs', retentionDays: 90, action: 'delete', legalHold: false, description: 'Error logs retained for 90 days' },
]

export function loadDefaultPolicies(): void {
  policies.length = 0
  policies.push(...DEFAULT_POLICIES)
  logger.info(`Loaded ${DEFAULT_POLICIES.length} default retention policies`)
}

export function setRetentionPolicy(policy: RetentionPolicy): void {
  const idx = policies.findIndex(p => p.category === policy.category)
  if (idx >= 0) {
    policies[idx] = policy
  } else {
    policies.push(policy)
  }
  logger.info(`Retention policy set: ${policy.category} -> ${policy.retentionDays} days (${policy.action})`)
}

export function getRetentionPolicy(category: string): RetentionPolicy | undefined {
  return policies.find(p => p.category === category)
}

export function getAllRetentionPolicies(): RetentionPolicy[] {
  return [...policies]
}

export function placeLegalHold(entityType: string, entityIds: string[], reason: string, placedBy: string, expiresAt?: string): LegalHold {
  const hold: LegalHold = {
    id: `legal_hold_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    entityType,
    entityIds,
    reason,
    placedBy,
    placedAt: new Date().toISOString(),
    expiresAt,
    active: true,
  }
  legalHolds.push(hold)
  logger.warn(`Legal hold placed on ${entityType}:${entityIds.join(',')} — ${reason}`, { data: { hold } })
  return hold
}

export function releaseLegalHold(holdId: string): boolean {
  const hold = legalHolds.find(h => h.id === holdId)
  if (!hold) return false
  hold.active = false
  logger.info(`Legal hold released: ${holdId}`)
  return true
}

export function getActiveLegalHolds(entityType?: string): LegalHold[] {
  return legalHolds.filter(h => h.active && (!entityType || h.entityType === entityType))
}

export function isUnderLegalHold(entityType: string, entityId: string): boolean {
  return legalHolds.some(h => h.active && h.entityType === entityType && h.entityIds.includes(entityId))
}

export function getExpiredRecords(category: string, referenceDate?: string): { recordIds: string[]; count: number } {
  const policy = policies.find(p => p.category === category)
  if (!policy) return { recordIds: [], count: 0 }

  const cutoff = new Date(referenceDate || Date.now())
  cutoff.setDate(cutoff.getDate() - policy.retentionDays)

  return { recordIds: [], count: 0 }
}

export async function executeRetention(
  category: string,
  getExpiredIds: (cutoff: Date, limit: number) => Promise<string[]>,
  deleteRecords: (ids: string[]) => Promise<number>,
  archiveRecords?: (ids: string[]) => Promise<number>,
  anonymizeRecords?: (ids: string[]) => Promise<number>,
): Promise<{ deleted: number; archived: number; anonymized: number }> {
  const policy = policies.find(p => p.category === category)
  if (!policy) {
    logger.warn(`No retention policy for category: ${category}`)
    return { deleted: 0, archived: 0, anonymized: 0 }
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - policy.retentionDays)

  const expiredIds = await getExpiredIds(cutoff, 1000)
  if (expiredIds.length === 0) return { deleted: 0, archived: 0, anonymized: 0 }

  const underHold = expiredIds.filter(id => isUnderLegalHold(category, id))
  const eligible = expiredIds.filter(id => !underHold.includes(id))

  if (underHold.length > 0) {
    logger.info(`Skipped ${underHold.length} records under legal hold in ${category}`)
  }

  let deleted = 0
  let archived = 0
  let anonymized = 0

  switch (policy.action) {
    case 'delete':
      deleted = await deleteRecords(eligible)
      break
    case 'archive':
      if (archiveRecords) {
        archived = await archiveRecords(eligible)
        deleted = await deleteRecords(eligible)
      }
      break
    case 'anonymize':
      if (anonymizeRecords) {
        anonymized = await anonymizeRecords(eligible)
      }
      break
  }

  logger.info(`Retention executed for ${category}: deleted=${deleted}, archived=${archived}, anonymized=${anonymized}`)
  return { deleted, archived, anonymized }
}
