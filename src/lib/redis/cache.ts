import { RedisClient } from './client'

const CACHE_PREFIX = 'cache:'
const TAG_PREFIX = 'cache:tag:'
const INDEX_PREFIX = 'cache:idx:'

export interface CacheOptions {
  ttl?: number
  tags?: string[]
}

export interface CacheStats {
  hits: number
  misses: number
  keys: number
  memory: string
}

export class DistributedCache {
  private client: RedisClient
  private prefix: string
  private hitCount: number
  private missCount: number

  constructor(client: RedisClient, prefix = '') {
    this.client = client
    this.prefix = prefix
    this.hitCount = 0
    this.missCount = 0
  }

  private key(name: string): string {
    return `${CACHE_PREFIX}${this.prefix}${name}`
  }

  private tagKey(tag: string): string {
    return `${TAG_PREFIX}${this.prefix}${tag}`
  }

  private indexKey(name: string): string {
    return `${INDEX_PREFIX}${this.prefix}${name}`
  }

  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.key(key)
    const data = await this.client.get(fullKey)
    if (data === null) {
      this.missCount++
      return null
    }
    this.hitCount++
    return JSON.parse(data) as T
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.key(key)
    const serialized = JSON.stringify(value)
    const ttl = options?.ttl

    if (ttl && ttl > 0) {
      await this.client.setex(fullKey, Math.ceil(ttl / 1000), serialized)
    } else {
      await this.client.set(fullKey, serialized)
    }

    if (options?.tags && options.tags.length > 0) {
      const pipeline = this.client.pipeline()
      for (const tag of options.tags) {
        pipeline.sadd(this.tagKey(tag), fullKey)
        pipeline.sadd(this.indexKey(`tag:${tag}`), key)
      }
      pipeline.expire(this.tagKey(options.tags[0]), 86400)
      await pipeline.exec()
    }
  }

  async getOrSet<T>(
    key: string,
    fetch: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) return cached

    const value = await fetch()
    await this.set(key, value, options)
    return value
  }

  async del(key: string): Promise<boolean> {
    const fullKey = this.key(key)
    const result = await this.client.del(fullKey)
    return result > 0
  }

  async delPattern(pattern: string): Promise<number> {
    let deleted = 0
    let cursor = '0'
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', `${this.key(pattern)}`, 'COUNT', 100)
      cursor = nextCursor
      if (keys.length > 0) {
        await this.client.del(...keys)
        deleted += keys.length
      }
    } while (cursor !== '0')
    return deleted
  }

  async invalidateTag(tag: string): Promise<number> {
    const tagKey = this.tagKey(tag)
    const members = await this.client.smembers(tagKey)
    if (members.length === 0) return 0

    await this.client.del(...members)
    await this.client.del(tagKey)
    return members.length
  }

  async invalidateTags(tags: string[]): Promise<number> {
    let total = 0
    for (const tag of tags) {
      total += await this.invalidateTag(tag)
    }
    return total
  }

  async clear(): Promise<number> {
    return this.delPattern('*')
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(this.key(key))
    return result === 1
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(this.key(key))
  }

  async getStats(): Promise<CacheStats> {
    const info = await this.client.info('memory')
    const memoryLine = info.split('\r\n').find((l) => l.startsWith('used_memory_human:'))
    const memory = memoryLine ? memoryLine.split(':')[1] : 'unknown'

    let keys = 0
    let cursor = '0'
    do {
      const [nextCursor, ks] = await this.client.scan(cursor, 'MATCH', `${CACHE_PREFIX}${this.prefix}*`, 'COUNT', 1000)
      cursor = nextCursor
      keys += ks.length
    } while (cursor !== '0')

    return {
      hits: this.hitCount,
      misses: this.missCount,
      keys,
      memory,
    }
  }
}
