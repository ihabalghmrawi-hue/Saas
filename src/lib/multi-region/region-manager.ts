import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('region-manager')

export interface Region {
  id: string
  name: string
  endpoint: string
  status: 'active' | 'standby' | 'failed' | 'maintenance'
  priority: number
  capabilities: string[]
  latency: number
  lastHealthCheck: string
}

export interface ReplicaInfo {
  id: string
  region: string
  type: 'read' | 'write' | 'read_write'
  endpoint: string
  status: 'online' | 'offline' | 'syncing'
  lag: number
}

export interface TenantRegionAssignment {
  tenantId: string
  primaryRegion: string
  failoverRegion: string
  readRegions: string[]
  assignedAt: string
}

let regions = new Map<string, Region>()
let replicas = new Map<string, ReplicaInfo>()
let tenantAssignments = new Map<string, TenantRegionAssignment>()

export function configureRegionStores(stores: {
  regions?: Map<string, Region>
  replicas?: Map<string, ReplicaInfo>
  tenantAssignments?: Map<string, TenantRegionAssignment>
}): void {
  if (stores.regions) regions = stores.regions
  if (stores.replicas) replicas = stores.replicas
  if (stores.tenantAssignments) tenantAssignments = stores.tenantAssignments
}

const DEFAULT_REGIONS: Region[] = [
  { id: 'us-east', name: 'US East (N. Virginia)', endpoint: 'https://us-east.api.example.com', status: 'active', priority: 1, capabilities: ['read', 'write', 'queue', 'backup'], latency: 5, lastHealthCheck: new Date().toISOString() },
  { id: 'eu-west', name: 'EU West (Ireland)', endpoint: 'https://eu-west.api.example.com', status: 'active', priority: 2, capabilities: ['read', 'write', 'queue'], latency: 10, lastHealthCheck: new Date().toISOString() },
  { id: 'me-central', name: 'Middle East (Bahrain)', endpoint: 'https://me-central.api.example.com', status: 'active', priority: 3, capabilities: ['read', 'write'], latency: 2, lastHealthCheck: new Date().toISOString() },
  { id: 'ap-southeast', name: 'Asia Pacific (Singapore)', endpoint: 'https://ap-southeast.api.example.com', status: 'standby', priority: 4, capabilities: ['read'], latency: 50, lastHealthCheck: new Date().toISOString() },
]

export function loadDefaultRegions(): void {
  for (const region of DEFAULT_REGIONS) {
    regions.set(region.id, region)
  }
  logger.info(`Loaded ${DEFAULT_REGIONS.length} default regions`)
}

export function registerRegion(region: Region): void {
  regions.set(region.id, region)
  logger.info(`Region registered: ${region.name} (${region.id})`)
}

export function getRegion(regionId: string): Region | undefined {
  return regions.get(regionId)
}

export function getAllRegions(): Region[] {
  return Array.from(regions.values()).sort((a, b) => a.priority - b.priority)
}

export function getActiveRegions(): Region[] {
  return getAllRegions().filter(r => r.status === 'active')
}

export function getPrimaryRegion(): Region | undefined {
  return getActiveRegions().find(r => r.capabilities.includes('write'))
}

export function assignTenantToRegion(tenantId: string, tenantGeo?: string): TenantRegionAssignment {
  const activeRegions = getActiveRegions()

  const primaryRegion = activeRegions.find(r => r.id === 'me-central') ||
    activeRegions.find(r => r.id === 'eu-west') ||
    activeRegions[0]

  const failoverRegion = activeRegions.find(r => r.id !== primaryRegion.id && r.capabilities.includes('write'))

  const readRegions = activeRegions
    .filter(r => r.id !== primaryRegion.id && r.capabilities.includes('read'))
    .slice(0, 2)
    .map(r => r.id)

  const assignment: TenantRegionAssignment = {
    tenantId,
    primaryRegion: primaryRegion.id,
    failoverRegion: failoverRegion?.id || primaryRegion.id,
    readRegions,
    assignedAt: new Date().toISOString(),
  }

  tenantAssignments.set(tenantId, assignment)
  logger.info(`Tenant ${tenantId} assigned to region ${primaryRegion.id} with failover ${failoverRegion?.id}`)
  return assignment
}

