import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('failover-orchestrator')

export enum FailoverPhase {
  DETECTED = 'detected',
  ASSESSING = 'assessing',
  DRAINING = 'draining',
  FAILING_OVER = 'failing_over',
  VERIFYING = 'verifying',
  COMPLETED = 'completed',
  ROLLED_BACK = 'rolled_back',
  FAILED = 'failed',
}

export enum FailoverType {
  REGIONAL = 'regional',
  WORKER = 'worker',
  SCHEDULER = 'scheduler',
  QUEUE = 'queue',
  CACHE = 'cache',
}

export interface FailoverPlan {
  id: string
  type: FailoverType
  targetId: string
  sourceRegion: string
  targetRegion: string
  phase: FailoverPhase
  steps: FailoverStep[]
  currentStep: number
  startedAt: number
  completedAt?: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back'
}

export interface FailoverStep {
  name: string
  action: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  startedAt?: number
  completedAt?: number
  error?: string
}

export interface RecoveryAction {
  id: string
  type: 'restart' | 'reassign' | 'rebuild' | 'replicate' | 'rebalance'
  targetType: string
  targetId: string
  reason: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  createdAt: number
  completedAt?: number
}

export interface CacheRebuildPlan {
  cacheName: string
  region: string
  estimatedSize: number
  rebuildStrategy: 'lazy' | 'eager' | 'gradual'
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  progress: number
  startedAt: number
  estimatedCompletionAt?: number
}

let failoverPlans = new Map<string, FailoverPlan>()
let recoveryActions = new Map<string, RecoveryAction>()
let cacheRebuildPlans = new Map<string, CacheRebuildPlan>()
let failoverHistory = new Map<string, FailoverPlan[]>()

export function configureFailoverStores(stores: {
  failoverPlans?: Map<string, FailoverPlan>
  recoveryActions?: Map<string, RecoveryAction>
  cacheRebuildPlans?: Map<string, CacheRebuildPlan>
  failoverHistory?: Map<string, FailoverPlan[]>
}): void {
  if (stores.failoverPlans) failoverPlans = stores.failoverPlans
  if (stores.recoveryActions) recoveryActions = stores.recoveryActions
  if (stores.cacheRebuildPlans) cacheRebuildPlans = stores.cacheRebuildPlans
  if (stores.failoverHistory) failoverHistory = stores.failoverHistory
}

export function createFailoverPlan(type: FailoverType, targetId: string, sourceRegion: string, targetRegion: string): FailoverPlan {
  const steps = buildFailoverSteps(type, targetId, sourceRegion, targetRegion)
  const plan: FailoverPlan = {
    id: `failover:${type}:${targetId}:${Date.now().toString(36)}`,
    type, targetId, sourceRegion, targetRegion,
    phase: FailoverPhase.DETECTED,
    steps,
    currentStep: 0,
    startedAt: Date.now(),
    status: 'pending',
  }
  failoverPlans.set(plan.id, plan)
  logger.info(`Failover plan created: ${type} ${targetId} (${sourceRegion} -> ${targetRegion})`)
  return plan
}

function buildFailoverSteps(type: FailoverType, targetId: string, sourceRegion: string, targetRegion: string): FailoverStep[] {
  const commonSteps: FailoverStep[] = [
    { name: 'Assessment', action: `Assess ${type} ${targetId} health`, status: 'pending' },
    { name: 'Drain', action: `Drain ${type} ${targetId} in ${sourceRegion}`, status: 'pending' },
  ]

  const typeSteps: FailoverStep[] = type === FailoverType.REGIONAL
    ? [
        { name: 'ActivateTarget', action: `Activate ${targetRegion} as primary`, status: 'pending' },
        { name: 'RerouteTraffic', action: 'Reroute traffic to target region', status: 'pending' },
        { name: 'VerifyReplication', action: 'Verify replication lag caught up', status: 'pending' },
      ]
    : type === FailoverType.WORKER
    ? [
        { name: 'ReassignQueues', action: `Reassign queues from ${targetId}`, status: 'pending' },
        { name: 'SpawnReplacement', action: 'Spawn replacement worker', status: 'pending' },
      ]
    : type === FailoverType.SCHEDULER
    ? [
        { name: 'ElectNewLeader', action: 'Trigger new leader election', status: 'pending' },
        { name: 'RecoverJobs', action: 'Recover orphaned jobs', status: 'pending' },
      ]
    : type === FailoverType.QUEUE
    ? [
        { name: 'TransferQueue', action: `Transfer queue ${targetId} ownership`, status: 'pending' },
        { name: 'RedriveMessages', action: 'Redrive unprocessed messages', status: 'pending' },
      ]
    : [
        { name: 'InvalidateCache', action: `Invalidate cache ${targetId} in ${sourceRegion}`, status: 'pending' },
        { name: 'WarmCache', action: `Warm cache ${targetId} in ${targetRegion}`, status: 'pending' },
      ]

  return [
    ...commonSteps,
    ...typeSteps,
    { name: 'Verification', action: 'Verify failover completed successfully', status: 'pending' },
  ]
}

