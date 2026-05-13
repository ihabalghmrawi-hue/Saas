import { RedisClient } from './client'
import os from 'os'

const WORKER_PREFIX = 'worker:'
const HEARTBEAT_PREFIX = 'heartbeat:'
const LEADER_PREFIX = 'leader:'
const TASK_PREFIX = 'task:'
const HEARTBEAT_TTL = 15_000
const LEADER_TTL = 30_000
const LEADER_RENEW_INTERVAL = 10_000

export enum WorkerStatus {
  ACTIVE = 'active',
  IDLE = 'idle',
  BUSY = 'busy',
  DEGRADED = 'degraded',
  OFFLINE = 'offline',
}

export interface WorkerRegistration {
  id: string
  type: string
  host: string
  pid: number
  status: WorkerStatus
  capabilities: string[]
  assignedQueues: string[]
  metadata?: Record<string, any>
  registeredAt: number
  lastHeartbeat: number
}

export interface LeaderInfo {
  workerId: string
  electedAt: number
  expiresAt: number
}

export class WorkerCoordinator {
  private client: RedisClient
  private workerId: string
  private heartbeatTimer: ReturnType<typeof setInterval> | null
  private leaderRenewTimer: ReturnType<typeof setInterval> | null
  private isLeader: boolean

  constructor(client: RedisClient, workerId?: string) {
    this.client = client
    this.workerId = workerId || `${os.hostname()}-${process.pid}`
    this.heartbeatTimer = null
    this.leaderRenewTimer = null
    this.isLeader = false
  }

  async register(options: {
    type: string
    capabilities?: string[]
    assignedQueues?: string[]
    metadata?: Record<string, any>
  }): Promise<void> {
    const registration: WorkerRegistration = {
      id: this.workerId,
      type: options.type,
      host: os.hostname(),
      pid: process.pid,
      status: WorkerStatus.ACTIVE,
      capabilities: options.capabilities || [],
      assignedQueues: options.assignedQueues || [],
      metadata: options.metadata,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
    }

    await this.client.set(
      `${WORKER_PREFIX}${this.workerId}`,
      JSON.stringify(registration)
    )
    await this.client.sadd(`${WORKER_PREFIX}types:${options.type}`, this.workerId)

    this.startHeartbeat()
  }

  async unregister(): Promise<void> {
    this.stopHeartbeat()
    this.stopLeaderRenew()

    const reg = await this.getRegistration()
    if (reg) {
      await this.client.srem(`${WORKER_PREFIX}types:${reg.type}`, this.workerId)
    }
    await this.client.del(`${WORKER_PREFIX}${this.workerId}`)
    await this.client.del(`${HEARTBEAT_PREFIX}${this.workerId}`)

    if (this.isLeader) {
      await this.client.del(`${LEADER_PREFIX}${reg?.type || 'default'}`)
      this.isLeader = false
    }
  }

  async heartbeat(status?: WorkerStatus): Promise<void> {
    const now = Date.now()
    const data = JSON.stringify({ timestamp: now, status: status || WorkerStatus.ACTIVE })
    await this.client.setex(`${HEARTBEAT_PREFIX}${this.workerId}`, Math.ceil(HEARTBEAT_TTL / 1000), data)

    const reg = await this.getRegistration()
    if (reg) {
      reg.lastHeartbeat = now
      if (status) reg.status = status
      await this.client.set(`${WORKER_PREFIX}${this.workerId}`, JSON.stringify(reg))
    }
  }

  async getRegistration(): Promise<WorkerRegistration | null> {
    const data = await this.client.get(`${WORKER_PREFIX}${this.workerId}`)
    if (!data) return null
    return JSON.parse(data)
  }

  async getWorker(workerId: string): Promise<WorkerRegistration | null> {
    const data = await this.client.get(`${WORKER_PREFIX}${workerId}`)
    if (!data) return null
    return JSON.parse(data)
  }

  async getWorkersByType(type: string): Promise<WorkerRegistration[]> {
    const members = await this.client.smembers(`${WORKER_PREFIX}types:${type}`)
    if (members.length === 0) return []
    const pipeline = this.client.pipeline()
    for (const id of members) {
      pipeline.get(`${WORKER_PREFIX}${id}`)
    }
    const results = await pipeline.exec()
    if (!results) return []

    const workers: WorkerRegistration[] = []
    for (const r of results) {
      if (r[1]) workers.push(JSON.parse(r[1] as string))
    }
    return workers
  }

