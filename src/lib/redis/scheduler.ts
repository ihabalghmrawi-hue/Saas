import type { RedisClient } from './client'
import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('distributed-scheduler')

export interface ScheduledJob {
  id: string
  name: string
  type: 'cron' | 'interval' | 'once'
  schedule: string
  handler: string
  payload?: Record<string, unknown>
  tenantId?: string
  status: 'active' | 'paused' | 'completed' | 'failed'
  lastRunAt?: string
  lastRunDuration?: number
  lastError?: string
  nextRunAt: string
  createdAt: string
  updatedAt: string
}

export interface JobExecution {
  id: string
  jobId: string
  jobName: string
  workerId: string
  startedAt: string
  completedAt?: string
  duration?: number
  status: 'running' | 'success' | 'failed'
  error?: string
  result?: unknown
}

export class DistributedScheduler {
  private client: RedisClient
  private prefix: string
  private workerId: string
  private refreshInterval: ReturnType<typeof setInterval> | null = null
  private leaderKey: string
  private leaderTTL = 30_000
  private leaderRenewInterval = 10_000
  private isLeader = false
  private runningJobs = new Set<string>()
  private stopped = false

  constructor(client: RedisClient, options?: { prefix?: string; workerId?: string }) {
    this.client = client
    this.prefix = options?.prefix || 'finance:scheduler:'
    this.workerId = options?.workerId || `scheduler-${Math.random().toString(36).slice(2, 8)}`
    this.leaderKey = `${this.prefix}leader`
  }

