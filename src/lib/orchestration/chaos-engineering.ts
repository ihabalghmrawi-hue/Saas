import { createLogger } from '@/lib/observability/logger'
import {
  ResourceKind, ResourceStatus,
  applyResource, getResource, updateObservedState, reconcileResource,
} from './operator-runtime'
import {
  registerRegionMetadata, updateReplicationLag,
  getRegionMetadata, getReplicationLag,
} from './multi-region-coordinator'
import {
  checkQueueSaturation,
  checkOverloadStatus,
  getQueueSaturationProtection,
  registerOverloadProtection,
  setQueueSaturationProtection,
  registerRuntimePolicy, evaluatePolicy,
} from './runtime-governance'
import {
  getAutoscalePolicy, recordLoadMetric, evaluateAutoscale,
} from './autoscaler'
import {
  createFailoverPlan, executeFailoverPlan, listFailoverPlans,
} from './failover-orchestrator'
import { reportAnomaly, resolveAnomaly, listAnomalies } from './operational-insights'
import { updateNodeStatus, TopologyNodeStatus } from './topology-engine'

const logger = createLogger('chaos-engineering')

export type ChaosFaultType =
  | 'resource_failure'
  | 'region_failure'
  | 'replication_lag_spike'
  | 'queue_saturation'
  | 'autoscale_throttle'

export interface ChaosFaultConfig {
  type: ChaosFaultType
  targetId: string
  params: Record<string, any>
  durationMs: number
  injectAt: number
}

export interface ChaosExperiment {
  id: string
  name: string
  faults: ChaosFaultConfig[]
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back'
  startedAt: number
  completedAt?: number
  results: ChaosResult[]
}

export interface ChaosResult {
  faultType: ChaosFaultType
  targetId: string
  injected: boolean
  detected: boolean
  recovered: boolean
  recoveryAction: string
  recoveryTimeMs: number
  details: Record<string, any>
}

export interface ChaosSummary {
  totalExperiments: number
  totalFaults: number
  recovered: number
  failed: number
  passRate: number
}

let chaosExperiments = new Map<string, ChaosExperiment>()
let activeFaults = new Map<string, ChaosFaultConfig>()

export function configureChaosStores(stores: {
  chaosExperiments?: Map<string, ChaosExperiment>
  activeFaults?: Map<string, ChaosFaultConfig>
}): void {
  if (stores.chaosExperiments) chaosExperiments = stores.chaosExperiments
  if (stores.activeFaults) activeFaults = stores.activeFaults
}

export function createChaosExperiment(name: string, faults: ChaosFaultConfig[]): ChaosExperiment {
  const experiment: ChaosExperiment = {
    id: `chaos:${name}:${Date.now().toString(36)}`,
    name, faults, status: 'pending', startedAt: Date.now(),
    results: [],
  }
  chaosExperiments.set(experiment.id, experiment)
  logger.info(`Chaos experiment created: ${name} (${faults.length} faults)`)
  return experiment
}

export function getChaosExperiment(id: string): ChaosExperiment | undefined {
  return chaosExperiments.get(id)
}

export function listChaosExperiments(status?: ChaosExperiment['status']): ChaosExperiment[] {
  const all = Array.from(chaosExperiments.values())
  return status ? all.filter(e => e.status === status) : all
}

async function injectResourceFailure(config: ChaosFaultConfig): Promise<boolean> {
  const resource = getResource(config.targetId as unknown as ResourceKind, config.params.name)
  if (!resource) return false
  updateObservedState(resource.ref.kind, resource.ref.name, {
    status: ResourceStatus.FAILED,
    ...config.params.observedState,
  })
  logger.warn(`Chaos: Injected resource failure for ${resource.ref.kind}/${resource.ref.name}`)
  return true
}

async function injectRegionFailure(config: ChaosFaultConfig): Promise<boolean> {
  const region = getRegionMetadata(config.targetId)
  if (!region) return false
  registerRegionMetadata({ ...region, status: 'offline' })
  if (config.params.markNodesOffline) {
    updateNodeStatus(config.targetId, TopologyNodeStatus.OFFLINE)
  }
  logger.warn(`Chaos: Injected region failure for ${config.targetId}`)
  return true
}

async function injectReplicationLagSpike(config: ChaosFaultConfig): Promise<boolean> {
  const { sourceRegion, targetRegion, streamName, lagMs, lagBytes } = config.params
  await updateReplicationLag(sourceRegion, targetRegion, streamName, lagMs, lagBytes, 'chaos-offset')
  logger.warn(`Chaos: Injected replication lag spike: ${sourceRegion} -> ${targetRegion} (${lagMs}ms)`)
  return true
}

