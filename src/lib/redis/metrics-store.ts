import { RedisClient } from './client'

const COUNTER_PREFIX = 'metrics:counter:'
const GAUGE_PREFIX = 'metrics:gauge:'
const HISTOGRAM_PREFIX = 'metrics:histogram:'
const METADATA_PREFIX = 'metrics:meta:'
const DEFAULT_TTL = 86_400_000

export interface CounterRecord {
  value: number
  lastUpdated: number
}

export interface GaugeRecord {
  value: number
  lastUpdated: number
}

export interface HistogramRecord {
  count: number
  sum: number
  min: number
  max: number
  lastUpdated: number
}

export class DistributedMetricsStore {
  private client: RedisClient

  constructor(client: RedisClient) {
    this.client = client
  }

  async incrementCounter(name: string, by = 1, labels?: Record<string, string>): Promise<number> {
    const key = this.buildKey(COUNTER_PREFIX, name, labels)
    const value = await this.client.incrby(key, by)
    await this.client.pexpire(key, DEFAULT_TTL)
    await this.client.hset(`${METADATA_PREFIX}${name}`, 'type', 'counter', 'updated', Date.now().toString())
    return value
  }

  async getCounter(name: string, labels?: Record<string, string>): Promise<number> {
    const key = this.buildKey(COUNTER_PREFIX, name, labels)
    const val = await this.client.get(key)
    return val ? parseInt(val, 10) : 0
  }

  async setGauge(name: string, value: number, labels?: Record<string, string>): Promise<void> {
    const key = this.buildKey(GAUGE_PREFIX, name, labels)
    await this.client.set(key, value.toString())
    await this.client.pexpire(key, DEFAULT_TTL)
    await this.client.hset(`${METADATA_PREFIX}${name}`, 'type', 'gauge', 'updated', Date.now().toString())
  }

  async getGauge(name: string, labels?: Record<string, string>): Promise<number> {
    const key = this.buildKey(GAUGE_PREFIX, name, labels)
    const val = await this.client.get(key)
    return val ? parseFloat(val) : 0
  }

  async observeHistogram(name: string, value: number, labels?: Record<string, string>): Promise<void> {
    const key = this.buildKey(HISTOGRAM_PREFIX, name, labels)
    const countKey = `${key}:count`
    const sumKey = `${key}:sum`
    const minKey = `${key}:min`
    const maxKey = `${key}:max`

    const multi = this.client.multi()
    multi.incr(countKey)
    multi.incrbyfloat(sumKey, value)
    multi.get(minKey)
    multi.get(maxKey)
    const results = await multi.exec()
    if (!results) return

    const currentMin = results[2][1] ? parseFloat(results[2][1] as string) : null
    const currentMax = results[3][1] ? parseFloat(results[3][1] as string) : null

    const multi2 = this.client.multi()
    if (currentMin === null || value < currentMin) {
      multi2.set(minKey, value.toString())
    }
    if (currentMax === null || value > currentMax) {
      multi2.set(maxKey, value.toString())
    }
    const expireKeys = [countKey, sumKey, minKey, maxKey]
    for (const ek of expireKeys) {
      multi2.pexpire(ek, DEFAULT_TTL)
    }
    await multi2.exec()

    await this.client.hset(`${METADATA_PREFIX}${name}`, 'type', 'histogram', 'updated', Date.now().toString())
  }

  async getHistogram(name: string, labels?: Record<string, string>): Promise<HistogramRecord> {
    const key = this.buildKey(HISTOGRAM_PREFIX, name, labels)
    const [count, sum, min, max] = await Promise.all([
      this.client.get(`${key}:count`),
      this.client.get(`${key}:sum`),
      this.client.get(`${key}:min`),
      this.client.get(`${key}:max`),
    ])
    return {
      count: count ? parseInt(count, 10) : 0,
      sum: sum ? parseFloat(sum) : 0,
      min: min ? parseFloat(min) : 0,
      max: max ? parseFloat(max) : 0,
      lastUpdated: Date.now(),
    }
  }

  async getAllCounters(pattern = '*'): Promise<Record<string, number>> {
    return this.scanMetrics(COUNTER_PREFIX, pattern)
  }

  async getAllGauges(pattern = '*'): Promise<Record<string, number>> {
    return this.scanMetrics(GAUGE_PREFIX, pattern)
  }

  async resetAll(): Promise<number> {
    let deleted = 0
    for (const prefix of [COUNTER_PREFIX, GAUGE_PREFIX, HISTOGRAM_PREFIX]) {
      let cursor = '0'
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100)
        cursor = nextCursor
        if (keys.length > 0) {
          await this.client.del(...keys)
          deleted += keys.length
        }
      } while (cursor !== '0')
    }
    return deleted
  }

  async getMetadata(name: string): Promise<Record<string, string> | null> {
    const exists = await this.client.exists(`${METADATA_PREFIX}${name}`)
    if (!exists) return null
    return this.client.hgetall(`${METADATA_PREFIX}${name}`)
  }

  private buildKey(prefix: string, name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) return `${prefix}${name}`
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(':')
    return `${prefix}${name}:{${labelStr}}`
  }

  private async scanMetrics(prefix: string, pattern: string): Promise<Record<string, number>> {
    const result: Record<string, number> = {}
    let cursor = '0'
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', `${prefix}${pattern}`, 'COUNT', 100)
      cursor = nextCursor
      if (keys.length > 0) {
        const values = await this.client.mget(...keys)
        for (let i = 0; i < keys.length; i++) {
          result[keys[i]] = values[i] ? parseInt(values[i]!, 10) : 0
        }
      }
    } while (cursor !== '0')
    return result
  }
}