  async start(): Promise<void> {
    await this.tryBecomeLeader()
    this.refreshInterval = setInterval(() => this.refresh(), 5_000)
    logger.info(`Scheduler started worker=${this.workerId} leader=${this.isLeader}`)
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.refreshInterval) clearInterval(this.refreshInterval)
    if (this.isLeader) await this.resignLeadership()
    logger.info(`Scheduler stopped worker=${this.workerId}`)
  }

  private async tryBecomeLeader(): Promise<void> {
    const acquired = await this.client.set(this.leaderKey, this.workerId, 'PX', this.leaderTTL, 'NX')
    this.isLeader = acquired === 'OK'
    if (this.isLeader) {
      this.startLeaderRenewal()
      logger.info(`Became scheduler leader worker=${this.workerId}`)
    }
  }

  private startLeaderRenewal(): void {
    const renew = async () => {
      if (!this.isLeader || this.stopped) return
      try {
        const current = await this.client.get(this.leaderKey)
        if (current === this.workerId) {
          await this.client.pexpire(this.leaderKey, this.leaderTTL)
        } else {
          this.isLeader = false
        }
      } catch { }
    }
    setInterval(renew, this.leaderRenewInterval)
  }

  private async resignLeadership(): Promise<void> {
    const current = await this.client.get(this.leaderKey)
    if (current === this.workerId) {
      await this.client.del(this.leaderKey)
      this.isLeader = false
    }
  }

  private async refresh(): Promise<void> {
    if (this.stopped) return
    if (!this.isLeader) {
      await this.tryBecomeLeader()
      return
    }
    if (this.runningJobs.size > 0) return
    await this.processScheduledJobs()
  }

  async registerJob(job: Omit<ScheduledJob, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'nextRunAt'> & { nextRunAt?: string }): Promise<string> {
    const id = `${job.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const now = new Date().toISOString()
    const fullJob: ScheduledJob = {
      id,
      name: job.name,
      type: job.type,
      schedule: job.schedule,
      handler: job.handler,
      payload: job.payload,
      tenantId: job.tenantId,
      status: 'active',
      nextRunAt: job.nextRunAt || new Date(Date.now() + 60_000).toISOString(),
      createdAt: now,
      updatedAt: now,
    }
    await this.client.hset(`${this.prefix}jobs`, id, JSON.stringify(fullJob))
    await this.client.zadd(`${this.prefix}schedule`, new Date(fullJob.nextRunAt).getTime(), id)
    logger.info(`Job registered id=${id} name=${job.name}`)
    return id
  }

  async unregisterJob(jobId: string): Promise<void> {
    await this.client.hdel(`${this.prefix}jobs`, jobId)
    await this.client.zrem(`${this.prefix}schedule`, jobId)
    logger.info(`Job unregistered id=${jobId}`)
  }

  async getJob(jobId: string): Promise<ScheduledJob | null> {
    const raw = await this.client.hget(`${this.prefix}jobs`, jobId)
    return raw ? JSON.parse(raw) : null
  }

  async listJobs(): Promise<ScheduledJob[]> {
    const raw = await this.client.hgetall(`${this.prefix}jobs`)
    return Object.values(raw).map((v) => JSON.parse(v))
  }

  async scheduleJob(jobId: string, runAt: string): Promise<void> {
    await this.client.zadd(`${this.prefix}schedule`, new Date(runAt).getTime(), jobId)
    const job = await this.getJob(jobId)
    if (job) {
      job.nextRunAt = runAt
      job.updatedAt = new Date().toISOString()
      await this.client.hset(`${this.prefix}jobs`, jobId, JSON.stringify(job))
    }
  }

  async pauseJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId)
    if (job) {
      job.status = 'paused'
      job.updatedAt = new Date().toISOString()
      await this.client.hset(`${this.prefix}jobs`, jobId, JSON.stringify(job))
      await this.client.zrem(`${this.prefix}schedule`, jobId)
    }
  }

  async resumeJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId)
    if (job) {
      job.status = 'active'
      job.updatedAt = new Date().toISOString()
      job.nextRunAt = new Date(Date.now() + 60_000).toISOString()
      await this.client.hset(`${this.prefix}jobs`, jobId, JSON.stringify(job))
      await this.client.zadd(`${this.prefix}schedule`, new Date(job.nextRunAt).getTime(), jobId)
    }
  }

  private async processScheduledJobs(): Promise<void> {
    const now = Date.now()
    const due = await this.client.zrangebyscore(`${this.prefix}schedule`, 0, now)

    for (const jobId of due) {
      if (this.stopped) break
      if (this.runningJobs.has(jobId)) continue

      const raw = await this.client.hget(`${this.prefix}jobs`, jobId)
      if (!raw) {
        await this.client.zrem(`${this.prefix}schedule`, jobId)
        continue
      }

      const job: ScheduledJob = JSON.parse(raw)
      if (job.status !== 'active') {
        await this.client.zrem(`${this.prefix}schedule`, jobId)
        continue
      }

      const lockKey = `${this.prefix}lock:${jobId}`
      const lockAcquired = await this.client.set(lockKey, this.workerId, 'PX', this.leaderTTL, 'NX')
      if (lockAcquired !== 'OK') continue

      this.runningJobs.add(jobId)
      await this.client.zrem(`${this.prefix}schedule`, jobId)

      this.executeJob(job).finally(() => {
        this.runningJobs.delete(jobId)
        this.client.del(lockKey).catch(() => {})
      })
    }
  }

  private async executeJob(job: ScheduledJob): Promise<void> {
    const executionId = `${job.id}-${Date.now()}`
    const startedAt = new Date().toISOString()
    const execution: JobExecution = {
      id: executionId,
      jobId: job.id,
      jobName: job.name,
      workerId: this.workerId,
      startedAt,
      status: 'running',
    }

    await this.client.lpush(`${this.prefix}executions`, JSON.stringify(execution))
    await this.client.ltrim(`${this.prefix}executions`, 0, 999)

    try {
      const startTime = Date.now()
      const result = await this.dispatchJob(job)
      const duration = Date.now() - startTime

      execution.status = 'success'
      execution.completedAt = new Date().toISOString()
      execution.duration = duration
      execution.result = result
      await this.client.lpush(`${this.prefix}executions`, JSON.stringify(execution))

      job.lastRunAt = startedAt
      job.lastRunDuration = duration
      job.lastError = undefined

      if (job.type === 'once') {
        job.status = 'completed'
      } else {
        const nextRun = this.computeNextRun(job)
        job.nextRunAt = nextRun.toISOString()
        await this.client.zadd(`${this.prefix}schedule`, nextRun.getTime(), job.id)
      }

      job.updatedAt = new Date().toISOString()
      await this.client.hset(`${this.prefix}jobs`, job.id, JSON.stringify(job))
      logger.info(`Job executed id=${job.id} name=${job.name} duration=${duration}ms`)
    } catch (error) {
      const duration = Date.now() - new Date(startedAt).getTime()
      execution.status = 'failed'
      execution.completedAt = new Date().toISOString()
      execution.duration = duration
      execution.error = error instanceof Error ? error.message : String(error)
      await this.client.lpush(`${this.prefix}executions`, JSON.stringify(execution))

      job.lastRunAt = startedAt
      job.lastRunDuration = duration
      job.lastError = execution.error
      job.updatedAt = new Date().toISOString()
      await this.client.hset(`${this.prefix}jobs`, job.id, JSON.stringify(job))

      const retryAt = new Date(Date.now() + 300_000).toISOString()
      await this.client.zadd(`${this.prefix}schedule`, new Date(retryAt).getTime(), job.id)
      logger.error(`Job failed id=${job.id} name=${job.name} error=${execution.error}`)
    }
  }

  private async dispatchJob(job: ScheduledJob): Promise<unknown> {
    const { EventBus } = await import('./pubsub')
    const bus = new EventBus(this.client)
    await bus.publish('scheduler:job.dispatch', {
      jobId: job.id,
      jobName: job.name,
      handler: job.handler,
      payload: job.payload,
      tenantId: job.tenantId,
      scheduledAt: job.nextRunAt,
      dispatchedAt: new Date().toISOString(),
      workerId: this.workerId,
    })
    return { dispatched: true }
  }

  private computeNextRun(job: ScheduledJob): Date {
    const lastRun = job.lastRunAt ? new Date(job.lastRunAt) : new Date()
    if (job.type === 'interval') {
      const intervalMs = parseInt(job.schedule, 10)
      return new Date(lastRun.getTime() + (isNaN(intervalMs) ? 60_000 : intervalMs))
    }
    return new Date(Date.now() + 60_000)
  }

  async recoverOrphanedJobs(): Promise<number> {
    const locks = await this.client.keys(`${this.prefix}lock:*`)
    let recovered = 0
    for (const lockKey of locks) {
      const ttl = await this.client.pttl(lockKey)
      if (ttl > 0) continue
      const jobId = lockKey.replace(`${this.prefix}lock:`, '')
      const raw = await this.client.hget(`${this.prefix}jobs`, jobId)
      if (!raw) {
        await this.client.del(lockKey)
        continue
      }
      const job: ScheduledJob = JSON.parse(raw)
      if (job.status !== 'active') {
        await this.client.del(lockKey)
        continue
      }
      await this.client.del(lockKey)
      const rescheduleAt = new Date(Date.now() + 30_000).toISOString()
      await this.scheduleJob(jobId, rescheduleAt)
      recovered++
      logger.info(`Recovered orphaned job id=${jobId} name=${job.name}`)
    }
    return recovered
  }

  async getExecutions(limit = 50): Promise<JobExecution[]> {
    const raw = await clientSideLimit(this.client, `${this.prefix}executions`, 0, limit - 1)
    return raw.map((v) => JSON.parse(v))
  }

  async getLeader(): Promise<string | null> {
    return this.client.get(this.leaderKey)
  }

  isCurrentLeader(): boolean {
    return this.isLeader
  }

  getWorkerId(): string {
    return this.workerId
  }
}

async function clientSideLimit(client: RedisClient, key: string, start: number, stop: number): Promise<string[]> {
  return client.lrange(key, start, stop)
}
