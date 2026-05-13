import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('operator-runtime')

export enum ResourceKind {
  WORKER = 'worker',
  QUEUE = 'queue',
  SCHEDULER = 'scheduler',
  BACKUP = 'backup',
  REPORT = 'report',
  AI_WORKLOAD = 'ai_workload',
  RECONCILIATION = 'reconciliation',
}

export enum ResourceStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  DEGRADED = 'degraded',
  FAILED = 'failed',
  TERMINATED = 'terminated',
}

export interface ResourceRef {
  kind: ResourceKind
  name: string
  namespace?: string
  uid: string
  generation: number
}

export interface DesiredState {
  replicas: number
  spec: Record<string, any>
  labels: Record<string, string>
  annotations: Record<string, string>
  createdAt: number
  updatedAt: number
}

export interface ObservedState {
  availableReplicas: number
  readyReplicas: number
  status: ResourceStatus
  conditions: ResourceCondition[]
  lastHeartbeat: number
  observedGeneration: number
}

export interface ResourceCondition {
  type: string
  status: 'True' | 'False' | 'Unknown'
  reason: string
  message: string
  lastTransitionTime: number
  lastHeartbeatTime: number
}

export interface ResourceObject {
  ref: ResourceRef
  desired: DesiredState
  observed: ObservedState
}

export interface ReconciliationResult {
  action: string
  success: boolean
  changes: string[]
  durationMs: number
}

export interface ControllerConfig {
  kind: ResourceKind
  reconciliationIntervalMs: number
  minReplicas: number
  maxReplicas: number
  cooldownMs: number
  selfHeal: boolean
  staleThresholdMs: number
}

const DEFAULT_CONTROLLER_CONFIG: Record<ResourceKind, ControllerConfig> = {
  [ResourceKind.WORKER]: {
    kind: ResourceKind.WORKER,
    reconciliationIntervalMs: 10_000,
    minReplicas: 1,
    maxReplicas: 50,
    cooldownMs: 30_000,
    selfHeal: true,
    staleThresholdMs: 60_000,
  },
  [ResourceKind.QUEUE]: {
    kind: ResourceKind.QUEUE,
    reconciliationIntervalMs: 15_000,
    minReplicas: 0,
    maxReplicas: 100,
    cooldownMs: 30_000,
    selfHeal: true,
    staleThresholdMs: 120_000,
  },
  [ResourceKind.SCHEDULER]: {
    kind: ResourceKind.SCHEDULER,
    reconciliationIntervalMs: 20_000,
    minReplicas: 1,
    maxReplicas: 1,
    cooldownMs: 60_000,
    selfHeal: true,
    staleThresholdMs: 30_000,
  },
  [ResourceKind.BACKUP]: {
    kind: ResourceKind.BACKUP,
    reconciliationIntervalMs: 30_000,
    minReplicas: 1,
    maxReplicas: 5,
    cooldownMs: 60_000,
    selfHeal: true,
    staleThresholdMs: 300_000,
  },
  [ResourceKind.REPORT]: {
    kind: ResourceKind.REPORT,
    reconciliationIntervalMs: 30_000,
    minReplicas: 1,
    maxReplicas: 10,
    cooldownMs: 60_000,
    selfHeal: true,
    staleThresholdMs: 300_000,
  },
  [ResourceKind.AI_WORKLOAD]: {
    kind: ResourceKind.AI_WORKLOAD,
    reconciliationIntervalMs: 20_000,
    minReplicas: 0,
    maxReplicas: 20,
    cooldownMs: 60_000,
    selfHeal: true,
    staleThresholdMs: 120_000,
  },
  [ResourceKind.RECONCILIATION]: {
    kind: ResourceKind.RECONCILIATION,
    reconciliationIntervalMs: 5_000,
    minReplicas: 1,
    maxReplicas: 1,
    cooldownMs: 10_000,
    selfHeal: true,
    staleThresholdMs: 30_000,
  },
}

let resources = new Map<string, ResourceObject>()
let controllers = new Map<ResourceKind, ControllerConfig>()
let reconciliationHistory = new Map<string, ReconciliationResult[]>()