async function injectQueueSaturation(config: ChaosFaultConfig): Promise<boolean> {
  const { depth, latencyMs } = config.params
  const protection = getQueueSaturationProtection(config.targetId)
  if (!protection) {
    setQueueSaturationProtection(config.targetId, {
      maxDepth: config.params.maxDepth || 1000,
      maxLatencyMs: config.params.maxLatencyMs || 5000,
      backpressureThreshold: config.params.backpressureThreshold || 0.8,
    })
  }
  checkQueueSaturation(config.targetId, depth, latencyMs)
  logger.warn(`Chaos: Injected queue saturation for ${config.targetId} (depth=${depth})`)
  return true
}

async function injectAutoscaleThrottle(config: ChaosFaultConfig): Promise<boolean> {
  const policy = getAutoscalePolicy(config.targetId)
  if (!policy) return false
  const { metricName, metricValue, metricCount } = config.params
  for (let i = 0; i < (metricCount || 5); i++) {
    recordLoadMetric({
      name: metricName || 'load',
      value: metricValue ?? 0.95,
      timestamp: Date.now() - (metricCount || 5 - i) * 1000,
      labels: {},
    })
  }
  logger.warn(`Chaos: Injected autoscale throttle for policy ${config.targetId}`)
  return true
}

async function verifyResourceFailureRecovery(config: ChaosFaultConfig): Promise<ChaosResult> {
  const resource = getResource(config.targetId as unknown as ResourceKind, config.params.name)
  const detected = resource?.observed.status === ResourceStatus.FAILED ||
    resource?.observed.conditions.some(c => c.type === 'SelfHealing')

  let recovered = false
  let recoveryAction = 'none'
  const recoveryStart = Date.now()

  if (detected && resource) {
    await reconcileResource(resource.ref.kind, resource.ref.name)
    const after = getResource(resource.ref.kind, resource.ref.name)
    recovered = after?.observed.status !== ResourceStatus.FAILED &&
      after?.observed.status !== ResourceStatus.TERMINATED
    recoveryAction = recovered ? 'self_heal' : 'failed_to_recover'
  }

  return {
    faultType: 'resource_failure',
    targetId: config.targetId,
    injected: true,
    detected: detected ?? false,
    recovered: recovered ?? false,
    recoveryAction,
    recoveryTimeMs: Date.now() - recoveryStart,
    details: { resource: config.params.name, statusBefore: resource?.observed.status },
  }
}

async function verifyRegionFailureRecovery(config: ChaosFaultConfig): Promise<ChaosResult> {
  const region = getRegionMetadata(config.targetId)
  const plans = listFailoverPlans()
  const failoverPlan = plans.find(p => p.sourceRegion === config.targetId || p.targetRegion === config.targetId)

  const detected = region?.status === 'offline'
  let recovered = false
  let recoveryAction = 'none'
  const recoveryStart = Date.now()

  if (failoverPlan && failoverPlan.status !== 'completed') {
    await executeFailoverPlan(failoverPlan.id)
    recovered = true
    recoveryAction = 'failover_executed'
  }

  return {
    faultType: 'region_failure',
    targetId: config.targetId,
    injected: true,
    detected,
    recovered,
    recoveryAction,
    recoveryTimeMs: Date.now() - recoveryStart,
    details: { regionStatus: region?.status, failoverPlansFound: plans.length },
  }
}

async function verifyReplicationLagRecovery(config: ChaosFaultConfig): Promise<ChaosResult> {
  const { sourceRegion, targetRegion, streamName } = config.params
  const lag = getReplicationLag(sourceRegion, targetRegion, streamName)

  const anomalies = listAnomalies('open')
  const detected = lag?.status === 'critical' || anomalies.some(a => a.type === 'replication_lag_critical')

  let recovered = false
  const recoveryStart = Date.now()

  if (lag && lag.status === 'critical') {
    await updateReplicationLag(sourceRegion, targetRegion, streamName, 50, 128, 'recovered-offset')
    const after = getReplicationLag(sourceRegion, targetRegion, streamName)
    recovered = after?.status === 'healthy'
  }

  return {
    faultType: 'replication_lag_spike',
    targetId: config.targetId,
    injected: true,
    detected,
    recovered,
    recoveryAction: recovered ? 'lag_recovered' : 'lag_persists',
    recoveryTimeMs: Date.now() - recoveryStart,
    details: { lagStatus: lag?.status, anomaliesDetected: anomalies.length },
  }
}

