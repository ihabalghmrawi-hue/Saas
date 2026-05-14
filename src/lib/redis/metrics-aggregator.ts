import type { RedisClient } from './client'
import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('metrics-aggregator')

export interface AggregatedMetric {
  name: string
  type: 'counter' | 'gauge' | 'histogram'
  value: number
  count: number
  min: number
  max: number
  sum: number
  avg: number
  p50: number
  p95: number
  p99: number
  timestamp: string
  labels?: Record<string, string>
  tenantId?: string
}

export interface RollingWindow {
  windowMs: number
  bucketCount: number
  bucketMs: number
}

export class MetricsAggregator {
  private client: RedisClient
  private prefix: string
  private windows: RollingWindow[]
  private flushInterval: ReturnType<typeof setInterval> | null = null

  constructor(client: RedisClient, options?: {
    prefix?: string
    windows?: RollingWindow[]
    flushIntervalMs?: number
  }) {
    this.client = client
    this.prefix = options?.prefix || 'finance:metrics:'
    this.windows = options?.windows || [
      { windowMs: 60_000, bucketCount: 60, bucketMs: 1_000 },
      { windowMs: 300_000, bucketCount: 60, bucketMs: 5_000 },
      { windowMs: 3_600_000, bucketCount: 60, bucketMs: 60_000 },
    ]
  }

  start(): void {
    if (this.flushInterval) return
    this.flushInterval = setInterval(() => this.aggregateBuckets(), 10_000)
    logger.info('Metrics aggregator started')
  }

  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
  }

  async record(name: string, value: number, labels?: Record<string, string>, tenantId?: string): Promise<void> {
    const now = Date.now()
    const pipeline = this.client.pipeline()

    for (const window of this.windows) {
      const bucketKey = this.bucketKey(name, window, labels, tenantId)
      const score = Math.floor(now / window.bucketMs) * window.bucketMs
      const member = `${value}:${now}:${Math.random().toString(36).slice(2, 6)}`

      pipeline.zadd(bucketKey, score, member)
      pipeline.zremrangebyscore(bucketKey, 0, now - window.windowMs)
      pipeline.zcard(bucketKey)
    }

    const counterKey = `${this.prefix}counters:${name}`
    pipeline.incr(counterKey)

    if (labels) {
      for (const [lk, lv] of Object.entries(labels)) {
        pipeline.sadd(`${this.prefix}labels:${name}`, `${lk}=${lv}`)
      }
    }

    if (tenantId) {
      pipeline.sadd(`${this.prefix}tenants:${name}`, tenantId)
    }

    await pipeline.exec()
  }

  async query(name: string, options?: {
    windowMs?: number
    tenantId?: string
    labels?: Record<string, string>
    from?: number
    to?: number
  }): Promise<AggregatedMetric | null> {
    const windowMs = options?.windowMs || 60_000
    const window = this.windows.find(w => w.windowMs === windowMs) || this.windows[0]
    const bucketKey = this.bucketKey(name, window, options?.labels, options?.tenantId)
    const now = Date.now()
    const from = options?.from || now - window.windowMs
    const to = options?.to || now

    const values = await this.client.zrangebyscore(bucketKey, from, to)
    if (values.length === 0) return null

    const parsed = values.map(v => {
      const [val] = v.split(':')
      return parseFloat(val)
    }).filter(v => !isNaN(v))

    if (parsed.length === 0) return null

    const sorted = [...parsed].sort((a, b) => a - b)
    const sum = parsed.reduce((s, v) => s + v, 0)
    const count = parsed.length
    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    const avg = sum / count
    const p50 = percentile(sorted, 50)
    const p95 = percentile(sorted, 95)
    const p99 = percentile(sorted, 99)

    return {
      name,
      type: 'histogram',
      value: avg,
      count,
      min,
      max,
      sum,
      avg,
      p50,
      p95,
      p99,
      timestamp: new Date().toISOString(),
      labels: options?.labels,
      tenantId: options?.tenantId,
    }
  }

  async getCounter(name: string): Promise<number> {
    const val = await this.client.get(`${this.prefix}counters:${name}`)
    return val ? parseInt(val, 10) : 0
  }

  async getTenantMetrics(name: string, tenantId: string): Promise<AggregatedMetric | null> {
    return this.query(name, { tenantId, windowMs: 300_000 })
  }

  async getWorkerMetrics(workerId: string): Promise<AggregatedMetric | null> {
    return this.query('worker.throughput', { labels: { worker: workerId }, windowMs: 300_000 })
  }

  async getQueueMetrics(queueName: string): Promise<AggregatedMetric | null> {
    return this.query('queue.throughput', { labels: { queue: queueName }, windowMs: 300_000 })
  }

  async getFinancialMetrics(metricName: string): Promise<AggregatedMetric | null> {
    return this.query(metricName, { windowMs: 3_600_000 })
  }

  async listMetricNames(): Promise<string[]> {
    const keys: string[] = []
    let cursor = '0'
    do {
      const [nextCursor, ks] = await this.client.scan(cursor, 'MATCH', `${this.prefix}counters:*`, 'COUNT', 100)
      cursor = nextCursor
      for (const k of ks) keys.push(k.slice(this.prefix.length + 9))
    } while (cursor !== '0')
    return [...new Set(keys)]
  }

  async listTenants(name: string): Promise<string[]> {
    return this.client.smembers(`${this.prefix}tenants:${name}`)
  }

  async reset(name: string): Promise<void> {
    const pipeline = this.client.pipeline()
    pipeline.del(`${this.prefix}counters:${name}`)
    for (const window of this.windows) {
      for (let i = 0; i < 10; i++) {
        pipeline.del(`${this.prefix}buckets:${name}:${window.windowMs}:${i}`)
      }
    }
    await pipeline.exec()
  }

  private async aggregateBuckets(): Promise<void> {
    const names = await this.listMetricNames()
    for (const name of names) {
      const count = await this.getCounter(name)
      if (count > 0) {
        const metric = await this.query(name, { windowMs: 60_000 })
        if (metric) {
          const key = `${this.prefix}latest:${name}`
          await this.client.setex(key, 120, JSON.stringify(metric))
        }
      }
    }
  }

  private bucketKey(name: string, window: RollingWindow, labels?: Record<string, string>, tenantId?: string): string {
    const base = `${this.prefix}buckets:${name}:${window.windowMs}`
    if (tenantId) return `${base}:tenant:${tenantId}`
    if (labels) {
      const labelStr = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&')
      return `${base}:labels:${labelStr}`
    }
    return base
  }

  async getLatestMetric(name: string): Promise<AggregatedMetric | null> {
    const raw = await this.client.get(`${this.prefix}latest:${name}`)
    return raw ? JSON.parse(raw) : null
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}
