import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('operational-insights')

export interface ClusterHealthAggregate {
  clusterId: string
  totalNodes: number
  healthyNodes: number
  degradedNodes: number
  offlineNodes: number
  totalWorkers: number
  activeWorkers: number
  failedWorkers: number
  totalQueues: number
  saturatedQueues: number
  overallHealth: 'healthy' | 'degraded' | 'critical'
  lastUpdated: number
}

export interface ReplicationDashboardEntry {
  streamName: string
  sourceRegion: string
  targetRegion: string
  status: string
  lagMs: number
  eventsReplicated: number
  lastReplicatedAt: number
  health: 'healthy' | 'warning' | 'critical'
}

export interface FailoverAnalytic {
  failoverId: string
  type: string
  targetId: string
  sourceRegion: string
  targetRegion: string
  durationMs: number
  stepsTotal: number
  stepsFailed: number
  status: string
  timestamp: number
}

export interface AutoscalingInsight {
  policyId: string
  target: string
  totalScaleUps: number
  totalScaleDowns: number
  avgScaleUpDurationMs: number
  avgScaleDownDurationMs: number
  lastScaleAction: string
  lastScaleAt: number
  efficiency: number
}

export interface RuntimeAnomaly {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  source: string
  message: string
  details: Record<string, any>
  detectedAt: number
  resolvedAt?: number
  status: 'open' | 'resolved' | 'acknowledged'
}

let clusterHealthCache = new Map<string, ClusterHealthAggregate>()
let replicationDashboard = new Map<string, ReplicationDashboardEntry>()
let failoverAnalytics = new Map<string, FailoverAnalytic[]>()
let autoscalingInsights = new Map<string, AutoscalingInsight>()
let runtimeAnomalies = new Map<string, RuntimeAnomaly>()

export function configureInsightsStores(stores: {
  clusterHealthCache?: Map<string, ClusterHealthAggregate>
  replicationDashboard?: Map<string, ReplicationDashboardEntry>
  failoverAnalytics?: Map<string, FailoverAnalytic[]>
  autoscalingInsights?: Map<string, AutoscalingInsight>
  runtimeAnomalies?: Map<string, RuntimeAnomaly>
}): void {
  if (stores.clusterHealthCache) clusterHealthCache = stores.clusterHealthCache
  if (stores.replicationDashboard) replicationDashboard = stores.replicationDashboard
  if (stores.failoverAnalytics) failoverAnalytics = stores.failoverAnalytics
  if (stores.autoscalingInsights) autoscalingInsights = stores.autoscalingInsights
  if (stores.runtimeAnomalies) runtimeAnomalies = stores.runtimeAnomalies
}

export function computeClusterHealth(clusterId: string, totalNodes: number, healthyNodes: number, degradedNodes: number, offlineNodes: number, totalWorkers: number, activeWorkers: number, failedWorkers: number, totalQueues: number, saturatedQueues: number): ClusterHealthAggregate {
  const overallHealth: ClusterHealthAggregate['overallHealth'] =
    offlineNodes > 0 || failedWorkers > 0 ? 'critical'
    : degradedNodes > 0 || saturatedQueues > 0 ? 'degraded'
    : 'healthy'

  const health: ClusterHealthAggregate = {
    clusterId, totalNodes, healthyNodes, degradedNodes, offlineNodes,
    totalWorkers, activeWorkers, failedWorkers, totalQueues, saturatedQueues,
    overallHealth, lastUpdated: Date.now(),
  }

  clusterHealthCache.set(clusterId, health)
  return health
}

export function getClusterHealth(clusterId: string): ClusterHealthAggregate | undefined {
  return clusterHealthCache.get(clusterId)
}

export function getAllClusterHealth(): ClusterHealthAggregate[] {
  return Array.from(clusterHealthCache.values())
}

export function computeReplicationDashboard(entries: ReplicationDashboardEntry[]): ReplicationDashboardEntry[] {
  for (const entry of entries) {
    replicationDashboard.set(`${entry.sourceRegion}:${entry.targetRegion}:${entry.streamName}`, entry)
  }
  return entries
}