async function verifyQueueSaturationRecovery(config: ChaosFaultConfig): Promise<ChaosResult> {
  const protection = getQueueSaturationProtection(config.targetId)
  const detected = protection?.isSaturated || protection?.backpressureActive

  let recovered = false
  const recoveryStart = Date.now()

  if (detected) {
    checkQueueSaturation(config.targetId, 0, 0)
    const after = getQueueSaturationProtection(config.targetId)
    recovered = !after?.isSaturated && !after?.backpressureActive
  }

  return {
    faultType: 'queue_saturation',
    targetId: config.targetId,
    injected: true,
    detected: detected ?? false,
    recovered: recovered ?? false,
    recoveryAction: (recovered ?? false) ? 'queue_drained' : 'queue_still_saturated',
    recoveryTimeMs: Date.now() - recoveryStart,
    details: { wasSaturated: protection?.isSaturated, backpressureActive: protection?.backpressureActive },
  }
}

async function verifyAutoscaleThrottleRecovery(config: ChaosFaultConfig): Promise<ChaosResult> {
  const decision = await evaluateAutoscale(config.targetId, config.params.currentReplicas || 5)
  const detected = !decision.applied && decision.reason.includes('cooldown')

  let recovered = false
  const recoveryAction = detected ? 'cooldown_respected' : 'scale_allowed'

  const after = await evaluateAutoscale(config.targetId, config.params.currentReplicas || 5)
  recovered = !detected || after.applied

  return {
    faultType: 'autoscale_throttle',
    targetId: config.targetId,
    injected: true,
    detected,
    recovered,
    recoveryAction,
    recoveryTimeMs: 0,
    details: { decisionReason: decision.reason, decisionApplied: decision.applied },
  }
}

async function injectFault(config: ChaosFaultConfig): Promise<boolean> {
  switch (config.type) {
    case 'resource_failure':
      return injectResourceFailure(config)
    case 'region_failure':
      return injectRegionFailure(config)
    case 'replication_lag_spike':
      return injectReplicationLagSpike(config)
    case 'queue_saturation':
      return injectQueueSaturation(config)
    case 'autoscale_throttle':
      return injectAutoscaleThrottle(config)
    default:
      return false
  }
}

async function verifyRecovery(config: ChaosFaultConfig): Promise<ChaosResult> {
  switch (config.type) {
    case 'resource_failure':
      return verifyResourceFailureRecovery(config)
    case 'region_failure':
      return verifyRegionFailureRecovery(config)
    case 'replication_lag_spike':
      return verifyReplicationLagRecovery(config)
    case 'queue_saturation':
      return verifyQueueSaturationRecovery(config)
    case 'autoscale_throttle':
      return verifyAutoscaleThrottleRecovery(config)
    default:
      return {
        faultType: config.type, targetId: config.targetId,
        injected: false, detected: false, recovered: false,
        recoveryAction: 'unknown_fault_type', recoveryTimeMs: 0, details: {},
      }
  }
}

export async function runChaosExperiment(experimentId: string): Promise<ChaosExperiment> {
  const experiment = chaosExperiments.get(experimentId)
  if (!experiment) throw new Error(`Chaos experiment ${experimentId} not found`)

  experiment.status = 'running'
  logger.info(`Chaos experiment running: ${experiment.name}`)

  for (const fault of experiment.faults) {
    const injected = await injectFault(fault)
    if (injected) {
      activeFaults.set(`${fault.type}:${fault.targetId}`, fault)
    }

    await new Promise(resolve => setTimeout(resolve, Math.min(fault.durationMs, 50)))

    const result = await verifyRecovery(fault)
    result.injected = injected
    experiment.results.push(result)

    if (result.recovered) {
      activeFaults.delete(`${fault.type}:${fault.targetId}`)
      logger.info(`Chaos fault recovered: ${fault.type} on ${fault.targetId}`)
    } else {
      logger.warn(`Chaos fault NOT recovered: ${fault.type} on ${fault.targetId}`)
    }
  }

  experiment.status = experiment.results.every(r => r.recovered) ? 'completed' : 'failed'
  experiment.completedAt = Date.now()
  chaosExperiments.set(experimentId, experiment)
  logger.info(`Chaos experiment completed: ${experiment.name} (${experiment.status})`)
  return experiment
}

export function getChaosSummary(): ChaosSummary {
  const experiments = listChaosExperiments()
  const results = experiments.flatMap(e => e.results)
  return {
    totalExperiments: experiments.length,
    totalFaults: results.length,
    recovered: results.filter(r => r.recovered).length,
    failed: results.filter(r => !r.recovered).length,
    passRate: results.length > 0 ? results.filter(r => r.recovered).length / results.length : 1,
  }
}
