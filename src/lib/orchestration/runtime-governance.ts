import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('runtime-governance')

export interface RuntimePolicy {
  id: string
  name: string
  description: string
  scope: 'global' | 'regional' | 'tenant' | 'worker_type'
  targetIds: string[]
  rules: PolicyRule[]
  severity: 'warning' | 'critical' | 'blocking'
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface PolicyRule {
  metric: string
  operator: '>' | '<' | '>=' | '<=' | '==' | '!='
  threshold: number
  windowMs: number
  action: 'alert' | 'throttle' | 'block' | 'scale_down' | 'scale_up'
}

export interface TenantQuota {
  tenantId: string
  maxWorkers: number
  maxQueues: number
  maxConcurrentJobs: number
  maxStorageMB: number
  maxBandwidthMBps: number
  maxApiCallsPerMin: number
  usedWorkers: number
  usedQueues: number
  usedConcurrentJobs: number
  usedStorageMB: number
  usedBandwidthMBps: number
  apiCallsThisMin: number
  quotas: Record<string, number>
  usage: Record<string, number>
}

export interface RegionalUsagePolicy {
  regionId: string
  maxWorkers: number
  maxQueues: number
  maxTenants: number
  maxTotalStorageMB: number
  maxBandwidthMBps: number
  currentWorkers: number
  currentQueues: number
  currentTenants: number
  currentStorageMB: number
  currentBandwidthMBps: number
  overloadProtection: boolean
  saturationThreshold: number
}

export interface WorkerResourceGovernance {
  workerType: string
  maxConcurrentTasks: number
  maxMemoryMB: number
  maxCPUCores: number
  maxQueueDepth: number
  taskTimeoutMs: number
  restartPolicy: 'always' | 'on_failure' | 'never'
}

export interface QueueSaturationProtection {
  queueName: string
  maxDepth: number
  maxLatencyMs: number
  backpressureThreshold: number
  currentDepth: number
  currentLatencyMs: number
  isSaturated: boolean
  backpressureActive: boolean
}

export interface OverloadProtection {
  id: string
  targetType: 'region' | 'worker' | 'queue' | 'tenant'
  targetId: string
  cpuThreshold: number
  memoryThreshold: number
  queueDepthThreshold: number
  latencyThresholdMs: number
  cooldownMs: number
  action: 'throttle' | 'reject' | 'drain' | 'scale'
  active: boolean
  triggeredAt?: number
}

let runtimePolicies = new Map<string, RuntimePolicy>()
let tenantQuotas = new Map<string, TenantQuota>()
let regionalUsagePolicies = new Map<string, RegionalUsagePolicy>()
let workerResourceGovernances = new Map<string, WorkerResourceGovernance>()
let queueSaturationProtections = new Map<string, QueueSaturationProtection>()
let overloadProtections = new Map<string, OverloadProtection>()
let policyEvaluationLog = new Map<string, Array<{ policyId: string; violated: boolean; value: number; threshold: number; timestamp: number }>>()

export function configureGovernanceStores(stores: {
  runtimePolicies?: Map<string, RuntimePolicy>
  tenantQuotas?: Map<string, TenantQuota>
  regionalUsagePolicies?: Map<string, RegionalUsagePolicy>
  workerResourceGovernances?: Map<string, WorkerResourceGovernance>
  queueSaturationProtections?: Map<string, QueueSaturationProtection>
  overloadProtections?: Map<string, OverloadProtection>
  policyEvaluationLog?: Map<string, Array<{ policyId: string; violated: boolean; value: number; threshold: number; timestamp: number }>>
}): void {
  if (stores.runtimePolicies) runtimePolicies = stores.runtimePolicies
  if (stores.tenantQuotas) tenantQuotas = stores.tenantQuotas
  if (stores.regionalUsagePolicies) regionalUsagePolicies = stores.regionalUsagePolicies
  if (stores.workerResourceGovernances) workerResourceGovernances = stores.workerResourceGovernances
  if (stores.queueSaturationProtections) queueSaturationProtections = stores.queueSaturationProtections
  if (stores.overloadProtections) overloadProtections = stores.overloadProtections
  if (stores.policyEvaluationLog) policyEvaluationLog = stores.policyEvaluationLog
}

export function registerRuntimePolicy(policy: RuntimePolicy): void {
  runtimePolicies.set(policy.id, policy)
  logger.info(`Runtime policy registered: ${policy.id} (${policy.scope}, severity=${policy.severity})`)
}

export function getRuntimePolicy(id: string): RuntimePolicy | undefined {
  return runtimePolicies.get(id)
}

export function listRuntimePolicies(scope?: RuntimePolicy['scope']): RuntimePolicy[] {
  const all = Array.from(runtimePolicies.values()).filter(p => p.enabled)
  return scope ? all.filter(p => p.scope === scope) : all
}

export function evaluatePolicy(policyId: string, metricValues: Record<string, number>): { violated: boolean; violations: Array<{ rule: string; value: number; threshold: number }> } {
  const policy = runtimePolicies.get(policyId)
  if (!policy) return { violated: false, violations: [] }

  const violations: Array<{ rule: string; value: number; threshold: number }> = []

  for (const rule of policy.rules) {
    const value = metricValues[rule.metric]
    if (value === undefined) continue

    let violated = false
    switch (rule.operator) {
      case '>': violated = value > rule.threshold; break
      case '<': violated = value < rule.threshold; break
      case '>=': violated = value >= rule.threshold; break
      case '<=': violated = value <= rule.threshold; break
      case '==': violated = value === rule.threshold; break
      case '!=': violated = value !== rule.threshold; break
    }

    if (violated) violations.push({ rule: rule.metric, value, threshold: rule.threshold })

    const log = policyEvaluationLog.get(policyId) || []
    log.push({ policyId: policy.id, violated, value, threshold: rule.threshold, timestamp: Date.now() })
    if (log.length > 1000) log.splice(0, log.length - 1000)
    policyEvaluationLog.set(policyId, log)
  }

  return { violated: violations.length > 0, violations }
}

export function evaluateAllPolicies(allMetricValues: Record<string, Record<string, number>>): Array<{ policyId: string; violated: boolean; violations: Array<{ rule: string; value: number; threshold: number }> }> {
  const results: Array<{ policyId: string; violated: boolean; violations: Array<{ rule: string; value: number; threshold: number }> }> = []
  for (const policy of listRuntimePolicies()) {
    const metricValues = allMetricValues[policy.id] || {}
    const result = evaluatePolicy(policy.id, metricValues)
    results.push({ policyId: policy.id, ...result })
  }
  return results
}

export function setTenantQuota(tenantId: string, quota: Partial<TenantQuota>): TenantQuota {
  const existing = tenantQuotas.get(tenantId) || createDefaultTenantQuota(tenantId)
  Object.assign(existing, quota)
  tenantQuotas.set(tenantId, existing)
  return existing
}

export function getTenantQuota(tenantId: string): TenantQuota | undefined {
  return tenantQuotas.get(tenantId)
}

export function checkTenantQuota(tenantId: string, resource: keyof TenantQuota, requestedAmount: number): { allowed: boolean; current: number; max: number; message: string } {
  const quota = tenantQuotas.get(tenantId)
  if (!quota) return { allowed: true, current: 0, max: Infinity, message: 'No quota defined' }

  const maxKey = `max${resource.charAt(0).toUpperCase() + resource.slice(1)}` as keyof TenantQuota
  const usedKey = `used${resource.charAt(0).toUpperCase() + resource.slice(1)}` as keyof TenantQuota
  const max = quota[maxKey] as number
  const used = (quota[usedKey] as number) || 0

  if (used + requestedAmount > max) {
    return { allowed: false, current: used, max, message: `Tenant ${tenantId} quota exceeded for ${resource}: ${used + requestedAmount} > ${max}` }
  }
  return { allowed: true, current: used, max, message: 'Quota available' }
}

function createDefaultTenantQuota(tenantId: string): TenantQuota {
  return {
    tenantId, maxWorkers: 5, maxQueues: 10, maxConcurrentJobs: 100, maxStorageMB: 1024,
    maxBandwidthMBps: 100, maxApiCallsPerMin: 10000, usedWorkers: 0, usedQueues: 0,
    usedConcurrentJobs: 0, usedStorageMB: 0, usedBandwidthMBps: 0, apiCallsThisMin: 0,
    quotas: {}, usage: {},
  }
}

export function setRegionalUsagePolicy(regionId: string, policy: Partial<RegionalUsagePolicy>): RegionalUsagePolicy {
  const existing = regionalUsagePolicies.get(regionId) || {
    regionId, maxWorkers: 50, maxQueues: 100, maxTenants: 200, maxTotalStorageMB: 102400,
    maxBandwidthMBps: 10000, currentWorkers: 0, currentQueues: 0, currentTenants: 0,
    currentStorageMB: 0, currentBandwidthMBps: 0, overloadProtection: true, saturationThreshold: 0.9,
  }
  Object.assign(existing, policy)
  regionalUsagePolicies.set(regionId, existing)
  return existing
}

export function getRegionalUsagePolicy(regionId: string): RegionalUsagePolicy | undefined {
  return regionalUsagePolicies.get(regionId)
}

export function isRegionSaturated(regionId: string): { saturated: boolean; reasons: string[] } {
  const policy = regionalUsagePolicies.get(regionId)
  if (!policy || !policy.overloadProtection) return { saturated: false, reasons: [] }

  const reasons: string[] = []
  if (policy.currentWorkers / policy.maxWorkers > policy.saturationThreshold) reasons.push(`Workers at ${((policy.currentWorkers / policy.maxWorkers) * 100).toFixed(0)}% capacity`)
  if (policy.currentQueues / policy.maxQueues > policy.saturationThreshold) reasons.push(`Queues at ${((policy.currentQueues / policy.maxQueues) * 100).toFixed(0)}% capacity`)
  if (policy.currentStorageMB / policy.maxTotalStorageMB > policy.saturationThreshold) reasons.push(`Storage at ${((policy.currentStorageMB / policy.maxTotalStorageMB) * 100).toFixed(0)}% capacity`)

  return { saturated: reasons.length > 0, reasons }
}

export function setWorkerResourceGovernance(workerType: string, governance: WorkerResourceGovernance): void {
  workerResourceGovernances.set(workerType, governance)
}

export function getWorkerResourceGovernance(workerType: string): WorkerResourceGovernance {
  return workerResourceGovernances.get(workerType) || {
    workerType, maxConcurrentTasks: 10, maxMemoryMB: 512, maxCPUCores: 2,
    maxQueueDepth: 1000, taskTimeoutMs: 30000, restartPolicy: 'on_failure',
  }
}

export function setQueueSaturationProtection(queueName: string, protection: Partial<QueueSaturationProtection>): QueueSaturationProtection {
  const existing = queueSaturationProtections.get(queueName) || {
    queueName, maxDepth: 10000, maxLatencyMs: 5000, backpressureThreshold: 0.8,
    currentDepth: 0, currentLatencyMs: 0, isSaturated: false, backpressureActive: false,
  }
  Object.assign(existing, protection)
  queueSaturationProtections.set(queueName, existing)
  return existing
}

export function getQueueSaturationProtection(queueName: string): QueueSaturationProtection | undefined {
  return queueSaturationProtections.get(queueName)
}

export function checkQueueSaturation(queueName: string, depth: number, latencyMs: number): { saturated: boolean; backpressure: boolean } {
  const protection = queueSaturationProtections.get(queueName)
  if (!protection) return { saturated: false, backpressure: false }

  protection.currentDepth = depth
  protection.currentLatencyMs = latencyMs
  protection.isSaturated = depth > protection.maxDepth || latencyMs > protection.maxLatencyMs
  protection.backpressureActive = depth > protection.maxDepth * protection.backpressureThreshold

  return { saturated: protection.isSaturated, backpressure: protection.backpressureActive }
}

export function registerOverloadProtection(protection: OverloadProtection): void {
  overloadProtections.set(protection.id, protection)
}

export function getOverloadProtection(id: string): OverloadProtection | undefined {
  return overloadProtections.get(id)
}

export function checkOverloadStatus(targetType: OverloadProtection['targetType'], targetId: string, cpu: number, memory: number, queueDepth: number, latencyMs: number): { overloaded: boolean; triggeredBy: string[] } {
  const triggeredBy: string[] = []
  for (const protection of overloadProtections.values()) {
    if (protection.targetType !== targetType || protection.targetId !== targetId) continue
    if (cpu > protection.cpuThreshold) triggeredBy.push(`CPU ${cpu} > ${protection.cpuThreshold}`)
    if (memory > protection.memoryThreshold) triggeredBy.push(`Memory ${memory} > ${protection.memoryThreshold}`)
    if (queueDepth > protection.queueDepthThreshold) triggeredBy.push(`Queue depth ${queueDepth} > ${protection.queueDepthThreshold}`)
    if (latencyMs > protection.latencyThresholdMs) triggeredBy.push(`Latency ${latencyMs}ms > ${protection.latencyThresholdMs}ms`)
  }
  return { overloaded: triggeredBy.length > 0, triggeredBy }
}

export function getGovernanceSummary(): {
  totalPolicies: number
  enabledPolicies: number
  tenantsWithQuotas: number
  regionsWithPolicies: number
  workerGovernances: number
  queueProtections: number
  overloadProtectionsActive: number
  saturatedQueues: number
  saturatedRegions: number
} {
  return {
    totalPolicies: runtimePolicies.size,
    enabledPolicies: listRuntimePolicies().length,
    tenantsWithQuotas: tenantQuotas.size,
    regionsWithPolicies: regionalUsagePolicies.size,
    workerGovernances: workerResourceGovernances.size,
    queueProtections: queueSaturationProtections.size,
    overloadProtectionsActive: Array.from(overloadProtections.values()).filter(p => p.active).length,
    saturatedQueues: Array.from(queueSaturationProtections.values()).filter(p => p.isSaturated).length,
    saturatedRegions: Array.from(regionalUsagePolicies.keys()).filter(r => isRegionSaturated(r).saturated).length,
  }
}
