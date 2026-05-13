export {
  appendImmutableEntry,
  verifyChain,
  getImmutableEntries,
  exportImmutableLog,
  getChainStats,
  clearEntries,
} from './immutable-log'

export type { ImmutableEntry } from './immutable-log'

export {
  loadDefaultPolicies,
  setRetentionPolicy,
  getRetentionPolicy,
  getAllRetentionPolicies,
  placeLegalHold,
  releaseLegalHold,
  getActiveLegalHolds,
  isUnderLegalHold,
  getExpiredRecords,
  executeRetention,
} from './retention-engine'

export type { RetentionPolicy, LegalHold } from './retention-engine'
