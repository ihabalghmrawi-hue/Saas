import { createLogger } from '@/lib/observability/logger'
import { incrementCounter } from '@/lib/metrics/collector'

const logger = createLogger('ha-failover')

export type WorkerStatus = 'active' | 'standby' | 'failed' | 'recovering'

export interface WorkerInstance {
  id: string
  name: string
  status: WorkerStatus
  lastHeartbeat: number
  assignedQueues: string[]
  startedAt: number
  metadata: Record<string, unknown>
}

export interface FailoverConfig {
  heartbeatTimeout: number
  failoverDelay: number
  maxFailoverAttempts: number
  cooldownPeriod: number
}

let instances = new Map<string, WorkerInstance>()
let failoverHistory: Array<{ timestamp: number; from: string; to: string; queues: string[]; success: boolean }> = []

export function configureFailoverStores(stores: {
  instances?: Map<string, WorkerInstance>
  failoverHistory?: Array<{ timestamp: number; from: string; to: string; queues: string[]; success: boolean }>
}): void {
  if (stores.instances) instances = stores.instances
  if (stores.failoverHistory) failoverHistory = stores.failoverHistory
}

const DEFAULT_CONFIG: FailoverConfig = {
  heartbeatTimeout: 30000,
  failoverDelay: 5000,
  maxFailoverAttempts: 3,
  cooldownPeriod: 60000,
}

export function registerWorker(worker: WorkerInstance): void {
  instances.set(worker.id, worker)
  logger.info(`Worker registered: ${worker.name}`, { data: { workerId: worker.id, queues: worker.assignedQueues } })
}

export function heartbeat(workerId: string): void {
  const worker = instances.get(workerId)
  if (!worker) {
    logger.warn(`Heartbeat from unregistered worker: ${workerId}`)
    return
  }
  worker.lastHeartbeat = Date.now()
  worker.status = 'active'
}

export function markFailed(workerId: string, reason: string): void {
  const worker = instances.get(workerId)
  if (!worker) return

  worker.status = 'failed'
  logger.error(`Worker marked as failed: ${worker.name}`, undefined, { data: { workerId, reason } })
  incrementCounter('ha_failovers_total', { worker: worker.name, status: 'failed' })
}

export function detectFailedWorkers(config: FailoverConfig = DEFAULT_CONFIG): WorkerInstance[] {
  const now = Date.now()
  const failed: WorkerInstance[] = []

  for (const [, worker] of instances) {
    if (worker.status === 'failed') {
      failed.push(worker)
      continue
    }

    if (worker.status === 'active' && now - worker.lastHeartbeat > config.heartbeatTimeout) {
      worker.status = 'failed'
      logger.warn(`Worker heartbeat timeout: ${worker.name}`, {
        data: { workerId: worker.id, lastHeartbeat: new Date(worker.lastHeartbeat).toISOString(), timeout: config.heartbeatTimeout },
      })
      incrementCounter('ha_heartbeat_timeouts_total', { worker: worker.name })
      failed.push(worker)
    }
  }

  return failed
}

export async function executeFailover(
  failedWorker: WorkerInstance,
  getAvailableWorkers: () => WorkerInstance[],
  reassignQueues: (workerId: string, queues: string[]) => Promise<boolean>,
  config: FailoverConfig = DEFAULT_CONFIG,
): Promise<{ success: boolean; assignedTo: string | null }> {
  const available = getAvailableWorkers().filter(w =>
    w.id !== failedWorker.id &&
    w.status === 'active' &&
    Date.now() - w.startedAt > config.cooldownPeriod
  )

  if (available.length === 0) {
    logger.error(`No available workers for failover from ${failedWorker.name}`, undefined, { data: { failedWorkerId: failedWorker.id } })
    return { success: false, assignedTo: null }
  }

  const target = available.reduce((prev, curr) =>
    curr.assignedQueues.length < prev.assignedQueues.length ? curr : prev
  )

  try {
    const success = await reassignQueues(target.id, failedWorker.assignedQueues)
    if (success) {
      target.assignedQueues.push(...failedWorker.assignedQueues)
      failoverHistory.push({
        timestamp: Date.now(),
        from: failedWorker.id,
        to: target.id,
        queues: [...failedWorker.assignedQueues],
        success: true,
      })
      logger.info(`Failover successful: ${failedWorker.name} -> ${target.name}`, {
        data: { from: failedWorker.id, to: target.id, queues: failedWorker.assignedQueues },
      })
      incrementCounter('ha_failovers_total', { worker: target.name, status: 'success' })
      return { success: true, assignedTo: target.id }
    }

    failoverHistory.push({
      timestamp: Date.now(),
      from: failedWorker.id,
      to: target.id,
      queues: [...failedWorker.assignedQueues],
      success: false,
    })
    incrementCounter('ha_failovers_total', { worker: target.name, status: 'failed' })
    return { success: false, assignedTo: null }
  } catch (error) {
    logger.error(`Failover reassignment failed`, error instanceof Error ? error : undefined, {
      data: { from: failedWorker.id, to: target.id },
    })
    return { success: false, assignedTo: null }
  }
}

export async function recoverWorker(
  workerId: string,
  recoveryFn: () => Promise<boolean>,
  config: FailoverConfig = DEFAULT_CONFIG,
): Promise<boolean> {
  const worker = instances.get(workerId)
  if (!worker) return false

  worker.status = 'recovering'

  try {
    const recovered = await recoveryFn()
    if (recovered) {
      worker.status = 'active'
      worker.lastHeartbeat = Date.now()
      logger.info(`Worker recovered: ${worker.name}`, { data: { workerId } })
      incrementCounter('ha_worker_recoveries_total', { worker: worker.name })
      return true
    }
    worker.status = 'failed'
    return false
  } catch (error) {
    worker.status = 'failed'
    logger.error(`Worker recovery failed: ${worker.name}`, error instanceof Error ? error : undefined, { data: { workerId } })
    return false
  }
}

export function getWorkerStatus(workerId: string): WorkerInstance | undefined {
  return instances.get(workerId)
}

export function getAllWorkers(): WorkerInstance[] {
  return Array.from(instances.values())
}

export function getHealthyWorkers(): WorkerInstance[] {
  return Array.from(instances.values()).filter(w => w.status === 'active')
}

export function getFailoverHistory(limit = 50): Array<{ timestamp: number; from: string; to: string; queues: string[]; success: boolean }> {
  return failoverHistory.slice(-limit)
}
