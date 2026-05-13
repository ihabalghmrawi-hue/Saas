import { createLogger } from '@/lib/observability/logger'
import { createHash, randomUUID } from 'crypto'

const logger = createLogger('immutable-log')

export interface ImmutableEntry {
  id: string
  sequence: number
  timestamp: string
  action: string
  actorId: string
  actorName: string
  tenantId: string
  resource: string
  resourceId: string
  changes: Record<string, { old: unknown; new: unknown }>
  metadata: Record<string, unknown>
  hash: string
  previousHash: string
  signature?: string
}

let entries: ImmutableEntry[] = []
let sequence = 0

let sequenceCounter: { increment(): Promise<number>; get(): Promise<number> } | null = null

export function configureImmutableLogStores(stores: {
  entries?: ImmutableEntry[]
  sequence?: number
  sequenceCounter?: { increment(): Promise<number>; get(): Promise<number> }
}): void {
  if (stores.entries !== undefined) entries = stores.entries
  if (stores.sequence !== undefined) sequence = stores.sequence
  if (stores.sequenceCounter !== undefined) sequenceCounter = stores.sequenceCounter
}

function computeChainHash(entry: Omit<ImmutableEntry, 'hash' | 'previousHash'>, previousHash: string): string {
  const data = JSON.stringify({ ...entry, previousHash }, Object.keys({ ...entry, previousHash }).sort())
  return createHash('sha256').update(data).digest('hex')
}

export function appendImmutableEntry(params: {
  action: string
  actorId: string
  actorName: string
  tenantId: string
  resource: string
  resourceId: string
  changes?: Record<string, { old: unknown; new: unknown }>
  metadata?: Record<string, unknown>
}): ImmutableEntry {
  const previousHash = entries.length > 0 ? entries[entries.length - 1].hash : 'GENESIS'
  sequence++
  if (sequenceCounter) {
    sequenceCounter.increment().catch(() => {})
  }

  const entryData = {
    id: randomUUID(),
    sequence,
    timestamp: new Date().toISOString(),
    action: params.action,
    actorId: params.actorId,
    actorName: params.actorName,
    tenantId: params.tenantId,
    resource: params.resource,
    resourceId: params.resourceId,
    changes: params.changes || {},
    metadata: params.metadata || {},
  }

  const hash = computeChainHash(entryData, previousHash)

  const entry: ImmutableEntry = {
    ...entryData,
    hash,
    previousHash,
  }

  entries.push(entry)
  return entry
}

export function verifyChain(tenantId?: string): { valid: boolean; firstBrokenIndex?: number; totalEntries: number } {
  const relevant = tenantId ? entries.filter(e => e.tenantId === tenantId) : entries

  if (relevant.length === 0) return { valid: true, totalEntries: 0 }

  for (let i = 0; i < relevant.length; i++) {
    const entry = relevant[i]
    const expectedPreviousHash = i === 0 ? 'GENESIS' : relevant[i - 1].hash

    if (entry.previousHash !== expectedPreviousHash) {
      return { valid: false, firstBrokenIndex: i, totalEntries: relevant.length }
    }

    const entryData = {
      id: entry.id,
      sequence: entry.sequence,
      timestamp: entry.timestamp,
      action: entry.action,
      actorId: entry.actorId,
      actorName: entry.actorName,
      tenantId: entry.tenantId,
      resource: entry.resource,
      resourceId: entry.resourceId,
      changes: entry.changes,
      metadata: entry.metadata,
    }

    const expectedHash = computeChainHash(entryData, expectedPreviousHash)
    if (entry.hash !== expectedHash) {
      return { valid: false, firstBrokenIndex: i, totalEntries: relevant.length }
    }
  }

  return { valid: true, totalEntries: relevant.length }
}

export function getImmutableEntries(options?: {
  tenantId?: string
  resource?: string
  resourceId?: string
  action?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}): ImmutableEntry[] {
  let filtered = [...entries]

  if (options?.tenantId) filtered = filtered.filter(e => e.tenantId === options.tenantId)
  if (options?.resource) filtered = filtered.filter(e => e.resource === options.resource)
  if (options?.resourceId) filtered = filtered.filter(e => e.resourceId === options.resourceId)
  if (options?.action) filtered = filtered.filter(e => e.action === options.action)
  if (options?.from) filtered = filtered.filter(e => e.timestamp >= options.from!)
  if (options?.to) filtered = filtered.filter(e => e.timestamp <= options.to!)

  filtered.sort((a, b) => b.sequence - a.sequence)

  const offset = options?.offset || 0
  const limit = options?.limit || 100
  return filtered.slice(offset, offset + limit)
}

export function exportImmutableLog(format: 'json' | 'csv' = 'json', tenantId?: string): string {
  const data = tenantId ? entries.filter(e => e.tenantId === tenantId) : entries

  if (format === 'csv') {
    const headers = ['id', 'sequence', 'timestamp', 'action', 'actorId', 'actorName', 'tenantId', 'resource', 'resourceId', 'hash', 'previousHash']
    const lines = [headers.join(',')]
    for (const entry of data) {
      lines.push(headers.map(h => {
        const v = (entry as any)[h]
        const s = v === undefined ? '' : String(v)
        return s.includes(',') ? `"${s.replace(/"/g, '""')}"` : s
      }).join(','))
    }
    return lines.join('\n')
  }

  return JSON.stringify(data, null, 2)
}

export function getChainStats(tenantId?: string): { totalEntries: number; uniqueActors: number; uniqueResources: number; dateRange: { from: string; to: string } | null } {
  const data = tenantId ? entries.filter(e => e.tenantId === tenantId) : entries

  if (data.length === 0) {
    return { totalEntries: 0, uniqueActors: 0, uniqueResources: 0, dateRange: null }
  }

  return {
    totalEntries: data.length,
    uniqueActors: new Set(data.map(e => e.actorId)).size,
    uniqueResources: new Set(data.map(e => e.resource)).size,
    dateRange: {
      from: data[0].timestamp,
      to: data[data.length - 1].timestamp,
    },
  }
}

export function clearEntries(): void {
  entries.length = 0
  sequence = 0
}
