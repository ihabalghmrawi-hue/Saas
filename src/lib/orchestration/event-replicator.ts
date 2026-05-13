import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('event-replicator')

export interface ReplicatedEvent {
  id: string
  streamName: string
  sequence: number
  type: string
  source: string
  sourceRegion: string
  targetRegions: string[]
  payload: any
  metadata: Record<string, string>
  timestamp: number
  ttl: number
}

export interface ReplicatedStream {
  name: string
  sourceRegion: string
  targetRegions: string[]
  status: 'active' | 'paused' | 'failed'
  ordering: 'strict' | 'best_effort'
  dedupWindowMs: number
  replayPolicy: 'latest' | 'all' | 'from_sequence'
  lastSequence: number
  lastReplicatedAt: number
  totalEvents: number
  totalDeduped: number
}

export interface ReplayRequest {
  streamName: string
  targetRegion: string
  fromSequence: number
  toSequence?: number
  reason: string
  requestedAt: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
}

export interface ReplicatedEventBatch {
  events: ReplicatedEvent[]
  sourceRegion: string
  targetRegion: string
  batchId: string
  checksum: string
}

let eventStreams = new Map<string, ReplicatedStream>()
let replicatedEvents = new Map<string, ReplicatedEvent>()
let replayRequests = new Map<string, ReplayRequest>()
let dedupCache = new Map<string, number>()
let subscriptionRegistry = new Map<string, Set<string>>()

export function configureEventReplicatorStores(stores: {
  eventStreams?: Map<string, ReplicatedStream>
  replicatedEvents?: Map<string, ReplicatedEvent>
  replayRequests?: Map<string, ReplayRequest>
  dedupCache?: Map<string, number>
  subscriptionRegistry?: Map<string, Set<string>>
}): void {
  if (stores.eventStreams) eventStreams = stores.eventStreams
  if (stores.replicatedEvents) replicatedEvents = stores.replicatedEvents
  if (stores.replayRequests) replayRequests = stores.replayRequests
  if (stores.dedupCache) dedupCache = stores.dedupCache
  if (stores.subscriptionRegistry) subscriptionRegistry = stores.subscriptionRegistry
}

export function registerReplicatedStream(stream: ReplicatedStream): void {
  eventStreams.set(stream.name, stream)
  logger.info(`Replicated stream registered: ${stream.name} (source: ${stream.sourceRegion}, targets: ${stream.targetRegions.join(',')})`)
}

export function getReplicatedStream(name: string): ReplicatedStream | undefined {
  return eventStreams.get(name)
}

export function listReplicatedStreams(region?: string): ReplicatedStream[] {
  const all = Array.from(eventStreams.values())
  return region ? all.filter(s => s.sourceRegion === region || s.targetRegions.includes(region)) : all
}

export async function replicateEvent(event: Omit<ReplicatedEvent, 'id' | 'sequence' | 'timestamp'> & { id?: string; sequence?: number; timestamp?: number }): Promise<ReplicatedEvent> {
  const stream = eventStreams.get(event.streamName)
  if (!stream) throw new Error(`Unknown replicated stream: ${event.streamName}`)
  if (stream.status !== 'active') throw new Error(`Stream ${event.streamName} is not active (${stream.status})`)

  const dedupKey = `${event.streamName}:${event.type}:${JSON.stringify(event.payload)}`
  const dedupTime = dedupCache.get(dedupKey)
  if (dedupTime && Date.now() - dedupTime < stream.dedupWindowMs) {
    stream.totalDeduped++
    throw new Error(`Duplicate event detected in stream ${event.streamName}`)
  }

  const seq = stream.lastSequence + 1
  const replicated: ReplicatedEvent = {
    id: event.id || `${event.streamName}:${seq}:${Date.now().toString(36)}`,
    streamName: event.streamName,
    sequence: seq,
    type: event.type,
    source: event.source,
    sourceRegion: event.sourceRegion,
    targetRegions: event.targetRegions,
    payload: event.payload,
    metadata: event.metadata || {},
    timestamp: event.timestamp || Date.now(),
    ttl: event.ttl || 86_400_000,
  }

  replicatedEvents.set(replicated.id, replicated)
  stream.lastSequence = seq
  stream.totalEvents++
  dedupCache.set(dedupKey, Date.now())

  logger.info(`Event replicated: ${replicated.id} (${replicated.type}) on stream ${event.streamName} seq=${seq}`)

  for (const subscriberId of subscriptionRegistry.get(event.streamName) || []) {
    logger.info(`Notifying subscriber ${subscriberId} of event ${replicated.id}`)
  }

  return replicated
}

