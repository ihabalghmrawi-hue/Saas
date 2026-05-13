import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('topology-engine')

export enum TopologyNodeStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  DEGRADED = 'degraded',
  DRAINING = 'draining',
}

export interface ClusterNode {
  id: string
  host: string
  port: number
  role: 'primary' | 'replica' | 'arbiter'
  status: TopologyNodeStatus
  region: string
  zone: string
  capacity: { cpu: number; memory: number; disk: number }
  utilization: { cpu: number; memory: number; disk: number }
  labels: Record<string, string>
  joinedAt: number
  lastHeartbeat: number
}

export interface WorkerTopology {
  workerId: string
  type: string
  region: string
  status: TopologyNodeStatus
  assignedQueues: string[]
  capabilities: string[]
  currentLoad: number
  maxLoad: number
  podName?: string
  nodeName?: string
}

export interface QueuePartitionTopology {
  queueName: string
  partition: number
  leader: string
  replicas: string[]
  region: string
  status: TopologyNodeStatus
  depth: number
  throughput: number
  lagMs: number
  lastProcessedOffset: number
}

export interface RegionTopology {
  regionId: string
  name: string
  status: 'active' | 'standby' | 'failed' | 'maintenance'
  priority: number
  endpoint: string
  workerCount: number
  queueCount: number
  activeTenants: number
  avgLatencyMs: number
  healthScore: number
  capabilities: string[]
  lastUpdated: number
}

export interface SchedulerTopology {
  schedulerId: string
  region: string
  leader: boolean
  status: TopologyNodeStatus
  registeredJobs: number
  activeExecutions: number
  lastHeartbeat: number
}

export interface TenantPlacement {
  tenantId: string
  primaryRegion: string
  failoverRegion: string
  readRegions: string[]
  assignedQueues: string[]
  assignedWorkers: string[]
  placementPolicy: 'latency' | 'capacity' | 'compliance'
  pinned: boolean
  placedAt: number
  lastRebalanced: number
}

export interface TopologySnapshot {
  cluster: ClusterNode[]
  workers: WorkerTopology[]
  queues: QueuePartitionTopology[]
  regions: RegionTopology[]
  schedulers: SchedulerTopology[]
  tenants: TenantPlacement[]
  timestamp: number
}

let clusterNodes = new Map<string, ClusterNode>()
let workerTopologies = new Map<string, WorkerTopology>()
let queuePartitions = new Map<string, QueuePartitionTopology>()
let regionTopologies = new Map<string, RegionTopology>()
let schedulerTopologies = new Map<string, SchedulerTopology>()
let tenantPlacements = new Map<string, TenantPlacement>()

export function configureTopologyStores(stores: {
  clusterNodes?: Map<string, ClusterNode>
  workerTopologies?: Map<string, WorkerTopology>
  queuePartitions?: Map<string, QueuePartitionTopology>
  regionTopologies?: Map<string, RegionTopology>
  schedulerTopologies?: Map<string, SchedulerTopology>
  tenantPlacements?: Map<string, TenantPlacement>
}): void {
  if (stores.clusterNodes) clusterNodes = stores.clusterNodes
  if (stores.workerTopologies) workerTopologies = stores.workerTopologies
  if (stores.queuePartitions) queuePartitions = stores.queuePartitions
  if (stores.regionTopologies) regionTopologies = stores.regionTopologies
  if (stores.schedulerTopologies) schedulerTopologies = stores.schedulerTopologies
  if (stores.tenantPlacements) tenantPlacements = stores.tenantPlacements
}

export function registerClusterNode(node: ClusterNode): void {
  clusterNodes.set(node.id, node)
  logger.info(`Cluster node registered: ${node.id} (${node.role}, ${node.region}/${node.zone})`)
}

export function getClusterNode(id: string): ClusterNode | undefined {
  return clusterNodes.get(id)
}

export function listClusterNodes(region?: string): ClusterNode[] {
  const all = Array.from(clusterNodes.values())
  return region ? all.filter(n => n.region === region) : all
}

export function updateNodeUtilization(id: string, utilization: { cpu: number; memory: number; disk: number }): void {
  const node = clusterNodes.get(id)
  if (node) {
    node.utilization = utilization
    node.lastHeartbeat = Date.now()
  }
}

export function updateNodeStatus(id: string, status: TopologyNodeStatus): void {
  const node = clusterNodes.get(id)
  if (node) {
    node.status = status
    node.lastHeartbeat = Date.now()
  }
}

export function registerWorkerTopology(worker: WorkerTopology): void {
  workerTopologies.set(worker.workerId, worker)
}

export function getWorkerTopology(workerId: string): WorkerTopology | undefined {
  return workerTopologies.get(workerId)
}

export function listWorkerTopologies(region?: string, type?: string): WorkerTopology[] {
  let all = Array.from(workerTopologies.values())
  if (region) all = all.filter(w => w.region === region)
  if (type) all = all.filter(w => w.type === type)
  return all
}

export function updateWorkerLoad(workerId: string, currentLoad: number): void {
  const worker = workerTopologies.get(workerId)
  if (worker) worker.currentLoad = currentLoad
}

