import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('multi-region-coordinator')

export enum ReplicationRole {
  PRIMARY = 'primary',
  STANDBY = 'standby',
  READ_REPLICA = 'read_replica',
}

export interface RegionMetadata {
  regionId: string
  name: string
  role: ReplicationRole
  endpoint: string
  priority: number
  status: 'online' | 'offline' | 'degraded' | 'maintenance'
  capabilities: string[]
  connectedRegions: string[]
  latencyMs: number
  lastHealthCheck: number
  version: string
}

export interface ReplicationCoordinator {
  sourceRegion: string
  targetRegion: string
  streamName: string
  status: 'active' | 'paused' | 'failed' | 'catchup'
  lagMs: number
  lastReplicatedOffset: string
  lastReplicatedAt: number
  bytesReplicated: number
  errorCount: number
}

export interface ReplicationLag {
  streamName: string
  sourceRegion: string
  targetRegion: string
  lagMs: number
  lagBytes: number
  lastOffset: string
  lastReplicatedAt: number
  status: 'healthy' | 'warning' | 'critical'
}

export interface RegionRoute {
  regionId: string
  priority: number
  weight: number
  healthy: boolean
  circuitBreaker: {
    failures: number
    lastFailure: number
    state: 'closed' | 'open' | 'half_open'
  }
}

let regionMetadatas = new Map<string, RegionMetadata>()
let replicationCoordinators = new Map<string, ReplicationCoordinator>()
let replicationLags = new Map<string, ReplicationLag>()
let regionRoutes = new Map<string, Map<string, RegionRoute>>()
let globalEventSequence = new Map<string, number>()

export function configureMCRStores(stores: {
  regionMetadatas?: Map<string, RegionMetadata>
  replicationCoordinators?: Map<string, ReplicationCoordinator>
  replicationLags?: Map<string, ReplicationLag>
  regionRoutes?: Map<string, Map<string, RegionRoute>>
  globalEventSequence?: Map<string, number>
}): void {
  if (stores.regionMetadatas) regionMetadatas = stores.regionMetadatas
  if (stores.replicationCoordinators) replicationCoordinators = stores.replicationCoordinators
  if (stores.replicationLags) replicationLags = stores.replicationLags
  if (stores.regionRoutes) regionRoutes = stores.regionRoutes
  if (stores.globalEventSequence) globalEventSequence = stores.globalEventSequence
}

export function registerRegionMetadata(meta: RegionMetadata): void {
  regionMetadatas.set(meta.regionId, meta)
  if (!regionRoutes.has(meta.regionId)) regionRoutes.set(meta.regionId, new Map())
  logger.info(`Region metadata registered: ${meta.regionId} (${meta.role}, ${meta.status})`)
}

export function getRegionMetadata(regionId: string): RegionMetadata | undefined {
  return regionMetadatas.get(regionId)
}

export function listRegionMetadatas(): RegionMetadata[] {
  return Array.from(regionMetadatas.values())
}

export function getActiveRegions(): RegionMetadata[] {
  return listRegionMetadatas().filter(r => r.status === 'online')
}

export function getRegionsByRole(role: ReplicationRole): RegionMetadata[] {
  return listRegionMetadatas().filter(r => r.role === role)
}

export function registerReplicationCoordinator(coordinator: ReplicationCoordinator): void {
  const key = `${coordinator.sourceRegion}:${coordinator.targetRegion}:${coordinator.streamName}`
  replicationCoordinators.set(key, coordinator)
  logger.info(`Replication coordinator registered: ${coordinator.sourceRegion} -> ${coordinator.targetRegion} (${coordinator.streamName})`)
}

export function getReplicationCoordinator(sourceRegion: string, targetRegion: string, streamName: string): ReplicationCoordinator | undefined {
  return replicationCoordinators.get(`${sourceRegion}:${targetRegion}:${streamName}`)
}

export function listReplicationCoordinators(region?: string): ReplicationCoordinator[] {
  const all = Array.from(replicationCoordinators.values())
  return region ? all.filter(c => c.sourceRegion === region || c.targetRegion === region) : all
}

export async function updateReplicationLag(sourceRegion: string, targetRegion: string, streamName: string, lagMs: number, lagBytes: number, offset: string): Promise<void> {
  const key = `${sourceRegion}:${targetRegion}:${streamName}`
  const lag: ReplicationLag = {
    streamName,
    sourceRegion,
    targetRegion,
    lagMs,
    lagBytes,
    lastOffset: offset,
    lastReplicatedAt: Date.now(),
    status: lagMs < 1000 ? 'healthy' : lagMs < 5000 ? 'warning' : 'critical',
  }
  replicationLags.set(key, lag)
}

export function getReplicationLag(sourceRegion: string, targetRegion: string, streamName: string): ReplicationLag | undefined {
  return replicationLags.get(`${sourceRegion}:${targetRegion}:${streamName}`)
}

export function getAllReplicationLags(): ReplicationLag[] {
  return Array.from(replicationLags.values())
}

export function getCriticalReplicationLags(): ReplicationLag[] {
  return getAllReplicationLags().filter(l => l.status === 'critical')
}

export function setRegionRoute(regionId: string, targetRegion: string, route: RegionRoute): void {
  if (!regionRoutes.has(regionId)) regionRoutes.set(regionId, new Map())
  regionRoutes.get(regionId)!.set(targetRegion, route)
}

export function getRegionRoute(regionId: string, targetRegion: string): RegionRoute | undefined {
  return regionRoutes.get(regionId)?.get(targetRegion)
}

export function getAllRoutesForRegion(regionId: string): Map<string, RegionRoute> {
  return regionRoutes.get(regionId) || new Map()
}

export function getNextEventSequence(streamName: string): Promise<number> {
  const seq = (globalEventSequence.get(streamName) || 0) + 1
  globalEventSequence.set(streamName, seq)
  return Promise.resolve(seq)
}

export async function detectCircuitBreakers(): Promise<Array<{ regionId: string; targetRegion: string; breakerState: string }>> {
  const tripped: Array<{ regionId: string; targetRegion: string; breakerState: string }> = []
  for (const [regionId, routes] of regionRoutes) {
    for (const [targetRegion, route] of routes) {
      if (route.circuitBreaker.state === 'open') {
        tripped.push({ regionId, targetRegion, breakerState: 'open' })
      }
    }
  }
  return tripped
}

export async function checkRegionConnectivity(regionId: string): Promise<{ healthy: boolean; routes: number; failedRoutes: number }> {
  const routes = getAllRoutesForRegion(regionId)
  let healthy = 0
  let failed = 0
  for (const [, route] of routes) {
    if (route.healthy) healthy++
    else failed++
  }
  return { healthy: failed === 0, routes: routes.size, failedRoutes: failed }
}

export function getMultiRegionSummary(): {
  totalRegions: number
  activeRegions: number
  totalReplicationStreams: number
  criticalLagStreams: number
  circuitBreakersOpen: number
  totalEventSequences: number
} {
  const regions = listRegionMetadatas()
  return {
    totalRegions: regions.length,
    activeRegions: regions.filter(r => r.status === 'online').length,
    totalReplicationStreams: replicationCoordinators.size,
    criticalLagStreams: getCriticalReplicationLags().length,
    circuitBreakersOpen: Array.from(regionRoutes.values()).reduce((sum, routes) =>
      sum + Array.from(routes.values()).filter(r => r.circuitBreaker.state === 'open').length, 0),
    totalEventSequences: globalEventSequence.size,
  }
}
