import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('autoscaler')

export type AutoscaleTarget = 'queue' | 'worker' | 'report' | 'ai_workload'

export interface AutoscalePolicy {
  id: string
  target: AutoscaleTarget
  minReplicas: number
  maxReplicas: number
  cooldownMs: number
  scaleUpThreshold: number
  scaleDownThreshold: number
  scaleUpFactor: number
  scaleDownFactor: number
  metrics: string[]
  schedule?: {
    cron: string
    targetReplicas: number
    timezone: string
  }[]
  enabled: boolean
}

export interface AutoscaleDecision {
  policyId: string
  target: AutoscaleTarget
  currentReplicas: number
  desiredReplicas: number
  reason: string
  metrics: Record<string, number>
  timestamp: number
  applied: boolean
}

export interface LoadMetric {
  name: string
  value: number
  timestamp: number
  labels: Record<string, string>
}

export interface ScalingEvent {
  policyId: string
  target: AutoscaleTarget
  from: number
  to: number
  reason: string
  triggeredAt: number
  completedAt?: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
}

let autoscalePolicies = new Map<string, AutoscalePolicy>()
let autoscaleDecisions = new Map<string, AutoscaleDecision[]>()
let loadMetrics = new Map<string, LoadMetric[]>()
let scalingEvents = new Map<string, ScalingEvent>()
let lastScaleTimes = new Map<string, number>()
let cooldownTracker = new Map<string, number>()

export function configureAutoscalerStores(stores: {
  autoscalePolicies?: Map<string, AutoscalePolicy>
  autoscaleDecisions?: Map<string, AutoscaleDecision[]>
  loadMetrics?: Map<string, LoadMetric[]>
  scalingEvents?: Map<string, ScalingEvent>
  lastScaleTimes?: Map<string, number>
  cooldownTracker?: Map<string, number>
}): void {
  if (stores.autoscalePolicies) autoscalePolicies = stores.autoscalePolicies
  if (stores.autoscaleDecisions) autoscaleDecisions = stores.autoscaleDecisions
  if (stores.loadMetrics) loadMetrics = stores.loadMetrics
  if (stores.scalingEvents) scalingEvents = stores.scalingEvents
  if (stores.lastScaleTimes) lastScaleTimes = stores.lastScaleTimes
  if (stores.cooldownTracker) cooldownTracker = stores.cooldownTracker
}

export function registerAutoscalePolicy(policy: AutoscalePolicy): void {
  autoscalePolicies.set(policy.id, policy)
  logger.info(`Autoscale policy registered: ${policy.id} (target=${policy.target}, min=${policy.minReplicas}, max=${policy.maxReplicas})`)
}

export function getAutoscalePolicy(id: string): AutoscalePolicy | undefined {
  return autoscalePolicies.get(id)
}

export function listAutoscalePolicies(target?: AutoscaleTarget): AutoscalePolicy[] {
  const all = Array.from(autoscalePolicies.values())
  return target ? all.filter(p => p.target === target && p.enabled) : all.filter(p => p.enabled)
}

export function recordLoadMetric(metric: LoadMetric): void {
  if (!loadMetrics.has(metric.name)) loadMetrics.set(metric.name, [])
  const metrics = loadMetrics.get(metric.name)!
  metrics.push(metric)
  if (metrics.length > 1000) metrics.splice(0, metrics.length - 1000)
}

export function getLoadMetrics(name: string, windowMs = 60_000): LoadMetric[] {
  const metrics = loadMetrics.get(name) || []
  const cutoff = Date.now() - windowMs
  return metrics.filter(m => m.timestamp > cutoff)
}

export function getAverageLoad(name: string, windowMs = 60_000): number {
  const metrics = getLoadMetrics(name, windowMs)
  if (metrics.length === 0) return 0
  return metrics.reduce((s, m) => s + m.value, 0) / metrics.length
}