export function getTenantAssignment(tenantId: string): TenantRegionAssignment | undefined {
  return tenantAssignments.get(tenantId)
}

export function getTenantReadEndpoints(tenantId: string): string[] {
  const assignment = tenantAssignments.get(tenantId)
  if (!assignment) return []

  const endpoints: string[] = []
  for (const regionId of [assignment.primaryRegion, ...assignment.readRegions]) {
    const region = regions.get(regionId)
    if (region && region.status === 'active') {
      endpoints.push(region.endpoint)
    }
  }

  return endpoints
}

export async function failoverTenant(tenantId: string): Promise<{ success: boolean; newPrimary: string }> {
  const assignment = tenantAssignments.get(tenantId)
  if (!assignment) return { success: false, newPrimary: '' }

  const currentPrimary = regions.get(assignment.primaryRegion)
  const targetFailover = regions.get(assignment.failoverRegion)

  if (!targetFailover || targetFailover.status === 'failed') {
    const fallback = getActiveRegions().find(r => r.id !== assignment.primaryRegion && r.capabilities.includes('write'))
    if (!fallback) return { success: false, newPrimary: '' }

    assignment.failoverRegion = fallback.id
  }

  const oldPrimary = assignment.primaryRegion
  assignment.primaryRegion = assignment.failoverRegion
  assignment.readRegions = assignment.readRegions.filter(r => r !== assignment.failoverRegion)
  assignment.readRegions.push(oldPrimary)

  logger.warn(`Tenant ${tenantId} failed over from ${oldPrimary} to ${assignment.primaryRegion}`)
  return { success: true, newPrimary: assignment.primaryRegion }
}

export async function performRegionHealthCheck(regionId: string, checkFn: (region: Region) => Promise<boolean>): Promise<boolean> {
  const region = regions.get(regionId)
  if (!region) return false

  try {
    const healthy = await checkFn(region)
    region.status = healthy ? 'active' : 'failed'
    region.lastHealthCheck = new Date().toISOString()
    region.latency = healthy ? region.latency : -1
    return healthy
  } catch {
    region.status = 'failed'
    region.lastHealthCheck = new Date().toISOString()
    return false
  }
}

export function registerReplica(replica: ReplicaInfo): void {
  replicas.set(replica.id, replica)
}

export function getReplicas(regionId?: string): ReplicaInfo[] {
  const all = Array.from(replicas.values())
  return regionId ? all.filter(r => r.region === regionId) : all
}

export function updateReplicaLag(replicaId: string, lag: number): void {
  const replica = replicas.get(replicaId)
  if (replica) {
    replica.lag = lag
  }
}

export function selectReadReplica(tenantId: string, preferredRegion?: string): ReplicaInfo | undefined {
  const assignment = tenantAssignments.get(tenantId)
  if (!assignment) return undefined

  const candidateRegions = preferredRegion
    ? [preferredRegion, ...assignment.readRegions]
    : assignment.readRegions

  for (const regionId of candidateRegions) {
    const regionReplicas = getReplicas(regionId).filter(r => r.status === 'online' && r.lag < 5)
    if (regionReplicas.length > 0) {
      return regionReplicas.reduce((a, b) => a.lag < b.lag ? a : b)
    }
  }

  return undefined
}

export function getTenantRegionDistribution(): Record<string, number> {
  const distribution: Record<string, number> = {}
  for (const [, assignment] of tenantAssignments) {
    distribution[assignment.primaryRegion] = (distribution[assignment.primaryRegion] || 0) + 1
  }
  return distribution
}