export function getReplicationDashboard(region?: string): ReplicationDashboardEntry[] {
  const all = Array.from(replicationDashboard.values())
  return region ? all.filter(e => e.sourceRegion === region || e.targetRegion === region) : all
}

export function recordFailoverAnalytic(analytic: FailoverAnalytic): void {
  if (!failoverAnalytics.has(analytic.targetId)) failoverAnalytics.set(analytic.targetId, [])
  failoverAnalytics.get(analytic.targetId)!.push(analytic)
}

export function getFailoverAnalytics(targetId?: string): FailoverAnalytic[] {
  if (targetId) return failoverAnalytics.get(targetId) || []
  return Array.from(failoverAnalytics.values()).flat()
}

export function computeAutoscalingInsight(policyId: string, decisions: Array<{ desiredReplicas: number; currentReplicas: number; timestamp: number }>): AutoscalingInsight {
  const scaleUps = decisions.filter(d => d.desiredReplicas > d.currentReplicas)
  const scaleDowns = decisions.filter(d => d.desiredReplicas < d.currentReplicas)
  const last = decisions[decisions.length - 1]

  const insight: AutoscalingInsight = {
    policyId, target: 'unknown',
    totalScaleUps: scaleUps.length,
    totalScaleDowns: scaleDowns.length,
    avgScaleUpDurationMs: scaleUps.length > 0 ? scaleUps.reduce((s, d) => s + (d.timestamp - (decisions[0]?.timestamp || d.timestamp)), 0) / scaleUps.length : 0,
    avgScaleDownDurationMs: scaleDowns.length > 0 ? scaleDowns.reduce((s, d) => s + (d.timestamp - (decisions[0]?.timestamp || d.timestamp)), 0) / scaleDowns.length : 0,
    lastScaleAction: last ? (last.desiredReplicas > last.currentReplicas ? 'scale_up' : 'scale_down') : 'none',
    lastScaleAt: last?.timestamp || 0,
    efficiency: decisions.length > 0 ? scaleUps.length / decisions.length : 0,
  }

  autoscalingInsights.set(policyId, insight)
  return insight
}

export function getAutoscalingInsight(policyId: string): AutoscalingInsight | undefined {
  return autoscalingInsights.get(policyId)
}

export function reportAnomaly(type: string, severity: RuntimeAnomaly['severity'], source: string, message: string, details: Record<string, any> = {}): RuntimeAnomaly {
  const anomaly: RuntimeAnomaly = {
    id: `anomaly:${type}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 6)}`,
    type, severity, source, message, details, detectedAt: Date.now(), status: 'open',
  }
  runtimeAnomalies.set(anomaly.id, anomaly)
  logger.warn(`Anomaly detected: [${severity}] ${type} from ${source}: ${message}`)
  return anomaly
}

export function getAnomaly(id: string): RuntimeAnomaly | undefined {
  return runtimeAnomalies.get(id)
}

export function listAnomalies(status?: RuntimeAnomaly['status'], severity?: RuntimeAnomaly['severity']): RuntimeAnomaly[] {
  let all = Array.from(runtimeAnomalies.values()).sort((a, b) => b.detectedAt - a.detectedAt)
  if (status) all = all.filter(a => a.status === status)
  if (severity) all = all.filter(a => a.severity === severity)
  return all
}

export function resolveAnomaly(id: string): void {
  const anomaly = runtimeAnomalies.get(id)
  if (anomaly) {
    anomaly.status = 'resolved'
    anomaly.resolvedAt = Date.now()
  }
}

export function getOperationalSummary(): {
  clusterHealthCount: number
  replicationStreams: number
  failoverEvents: number
  openAnomalies: number
  criticalAnomalies: number
  recentFailovers: number
} {
  return {
    clusterHealthCount: clusterHealthCache.size,
    replicationStreams: replicationDashboard.size,
    failoverEvents: Array.from(failoverAnalytics.values()).reduce((s, a) => s + a.length, 0),
    openAnomalies: listAnomalies('open').length,
    criticalAnomalies: listAnomalies('open', 'critical').length,
    recentFailovers: Array.from(failoverAnalytics.values()).flat().filter(a => Date.now() - a.timestamp < 3600000).length,
  }
}