export function registerQueuePartition(partition: QueuePartitionTopology): void {
  const key = `${partition.queueName}:${partition.partition}`
  queuePartitions.set(key, partition)
}

export function getQueuePartition(queueName: string, partition: number): QueuePartitionTopology | undefined {
  return queuePartitions.get(`${queueName}:${partition}`)
}

export function listQueuePartitions(region?: string, queueName?: string): QueuePartitionTopology[] {
  let all = Array.from(queuePartitions.values())
  if (region) all = all.filter(q => q.region === region)
  if (queueName) all = all.filter(q => q.queueName === queueName)
  return all
}

export function updateQueueDepth(queueName: string, partition: number, depth: number): void {
  const key = `${queueName}:${partition}`
  const qp = queuePartitions.get(key)
  if (qp) qp.depth = depth
}

export function registerRegionTopology(region: RegionTopology): void {
  regionTopologies.set(region.regionId, region)
}

export function getRegionTopology(regionId: string): RegionTopology | undefined {
  return regionTopologies.get(regionId)
}

export function listRegionTopologies(): RegionTopology[] {
  return Array.from(regionTopologies.values()).sort((a, b) => a.priority - b.priority)
}

export function updateRegionHealthScore(regionId: string, healthScore: number): void {
  const region = regionTopologies.get(regionId)
  if (region) {
    region.healthScore = healthScore
    region.lastUpdated = Date.now()
  }
}

export function registerSchedulerTopology(scheduler: SchedulerTopology): void {
  schedulerTopologies.set(scheduler.schedulerId, scheduler)
}

export function getSchedulerTopology(schedulerId: string): SchedulerTopology | undefined {
  return schedulerTopologies.get(schedulerId)
}

export function listSchedulerTopologies(region?: string): SchedulerTopology[] {
  const all = Array.from(schedulerTopologies.values())
  return region ? all.filter(s => s.region === region) : all
}

export function placeTenant(placement: TenantPlacement): void {
  tenantPlacements.set(placement.tenantId, placement)
  logger.info(`Tenant ${placement.tenantId} placed in ${placement.primaryRegion} (failover: ${placement.failoverRegion})`)
}

export function getTenantPlacement(tenantId: string): TenantPlacement | undefined {
  return tenantPlacements.get(tenantId)
}

export function listTenantPlacements(region?: string): TenantPlacement[] {
  const all = Array.from(tenantPlacements.values())
  return region ? all.filter(t => t.primaryRegion === region || t.failoverRegion === region) : all
}

export function rebalanceTenant(tenantId: string, newPrimaryRegion: string): TenantPlacement | undefined {
  const placement = tenantPlacements.get(tenantId)
  if (!placement) return undefined

  placement.failoverRegion = placement.primaryRegion
  placement.primaryRegion = newPrimaryRegion
  placement.readRegions = placement.readRegions.filter(r => r !== newPrimaryRegion)
  placement.readRegions.push(placement.failoverRegion)
  placement.lastRebalanced = Date.now()

  logger.info(`Tenant ${tenantId} rebalanced from ${placement.failoverRegion} to ${newPrimaryRegion}`)
  return placement
}

export function takeTopologySnapshot(): TopologySnapshot {
  return {
    cluster: listClusterNodes(),
    workers: listWorkerTopologies(),
    queues: listQueuePartitions(),
    regions: listRegionTopologies(),
    schedulers: listSchedulerTopologies(),
    tenants: listTenantPlacements(),
    timestamp: Date.now(),
  }
}

export function detectTopologyAnomalies(): Array<{ type: string; severity: string; message: string; resourceId: string }> {
  const anomalies: Array<{ type: string; severity: string; message: string; resourceId: string }> = []

  for (const node of listClusterNodes()) {
    if (node.utilization.cpu > 0.9) anomalies.push({ type: 'high_cpu', severity: 'warning', message: `Node ${node.id} CPU at ${(node.utilization.cpu * 100).toFixed(0)}%`, resourceId: node.id })
    if (node.utilization.memory > 0.9) anomalies.push({ type: 'high_memory', severity: 'warning', message: `Node ${node.id} memory at ${(node.utilization.memory * 100).toFixed(0)}%`, resourceId: node.id })
    if (node.status === TopologyNodeStatus.OFFLINE) anomalies.push({ type: 'node_offline', severity: 'critical', message: `Node ${node.id} is offline`, resourceId: node.id })
  }

  for (const worker of listWorkerTopologies()) {
    if (worker.currentLoad > worker.maxLoad * 0.9) anomalies.push({ type: 'worker_overloaded', severity: 'warning', message: `Worker ${worker.workerId} at ${((worker.currentLoad / worker.maxLoad) * 100).toFixed(0)}% load`, resourceId: worker.workerId })
    if (worker.status === TopologyNodeStatus.OFFLINE) anomalies.push({ type: 'worker_offline', severity: 'critical', message: `Worker ${worker.workerId} is offline`, resourceId: worker.workerId })
  }

  for (const region of listRegionTopologies()) {
    if (region.healthScore < 0.5) anomalies.push({ type: 'region_unhealthy', severity: 'critical', message: `Region ${region.regionId} health score ${region.healthScore}`, resourceId: region.regionId })
  }

  return anomalies
}