export async function evaluateAutoscale(policyId: string, currentReplicas: number, additionalMetrics?: Record<string, number>): Promise<AutoscaleDecision> {
  const policy = autoscalePolicies.get(policyId)
  if (!policy) {
    return {
      policyId, target: 'worker' as AutoscaleTarget, currentReplicas, desiredReplicas: currentReplicas,
      reason: `Policy ${policyId} not found`, metrics: {}, timestamp: Date.now(), applied: false,
    }
  }

  if (!policy.enabled) {
    return {
      policyId, target: policy.target, currentReplicas, desiredReplicas: currentReplicas,
      reason: 'Policy disabled', metrics: {}, timestamp: Date.now(), applied: false,
    }
  }

  const now = Date.now()
  const lastScale = lastScaleTimes.get(policyId) || 0
  if (now - lastScale < policy.cooldownMs) {
    return {
      policyId, target: policy.target, currentReplicas, desiredReplicas: currentReplicas,
      reason: `In cooldown (${policy.cooldownMs - (now - lastScale)}ms remaining)`, metrics: {}, timestamp: now, applied: false,
    }
  }

  const avgLoads: Record<string, number> = {}
  for (const metricName of policy.metrics) {
    avgLoads[metricName] = additionalMetrics?.[metricName] ?? getAverageLoad(metricName)
  }

  const maxLoad = Math.max(...Object.values(avgLoads), 0)
  let desiredReplicas = currentReplicas

  if (maxLoad > policy.scaleUpThreshold) {
    desiredReplicas = Math.ceil(currentReplicas * policy.scaleUpFactor)
    if (desiredReplicas > policy.maxReplicas) desiredReplicas = policy.maxReplicas
  } else if (maxLoad < policy.scaleDownThreshold) {
    desiredReplicas = Math.floor(currentReplicas * policy.scaleDownFactor)
    if (desiredReplicas < policy.minReplicas) desiredReplicas = policy.minReplicas
  }

  const changed = desiredReplicas !== currentReplicas
  const decision: AutoscaleDecision = {
    policyId, target: policy.target, currentReplicas, desiredReplicas,
    reason: changed
      ? `Scaling ${desiredReplicas > currentReplicas ? 'up' : 'down'}: load=${maxLoad.toFixed(2)} (threshold=${desiredReplicas > currentReplicas ? policy.scaleUpThreshold : policy.scaleDownThreshold})`
      : `No action needed: load=${maxLoad.toFixed(2)} within range [${policy.scaleDownThreshold}, ${policy.scaleUpThreshold}]`,
    metrics: avgLoads, timestamp: now, applied: changed,
  }

  if (changed) {
    lastScaleTimes.set(policyId, now)
    const event: ScalingEvent = {
      policyId, target: policy.target, from: currentReplicas, to: desiredReplicas,
      reason: decision.reason, triggeredAt: now, status: 'in_progress',
    }
    scalingEvents.set(`${policyId}:${now}`, event)
    logger.info(`Autoscale decision: ${policy.target}/${policyId} ${currentReplicas} -> ${desiredReplicas} (load=${maxLoad.toFixed(2)})`)
  }

  if (!autoscaleDecisions.has(policyId)) autoscaleDecisions.set(policyId, [])
  autoscaleDecisions.get(policyId)!.push(decision)
  const decisions = autoscaleDecisions.get(policyId)!
  if (decisions.length > 1000) decisions.splice(0, decisions.length - 1000)

  return decision
}

export async function evaluateAllAutoscalePolicies(currentReplicas: Record<string, number>, additionalMetrics?: Record<string, number>): Promise<AutoscaleDecision[]> {
  const policies = listAutoscalePolicies()
  const results: AutoscaleDecision[] = []
  for (const policy of policies) {
    const replicas = currentReplicas[policy.id] || 1
    const decision = await evaluateAutoscale(policy.id, replicas, additionalMetrics)
    results.push(decision)
  }
  return results
}

export function getAutoscaleDecisions(policyId: string, limit = 50): AutoscaleDecision[] {
  return (autoscaleDecisions.get(policyId) || []).slice(-limit)
}

export function getScalingEvents(policyId?: string, status?: ScalingEvent['status']): ScalingEvent[] {
  let events = Array.from(scalingEvents.values())
  if (policyId) events = events.filter(e => e.policyId === policyId)
  if (status) events = events.filter(e => e.status === status)
  return events.sort((a, b) => b.triggeredAt - a.triggeredAt)
}

export function completeScalingEvent(eventKey: string): void {
  const event = scalingEvents.get(eventKey)
  if (event) {
    event.status = 'completed'
    event.completedAt = Date.now()
  }
}

export function getAutoscalerSummary(): {
  totalPolicies: number
  enabledPolicies: number
  recentDecisions: number
  pendingScalingEvents: number
  inProgressScaling: number
} {
  return {
    totalPolicies: autoscalePolicies.size,
    enabledPolicies: listAutoscalePolicies().length,
    recentDecisions: Array.from(autoscaleDecisions.values()).reduce((s, d) => s + d.length, 0),
    pendingScalingEvents: getScalingEvents(undefined, 'pending').length,
    inProgressScaling: getScalingEvents(undefined, 'in_progress').length,
  }
}