export function configureOperatorStores(stores: {
  resources?: Map<string, ResourceObject>
  controllers?: Map<ResourceKind, ControllerConfig>
  reconciliationHistory?: Map<string, ReconciliationResult[]>
}): void {
  if (stores.resources) resources = stores.resources
  if (stores.controllers) controllers = stores.controllers
  if (stores.reconciliationHistory) reconciliationHistory = stores.reconciliationHistory
}

export function registerControllerConfig(config: ControllerConfig): void {
  controllers.set(config.kind, config)
  logger.info(`Controller registered: ${config.kind} (interval=${config.reconciliationIntervalMs}ms, min=${config.minReplicas}, max=${config.maxReplicas})`)
}

export function getControllerConfig(kind: ResourceKind): ControllerConfig {
  return controllers.get(kind) || DEFAULT_CONTROLLER_CONFIG[kind]
}

export function getAllControllerConfigs(): ControllerConfig[] {
  return Array.from(controllers.values())
}

export function applyResource(kind: ResourceKind, name: string, desired: DesiredState): ResourceRef {
  const existing = findResource(kind, name)
  const ref: ResourceRef = {
    kind,
    name,
    uid: existing?.ref.uid || `${kind}:${name}:${Date.now().toString(36)}`,
    generation: existing ? existing.ref.generation + 1 : 1,
  }

  const resource: ResourceObject = {
    ref,
    desired: {
      ...desired,
      updatedAt: Date.now(),
      createdAt: existing?.desired.createdAt || Date.now(),
    },
    observed: existing?.observed || {
      availableReplicas: 0,
      readyReplicas: 0,
      status: ResourceStatus.PENDING,
      conditions: [],
      lastHeartbeat: Date.now(),
      observedGeneration: 0,
    },
  }

  resources.set(resourceKey(kind, name), resource)
  logger.info(`Resource applied: ${kind}/${name} (generation=${ref.generation}, replicas=${desired.replicas})`)
  return ref
}

export function deleteResource(kind: ResourceKind, name: string): boolean {
  const key = resourceKey(kind, name)
  const existed = resources.has(key)
  resources.delete(key)
  if (existed) logger.info(`Resource deleted: ${kind}/${name}`)
  return existed
}

export function getResource(kind: ResourceKind, name: string): ResourceObject | undefined {
  return resources.get(resourceKey(kind, name))
}

export function listResources(kind?: ResourceKind): ResourceObject[] {
  const all = Array.from(resources.values())
  return kind ? all.filter(r => r.ref.kind === kind) : all
}

export function findResource(kind: ResourceKind, name: string): ResourceObject | undefined {
  return resources.get(resourceKey(kind, name))
}

export function updateObservedState(kind: ResourceKind, name: string, observed: Partial<ObservedState>): void {
  const key = resourceKey(kind, name)
  const resource = resources.get(key)
  if (!resource) return

  resource.observed = { ...resource.observed, ...observed, lastHeartbeat: observed.lastHeartbeat ?? Date.now() }
  resources.set(key, resource)
}

export function addCondition(kind: ResourceKind, name: string, condition: ResourceCondition): void {
  const key = resourceKey(kind, name)
  const resource = resources.get(key)
  if (!resource) return

  resource.observed.conditions = [
    ...resource.observed.conditions.filter(c => c.type !== condition.type),
    condition,
  ]
  resources.set(key, resource)
}

