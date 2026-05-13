import type { RedisClient } from './client'
import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('cache-invalidation')

export interface CacheInvalidationEvent {
  type: 'invalidate' | 'invalidateTag' | 'invalidatePattern' | 'clear'
  namespace: string
  key?: string
  tag?: string
  pattern?: string
  tenantId?: string
  source: string
  timestamp: string
}

export class CacheInvalidationBus {
  private client: RedisClient
  private prefix: string
  private channel: string
  private generationKey: string
  private subscribed = false
  private handler: ((event: CacheInvalidationEvent) => void) | null = null
  private listeners = new Map<string, Set<(event: CacheInvalidationEvent) => void>>()

  constructor(client: RedisClient, options?: { prefix?: string; channel?: string }) {
    this.client = client
    this.prefix = options?.prefix || 'finance:cache:'
    this.channel = options?.channel || 'finance:cache:invalidation'
    this.generationKey = `${this.prefix}generation`
  }

  async subscribe(handler?: (event: CacheInvalidationEvent) => void): Promise<void> {
    if (this.subscribed) return
    this.subscribed = true
    if (handler) this.handler = handler

    const subClient = this.client.duplicate ? this.client.duplicate() : this.client
    try {
      await subClient.subscribe(this.channel, (message: string) => {
        try {
          const event: CacheInvalidationEvent = JSON.parse(message)
          this.dispatchToListeners(event)
          if (this.handler) this.handler(event)
        } catch { }
      })
      logger.info(`Subscribed to cache invalidation channel: ${this.channel}`)
    } catch (error) {
      this.subscribed = false
      logger.error(`Failed to subscribe to cache invalidation: ${error}`)
    }
  }

  async unsubscribe(): Promise<void> {
    if (!this.subscribed) return
    this.subscribed = false
    try {
      await this.client.unsubscribe(this.channel)
    } catch { }
  }

  on(eventType: string, listener: (event: CacheInvalidationEvent) => void): void {
    if (!this.listeners.has(eventType)) this.listeners.set(eventType, new Set())
    this.listeners.get(eventType)!.add(listener)
  }

  off(eventType: string, listener: (event: CacheInvalidationEvent) => void): void {
    this.listeners.get(eventType)?.delete(listener)
  }

  private dispatchToListeners(event: CacheInvalidationEvent): void {
    const typeListeners = this.listeners.get(event.type)
    if (typeListeners) {
      for (const listener of typeListeners) {
        try { listener(event) } catch { }
      }
    }
    const allListeners = this.listeners.get('*')
    if (allListeners) {
      for (const listener of allListeners) {
        try { listener(event) } catch { }
      }
    }
  }

  async invalidate(namespace: string, key: string): Promise<void> {
    const event: CacheInvalidationEvent = {
      type: 'invalidate',
      namespace,
      key,
      source: `worker:${await this.getWorkerId()}`,
      timestamp: new Date().toISOString(),
    }
    await this.publishEvent(event)
    await this.bumpGeneration(namespace)
  }

  async invalidateByTag(namespace: string, tag: string, tenantId?: string): Promise<void> {
    const event: CacheInvalidationEvent = {
      type: 'invalidateTag',
      namespace,
      tag,
      tenantId,
      source: `worker:${await this.getWorkerId()}`,
      timestamp: new Date().toISOString(),
    }
    await this.publishEvent(event)
    await this.bumpGeneration(namespace)
  }

  async invalidateByPattern(namespace: string, pattern: string): Promise<void> {
    const event: CacheInvalidationEvent = {
      type: 'invalidatePattern',
      namespace,
      pattern,
      source: `worker:${await this.getWorkerId()}`,
      timestamp: new Date().toISOString(),
    }
    await this.publishEvent(event)
    await this.bumpGeneration(namespace)
  }

  async clearAll(namespace?: string): Promise<void> {
    const event: CacheInvalidationEvent = {
      type: 'clear',
      namespace: namespace || '*',
      source: `worker:${await this.getWorkerId()}`,
      timestamp: new Date().toISOString(),
    }
    await this.publishEvent(event)
    if (namespace) {
      await this.bumpGeneration(namespace)
    }
  }

  async getGeneration(namespace: string): Promise<number> {
    const val = await this.client.get(`${this.generationKey}:${namespace}`)
    return val ? parseInt(val, 10) : 0
  }

  private async bumpGeneration(namespace: string): Promise<void> {
    await this.client.incr(`${this.generationKey}:${namespace}`)
  }

  async isStale(namespace: string, cachedGeneration: number): Promise<boolean> {
    const current = await this.getGeneration(namespace)
    return cachedGeneration < current
  }

  async attachTag(namespace: string, key: string, tag: string): Promise<void> {
    await this.client.sadd(`${this.prefix}tags:${namespace}:${tag}`, key)
    await this.client.sadd(`${this.prefix}tag-index:${namespace}`, tag)
  }

  async getKeysByTag(namespace: string, tag: string): Promise<string[]> {
    return this.client.smembers(`${this.prefix}tags:${namespace}:${tag}`)
  }

  async removeTag(namespace: string, key: string, tag: string): Promise<void> {
    await this.client.srem(`${this.prefix}tags:${namespace}:${tag}`, key)
  }

  private async publishEvent(event: CacheInvalidationEvent): Promise<void> {
    try {
      await this.client.publish(this.channel, JSON.stringify(event))
    } catch (error) {
      logger.error(`Failed to publish cache invalidation event: ${error}`)
    }
  }

  private workerId: string | null = null
  private async getWorkerId(): Promise<string> {
    if (!this.workerId) {
      try {
        this.workerId = await this.client.get(`${this.prefix}worker-id`) || 'unknown'
      } catch {
        this.workerId = 'unknown'
      }
    }
    return this.workerId
  }
}
