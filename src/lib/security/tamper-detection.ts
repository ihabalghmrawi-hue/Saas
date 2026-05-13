import { createLogger } from '@/lib/observability/logger'
import { incrementCounter } from '@/lib/metrics/collector'
import { getCorrelationId } from '@/lib/observability/correlation'
import { createHash } from 'crypto'

const logger = createLogger('tamper-detection')

export interface IntegrityRecord {
  id: string
  entityType: string
  entityId: string
  hash: string
  previousHash: string
  timestamp: string
  action: string
  metadata: Record<string, unknown>
  verified: boolean
}

export interface TamperEvent {
  id: string
  entityType: string
  entityId: string
  expectedHash: string
  actualHash: string
  detectedAt: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  details: Record<string, unknown>
}

let integrityChain = new Map<string, IntegrityRecord[]>()
let tamperEvents: TamperEvent[] = []

export function configureTamperStores(stores: {
  integrityChain?: Map<string, IntegrityRecord[]>
  tamperEvents?: TamperEvent[]
}): void {
  if (stores.integrityChain) integrityChain = stores.integrityChain
  if (stores.tamperEvents) tamperEvents = stores.tamperEvents
}

function computeHash(data: string, previousHash: string): string {
  return createHash('sha256').update(`${previousHash}${data}`).digest('hex')
}

function hashData(entityType: string, entityId: string, action: string, metadata: Record<string, unknown>): string {
  return JSON.stringify({ entityType, entityId, action, metadata }, Object.keys({ entityType, entityId, action, metadata }).sort())
}

export function recordIntegrity(
  entityType: string,
  entityId: string,
  data: string,
  action: string,
  metadata?: Record<string, unknown>,
): IntegrityRecord {
  const chain = integrityChain.get(`${entityType}:${entityId}`) || []
  const previousHash = chain.length > 0 ? chain[chain.length - 1].hash : 'GENESIS'

  const record: IntegrityRecord = {
    id: `int_${entityType}_${entityId}_${Date.now()}`,
    entityType,
    entityId,
    hash: computeHash(hashData(entityType, entityId, action, metadata || {}), previousHash),
    previousHash,
    timestamp: new Date().toISOString(),
    action,
    metadata: metadata || {},
    verified: true,
  }

  chain.push(record)
  integrityChain.set(`${entityType}:${entityId}`, chain)
  incrementCounter('integrity_records_created_total', { entityType, action })

  return record
}

export function verifyIntegrity(entityType: string, entityId: string): TamperEvent[] {
  const chain = integrityChain.get(`${entityType}:${entityId}`)
  if (!chain || chain.length === 0) return []

  const events: TamperEvent[] = []

  for (let i = 0; i < chain.length; i++) {
    const record = chain[i]
    const expectedPreviousHash = i === 0 ? 'GENESIS' : chain[i - 1].hash
    const rehashed = computeHash(
      hashData(record.entityType, record.entityId, record.action, record.metadata),
      expectedPreviousHash,
    )

    if (rehashed !== record.hash) {
      const prevChain = integrityChain.get(`${entityType}:${entityId}`)
      const lastVerified = prevChain?.slice(0, i).findLast(r => r.verified)

      const event: TamperEvent = {
        id: `tamper_${entityType}_${entityId}_${Date.now()}`,
        entityType,
        entityId,
        expectedHash: record.hash,
        actualHash: rehashed,
        detectedAt: new Date().toISOString(),
        severity: i === chain.length - 1 ? 'high' : 'critical',
        details: {
          recordIndex: i,
          action: record.action,
          timestamp: record.timestamp,
          lastVerifiedRecord: lastVerified ? { index: chain.indexOf(lastVerified), hash: lastVerified.hash, timestamp: lastVerified.timestamp } : null,
        },
      }

      events.push(event)
      tamperEvents.push(event)
      record.verified = false
      incrementCounter('tamper_events_detected_total', { entityType, severity: event.severity })
      logger.error(`Tamper detected: ${entityType}:${entityId} at record ${i}`, undefined, {
        eventId: event.id,
        entityType,
        entityId,
        severity: event.severity,
      })
    } else {
      record.verified = true
    }
  }

  return events
}

export function getIntegrityChain(entityType: string, entityId: string): IntegrityRecord[] {
  return integrityChain.get(`${entityType}:${entityId}`) || []
}

export function getTamperEvents(entityType?: string, entityId?: string, minSeverity?: TamperEvent['severity']): TamperEvent[] {
  const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 }

  return tamperEvents.filter(e => {
    if (entityType && e.entityType !== entityType) return false
    if (entityId && e.entityId !== entityId) return false
    if (minSeverity && (severityOrder[e.severity] < severityOrder[minSeverity])) return false
    return true
  })
}

export interface TamperDetectionConfig {
  enabled: boolean
  alertOnDetection: boolean
  blockOnCritical: boolean
  autoVerificationInterval: number
}

const DEFAULT_TAMPER_CONFIG: TamperDetectionConfig = {
  enabled: true,
  alertOnDetection: true,
  blockOnCritical: true,
  autoVerificationInterval: 3600000,
}

export function createTamperDetectionConfig(overrides: Partial<TamperDetectionConfig>): TamperDetectionConfig {
  return { ...DEFAULT_TAMPER_CONFIG, ...overrides }
}

export function hashEntityData(entity: Record<string, unknown>, sensitiveFields: string[] = []): string {
  const sanitized = { ...entity }
  for (const field of sensitiveFields) {
    delete sanitized[field]
  }
  return createHash('sha256').update(JSON.stringify(sanitized, Object.keys(sanitized).sort())).digest('hex')
}
