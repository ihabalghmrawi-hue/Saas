import type { AccountingEventType } from '../types'

export interface AccountingEventPayload {
  id: string
  type: AccountingEventType
  companyId: string
  journalEntryId?: string
  entryNumber?: string
  amount: number
  description: string
  reference?: string
  sourceId?: string
  source?: string
  date?: string
  metadata?: Record<string, unknown>
  performedBy?: string
  timestamp: string
}

export type EventHandler = (event: AccountingEventPayload) => Promise<void>

export type AccountingDomainEvent =
  | 'accounting.journal.created'
  | 'accounting.journal.posted'
  | 'accounting.journal.reversed'
  | 'accounting.journal.voided'
  | 'accounting.period.closed'
  | 'accounting.period.opened'
  | 'accounting.reconciliation.completed'
  | 'accounting.reconciliation.matched'
  | 'accounting.integrity.failed'
  | 'accounting.integrity.passed'
  | 'accounting.account.created'
  | 'accounting.account.updated'
  | 'accounting.fiscal.year.closed'
  | 'accounting.recurring.executed'
  | 'accounting.snapshot.created'