  async getAllWorkers(): Promise<WorkerRegistration[]> {
    const workers: WorkerRegistration[] = []
    let cursor = '0'
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', `${WORKER_PREFIX}*`, 'COUNT', 100)
      cursor = nextCursor
      if (keys.length > 0) {
        const values = await this.client.mget(...keys)
        for (const v of values) {
          if (v) workers.push(JSON.parse(v))
        }
      }
    } while (cursor !== '0')
    return workers
  }

  async detectFailedWorkers(timeout = HEARTBEAT_TTL * 2): Promise<string[]> {
    const workers = await this.getAllWorkers()
    const failed: string[] = []
    const now = Date.now()
    for (const w of workers) {
      if (now - w.lastHeartbeat > timeout) {
        failed.push(w.id)
        const reg = await this.getWorker(w.id)
        if (reg) {
          reg.status = WorkerStatus.OFFLINE
          await this.client.set(`${WORKER_PREFIX}${w.id}`, JSON.stringify(reg))
        }
      }
    }
    return failed
  }

  async electLeader(type: string): Promise<boolean> {
    const leaderKey = `${LEADER_PREFIX}${type}`
    const acquired = await this.client.set(leaderKey, this.workerId, 'PX', LEADER_TTL, 'NX')
    if (acquired === 'OK') {
      this.isLeader = true
      this.startLeaderRenew(type)
      return true
    }
    this.isLeader = false
    return false
  }

  async getLeader(type: string): Promise<LeaderInfo | null> {
    const leaderKey = `${LEADER_PREFIX}${type}`
    const data = await this.client.get(leaderKey)
    if (!data) return null
    const ttl = await this.client.pttl(leaderKey)
    return {
      workerId: data,
      electedAt: Date.now() - (LEADER_TTL - ttl),
      expiresAt: Date.now() + ttl,
    }
  }

  async resignLeadership(type: string): Promise<void> {
    const leaderKey = `${LEADER_PREFIX}${type}`
    const current = await this.client.get(leaderKey)
    if (current === this.workerId) {
      await this.client.del(leaderKey)
      this.isLeader = false
      this.stopLeaderRenew()
    }
  }

  isCurrentLeader(): boolean {
    return this.isLeader
  }

  async distributeTasks(taskType: string, items: string[], workerType: string): Promise<number> {
    const workers = await this.getWorkersByType(workerType)
    const activeWorkers = workers.filter((w) => w.status !== WorkerStatus.OFFLINE)
    if (activeWorkers.length === 0) return 0

    let distributed = 0
    for (let i = 0; i < items.length; i++) {
      const worker = activeWorkers[i % activeWorkers.length]
      const taskKey = `${TASK_PREFIX}${worker.id}:${taskType}`
      await this.client.lpush(taskKey, items[i])
      await this.client.expire(taskKey, 3600)
      distributed++
    }
    return distributed
  }

  async getPendingTasks(workerId: string, taskType: string): Promise<number> {
    return this.client.llen(`${TASK_PREFIX}${workerId}:${taskType}`)
  }

  async getWorkerCountByType(type: string): Promise<number> {
    return this.client.scard(`${WORKER_PREFIX}types:${type}`)
  }

  async getClusterStats(): Promise<ClusterStats> {
    const workers = await this.getAllWorkers()
    const byType: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    for (const w of workers) {
      byType[w.type] = (byType[w.type] || 0) + 1
      byStatus[w.status] = (byStatus[w.status] || 0) + 1
    }
    return {
      totalWorkers: workers.length,
      byType,
      byStatus,
      activeWorkers: workers.filter((w) => w.status === WorkerStatus.ACTIVE).length,
      offlineWorkers: workers.filter((w) => w.status === WorkerStatus.OFFLINE).length,
    }
  }

  async disconnect(): Promise<void> {
    this.stopHeartbeat()
    this.stopLeaderRenew()
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.heartbeat().catch(() => {})
    }, HEARTBEAT_TTL / 3)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private startLeaderRenew(type: string): void {
    this.leaderRenewTimer = setInterval(() => {
      if (this.isLeader) {
        this.client
          .pexpire(`${LEADER_PREFIX}${type}`, LEADER_TTL)
          .catch(() => {})
      }
    }, LEADER_RENEW_INTERVAL)
  }

  private stopLeaderRenew(): void {
    if (this.leaderRenewTimer) {
      clearInterval(this.leaderRenewTimer)
      this.leaderRenewTimer = null
    }
  }
}

export interface ClusterStats {
  totalWorkers: number
  byType: Record<string, number>
  byStatus: Record<string, number>
  activeWorkers: number
  offlineWorkers: number
}