export async function batchReplicateEvents(batch: ReplicatedEventBatch): Promise<ReplicatedEvent[]> {
  const results: ReplicatedEvent[] = []
  for (const event of batch.events) {
    try {
      const replicated = await replicateEvent(event)
      results.push(replicated)
    } catch (err) {
      logger.warn(`Batch replicate skipped event ${event.id}: ${err}`)
    }
  }
  return results
}

export function getReplicatedEvent(id: string): ReplicatedEvent | undefined {
  return replicatedEvents.get(id)
}

export function queryReplicatedEvents(streamName: string, options?: { fromSeq?: number; toSeq?: number; type?: string; source?: string; limit?: number }): ReplicatedEvent[] {
  let events = Array.from(replicatedEvents.values())
    .filter(e => e.streamName === streamName)
    .sort((a, b) => a.sequence - b.sequence)

  if (options?.fromSeq) events = events.filter(e => e.sequence >= options.fromSeq!)
  if (options?.toSeq) events = events.filter(e => e.sequence <= options.toSeq!)
  if (options?.type) events = events.filter(e => e.type === options.type)
  if (options?.source) events = events.filter(e => e.source === options.source)
  if (options?.limit) events = events.slice(0, options.limit)

  return events
}

export async function requestReplay(request: Omit<ReplayRequest, 'requestedAt' | 'status'>): Promise<ReplayRequest> {
  const replay: ReplayRequest = {
    ...request,
    requestedAt: Date.now(),
    status: 'pending',
  }
  replayRequests.set(`${request.streamName}:${request.targetRegion}:${request.fromSequence}`, replay)
  logger.info(`Replay requested: ${request.streamName} -> ${request.targetRegion} from seq ${request.fromSequence}`)
  return replay
}

export function getReplayRequest(streamName: string, targetRegion: string, fromSequence: number): ReplayRequest | undefined {
  return replayRequests.get(`${streamName}:${targetRegion}:${fromSequence}`)
}

export function listReplayRequests(targetRegion?: string): ReplayRequest[] {
  const all = Array.from(replayRequests.values())
  return targetRegion ? all.filter(r => r.targetRegion === targetRegion) : all
}

export async function executeReplay(requestId: string): Promise<{ success: boolean; eventsReplayed: number }> {
  const request = Array.from(replayRequests.values()).find(r =>
    `${r.streamName}:${r.targetRegion}:${r.fromSequence}` === requestId
  )
  if (!request) return { success: false, eventsReplayed: 0 }

  request.status = 'in_progress'

  const events = queryReplicatedEvents(request.streamName, {
    fromSeq: request.fromSequence,
    toSeq: request.toSequence,
  })

  let replayed = 0
  for (const event of events) {
    try {
      await replicateEvent({
        ...event,
        id: `${event.id}:replay`,
      })
      replayed++
    } catch (err) {
      logger.warn(`Replay skipped event ${event.id}: ${err}`)
    }
  }

  request.status = 'completed'
  logger.info(`Replay completed: ${request.streamName} -> ${request.targetRegion} (${replayed}/${events.length} events)`)
  return { success: true, eventsReplayed: replayed }
}

export function registerSubscriber(streamName: string, subscriberId: string): void {
  if (!subscriptionRegistry.has(streamName)) subscriptionRegistry.set(streamName, new Set())
  subscriptionRegistry.get(streamName)!.add(subscriberId)
}

export function unregisterSubscriber(streamName: string, subscriberId: string): void {
  subscriptionRegistry.get(streamName)?.delete(subscriberId)
}

export function listSubscribers(streamName: string): string[] {
  return Array.from(subscriptionRegistry.get(streamName) || [])
}

export function getReplicationSummary(): {
  totalStreams: number
  activeStreams: number
  totalEvents: number
  totalDeduped: number
  pendingReplays: number
  activeSubscribers: number
} {
  const streams = listReplicatedStreams()
  return {
    totalStreams: streams.length,
    activeStreams: streams.filter(s => s.status === 'active').length,
    totalEvents: streams.reduce((s, stream) => s + stream.totalEvents, 0),
    totalDeduped: streams.reduce((s, stream) => s + stream.totalDeduped, 0),
    pendingReplays: listReplayRequests().filter(r => r.status === 'pending' || r.status === 'in_progress').length,
    activeSubscribers: Array.from(subscriptionRegistry.values()).reduce((sum, s) => sum + s.size, 0),
  }
}