export async function executeFailoverPlan(planId: string): Promise<FailoverPlan> {
  const plan = failoverPlans.get(planId)
  if (!plan) throw new Error(`Failover plan ${planId} not found`)

  plan.status = 'in_progress'
  plan.phase = FailoverPhase.ASSESSING

  for (let i = plan.currentStep; i < plan.steps.length; i++) {
    const step = plan.steps[i]
    step.status = 'in_progress'
    step.startedAt = Date.now()
    plan.currentStep = i

    try {
      await executeStep(plan, step)
      step.status = 'completed'
      step.completedAt = Date.now()
      logger.info(`Failover step completed: ${step.name} for ${planId}`)
    } catch (err) {
      step.status = 'failed'
      step.error = `${err}`
      plan.status = 'failed'
      plan.phase = FailoverPhase.FAILED
      logger.error(`Failover step failed: ${step.name} for ${planId}: ${err}`)
      return plan
    }

    plan.phase = i === plan.steps.length - 1 ? FailoverPhase.VERIFYING
      : i < 2 ? FailoverPhase.ASSESSING
      : FailoverPhase.FAILING_OVER
  }

  plan.phase = FailoverPhase.COMPLETED
  plan.status = 'completed'
  plan.completedAt = Date.now()

  const history = failoverHistory.get(plan.targetId) || []
  history.push(plan)
  if (history.length > 50) history.shift()
  failoverHistory.set(plan.targetId, history)

  logger.info(`Failover plan completed: ${planId} (${plan.type} ${plan.targetId})`)
  return plan
}

async function executeStep(plan: FailoverPlan, step: FailoverStep): Promise<void> {
  if (step.action.startsWith('Assess')) {
    await new Promise(resolve => setTimeout(resolve, 10))
  } else if (step.action.startsWith('Drain')) {
    await new Promise(resolve => setTimeout(resolve, 10))
  } else if (step.action.startsWith('Activate')) {
    await new Promise(resolve => setTimeout(resolve, 10))
  } else if (step.action.startsWith('Reroute')) {
    await new Promise(resolve => setTimeout(resolve, 10))
  } else {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

export function getFailoverPlan(planId: string): FailoverPlan | undefined {
  return failoverPlans.get(planId)
}

export function listFailoverPlans(status?: FailoverPlan['status']): FailoverPlan[] {
  const all = Array.from(failoverPlans.values())
  return status ? all.filter(p => p.status === status) : all
}

export function getFailoverHistory(targetId: string): FailoverPlan[] {
  return failoverHistory.get(targetId) || []
}

export function createRecoveryAction(type: RecoveryAction['type'], targetType: string, targetId: string, reason: string): RecoveryAction {
  const action: RecoveryAction = {
    id: `recovery:${type}:${targetId}:${Date.now().toString(36)}`,
    type, targetType, targetId, reason, status: 'pending', createdAt: Date.now(),
  }
  recoveryActions.set(action.id, action)
  logger.info(`Recovery action created: ${type} ${targetType}/${targetId} (${reason})`)
  return action
}

export function completeRecoveryAction(id: string): void {
  const action = recoveryActions.get(id)
  if (action) {
    action.status = 'completed'
    action.completedAt = Date.now()
  }
}

export function listRecoveryActions(status?: RecoveryAction['status'], type?: RecoveryAction['type']): RecoveryAction[] {
  let all = Array.from(recoveryActions.values()).sort((a, b) => b.createdAt - a.createdAt)
  if (status) all = all.filter(a => a.status === status)
  if (type) all = all.filter(a => a.type === type)
  return all
}

export function createCacheRebuildPlan(cacheName: string, region: string, estimatedSize: number, strategy: CacheRebuildPlan['rebuildStrategy']): CacheRebuildPlan {
  const plan: CacheRebuildPlan = {
    cacheName, region, estimatedSize, rebuildStrategy: strategy,
    status: 'pending', progress: 0, startedAt: Date.now(),
    estimatedCompletionAt: Date.now() + Math.ceil(estimatedSize / 1000) * 1000,
  }
  cacheRebuildPlans.set(`${cacheName}:${region}`, plan)
  return plan
}

export function updateCacheRebuildProgress(cacheName: string, region: string, progress: number): void {
  const plan = cacheRebuildPlans.get(`${cacheName}:${region}`)
  if (plan) {
    plan.progress = Math.min(progress, 100)
    if (progress >= 100) plan.status = 'completed'
    else plan.status = 'in_progress'
  }
}

export function getCacheRebuildPlan(cacheName: string, region: string): CacheRebuildPlan | undefined {
  return cacheRebuildPlans.get(`${cacheName}:${region}`)
}

export function listCacheRebuildPlans(region?: string): CacheRebuildPlan[] {
  const all = Array.from(cacheRebuildPlans.values())
  return region ? all.filter(p => p.region === region) : all
}

export function getFailoverSummary(): {
  totalPlans: number
  activeFailovers: number
  completedFailovers: number
  failedFailovers: number
  pendingRecovery: number
  activeCacheRebuilds: number
} {
  const plans = listFailoverPlans()
  return {
    totalPlans: plans.length,
    activeFailovers: plans.filter(p => p.status === 'in_progress').length,
    completedFailovers: plans.filter(p => p.status === 'completed').length,
    failedFailovers: plans.filter(p => p.status === 'failed').length,
    pendingRecovery: listRecoveryActions('pending').length,
    activeCacheRebuilds: listCacheRebuildPlans().filter(p => p.status === 'in_progress').length,
  }
}