export async function reconcileResource(kind: ResourceKind, name: string): Promise<ReconciliationResult> {
  const resource = getResource(kind, name)
  if (!resource) {
    return {
      action: 'noop',
      success: false,
      changes: [`Resource ${kind}/${name} not found`],
      durationMs: 0,
    }
  }

  const start = Date.now()
  const config = getControllerConfig(kind)
  const changes: string[] = []
  let action = 'noop'

  if (config.selfHeal && resource.observed.status === ResourceStatus.FAILED) {
    action = 'self_heal'
    changes.push(`Self-healing ${kind}/${name} from failed state`)
    resource.observed.status = ResourceStatus.PENDING
    resource.observed.conditions.push({
      type: 'SelfHealing',
      status: 'True',
      reason: 'SelfHealTriggered',
      message: `Self-healing initiated for ${kind}/${name}`,
      lastTransitionTime: Date.now(),
      lastHeartbeatTime: Date.now(),
    })
  }

  if (resource.desired.replicas !== resource.observed.availableReplicas) {
    action = 'scale'
    changes.push(`Scaling ${kind}/${name}: desired=${resource.desired.replicas}, actual=${resource.observed.availableReplicas}`)
  }

  if (resource.observed.status === ResourceStatus.PENDING) {
    action = action === 'noop' ? 'provision' : action
    changes.push(`Provisioning ${kind}/${name}`)
  }

  const staleThreshold = config.staleThresholdMs
  if (staleThreshold && Date.now() - resource.observed.lastHeartbeat > staleThreshold) {
    action = action === 'noop' ? 'stale_recovery' : action
    changes.push(`Recovering stale ${kind}/${name} (last heartbeat: ${new Date(resource.observed.lastHeartbeat).toISOString()})`)
    resource.observed.status = ResourceStatus.DEGRADED
  }

  const result: ReconciliationResult = {
    action,
    success: changes.length > 0,
    changes,
    durationMs: Date.now() - start,
  }

  const history = reconciliationHistory.get(resource.ref.uid) || []
  history.push(result)
  if (history.length > 100) history.shift()
  reconciliationHistory.set(resource.ref.uid, history)

  return result
}

export async function reconcileAll(kind?: ResourceKind): Promise<ReconciliationResult[]> {
  const targets = listResources(kind)
  const results: ReconciliationResult[] = []
  for (const resource of targets) {
    const result = await reconcileResource(resource.ref.kind, resource.ref.name)
    results.push(result)
    if (result.success) {
      logger.info(`Reconciled ${resource.ref.kind}/${resource.ref.name}: ${result.action} (${result.durationMs}ms)`)
    }
  }
  return results
}

export function getReconciliationHistory(uid: string): ReconciliationResult[] {
  return reconciliationHistory.get(uid) || []
}

export function cleanupStaleResources(staleThresholdMs = 300_000): string[] {
  const now = Date.now()
  const cleaned: string[] = []
  for (const [key, resource] of resources) {
    if (now - resource.observed.lastHeartbeat > staleThresholdMs &&
        resource.observed.status === ResourceStatus.TERMINATED) {
      resources.delete(key)
      cleaned.push(key)
    }
  }
  if (cleaned.length > 0) {
    logger.info(`Cleaned ${cleaned.length} stale resources`)
  }
  return cleaned
}

export async function runReconciliationLoop(
  kind: ResourceKind,
  signal?: AbortSignal
): Promise<void> {
  const config = getControllerConfig(kind)
  logger.info(`Reconciliation loop started for ${kind} (every ${config.reconciliationIntervalMs}ms)`)

  while (!signal?.aborted) {
    try {
      const results = await reconcileAll(kind)
      const failures = results.filter(r => !r.success)
      if (failures.length > 0) {
        logger.warn(`Reconciliation for ${kind}: ${results.length} total, ${failures.length} failed`)
      }
      cleanupStaleResources()
    } catch (err) {
      logger.error(`Reconciliation loop error for ${kind}: ${err}`)
    }

    await new Promise(resolve => setTimeout(resolve, config.reconciliationIntervalMs))
  }

  logger.info(`Reconciliation loop stopped for ${kind}`)
}

export function getOperatorSummary(): {
  totalResources: number
  byKind: Record<string, number>
  byStatus: Record<string, number>
  failedResources: ResourceObject[]
  staleResources: ResourceObject[]
} {
  const all = listResources()
  const byKind: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  const failedResources: ResourceObject[] = []
  const staleResources: ResourceObject[] = []

  for (const r of all) {
    byKind[r.ref.kind] = (byKind[r.ref.kind] || 0) + 1
    byStatus[r.observed.status] = (byStatus[r.observed.status] || 0) + 1
    if (r.observed.status === ResourceStatus.FAILED) failedResources.push(r)
    const config = getControllerConfig(r.ref.kind)
    if (Date.now() - r.observed.lastHeartbeat > config.staleThresholdMs) {
      staleResources.push(r)
    }
  }

  return { totalResources: all.length, byKind, byStatus, failedResources, staleResources }
}

function resourceKey(kind: ResourceKind, name: string): string {
  return `${kind}:${name}`
}
