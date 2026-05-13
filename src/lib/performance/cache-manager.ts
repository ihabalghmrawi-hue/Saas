import { createLogger } from '@/lib/observability/logger'
import { recordCacheOperation } from '@/lib/metrics/collector'

const logger = createLogger('cache-manager')

interface CacheEntry<T> {
  value: T
  expiresAt: number
  createdAt: number
  hits: number
  lastAccessed: number
}

export interface CacheConfig {
  ttl: number
  maxSize: number
  evictionPolicy: 'lru' | 'lfu' | 'ttl'
  namespace: string
}

let stores = new Map<string, Map<string, CacheEntry<unknown>>>()
let configs = new Map<string, CacheConfig>()

export function configureCacheStores(storesOverride: {
  stores?: Map<string, Map<string, CacheEntry<unknown>>>
  configs?: Map<string, CacheConfig>
}): void {
  if (storesOverride.stores) stores = storesOverride.stores
  if (storesOverride.configs) configs = storesOverride.configs
}

const DEFAULT_CONFIG: CacheConfig = {
  ttl: 300000,
  maxSize: 10000,
  evictionPolicy: 'lru',
  namespace: 'default',
}

export function createCache(namespace: string, overrides?: Partial<CacheConfig>): void {
  const config: CacheConfig = { ...DEFAULT_CONFIG, ...overrides, namespace }
  configs.set(namespace, config)
  stores.set(namespace, new Map())
  logger.info(`Cache created: ${namespace} (ttl=${config.ttl}ms, max=${config.maxSize}, policy=${config.evictionPolicy})`)
}

export function ensureCache(namespace: string, overrides?: Partial<CacheConfig>): void {
  if (!stores.has(namespace)) {
    createCache(namespace, overrides)
  }
}

export function get<T>(namespace: string, key: string): T | undefined {
  ensureCache(namespace)
  const store = stores.get(namespace)!
  const config = configs.get(namespace)!
  const entry = store.get(key) as CacheEntry<T> | undefined

  if (!entry) {
    recordCacheOperation('get', false)
    return undefined
  }

  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    recordCacheOperation('get', false)
    return undefined
  }

  entry.hits++
  entry.lastAccessed = Date.now()
  recordCacheOperation('get', true)
  return entry.value
}

export function set<T>(namespace: string, key: string, value: T, ttl?: number): void {
  ensureCache(namespace)
  const store = stores.get(namespace)!
  const config = configs.get(namespace)!

  if (store.size >= config.maxSize) {
    evict(namespace)
  }

  const entry: CacheEntry<T> = {
    value,
    expiresAt: Date.now() + (ttl || config.ttl),
    createdAt: Date.now(),
    hits: 0,
    lastAccessed: Date.now(),
  }

  store.set(key, entry as CacheEntry<unknown>)
  recordCacheOperation('set', true)
}

export function del(namespace: string, key: string): void {
  const store = stores.get(namespace)
  if (store) {
    store.delete(key)
    recordCacheOperation('del', true)
  }
}

export function clear(namespace: string): void {
  const store = stores.get(namespace)
  if (store) {
    store.clear()
    logger.info(`Cache cleared: ${namespace}`)
  }
}

export function clearAll(): void {
  for (const [namespace] of stores) {
    clear(namespace)
  }
}

export function getOrSet<T>(
  namespace: string,
  key: string,
  fn: () => Promise<T>,
  ttl?: number,
): Promise<T> {
  const cached = get<T>(namespace, key)
  if (cached !== undefined) return Promise.resolve(cached)

  return fn().then(value => {
    set(namespace, key, value, ttl)
    return value
  })
}

export async function invalidatePattern(namespace: string, pattern: RegExp): Promise<number> {
  const store = stores.get(namespace)
  if (!store) return 0

  let count = 0
  for (const key of store.keys()) {
    if (pattern.test(key)) {
      store.delete(key)
      count++
    }
  }
  if (count > 0) {
    logger.info(`Cache invalidated ${count} entries matching pattern in ${namespace}`)
  }
  return count
}

export function getStats(namespace: string): { size: number; config: CacheConfig; hitRate: number } | undefined {
  const store = stores.get(namespace)
  const config = configs.get(namespace)
  if (!store || !config) return undefined

  const totalGets = Array.from(store.values()).reduce((sum, e) => sum + e.hits, 0)
  const totalEntries = store.size

  return {
    size: totalEntries,
    config,
    hitRate: totalEntries > 0 ? totalGets / totalEntries : 0,
  }
}

export function getAllStats(): Array<{ namespace: string; size: number; config: CacheConfig; hitRate: number }> {
  const result: Array<{ namespace: string; size: number; config: CacheConfig; hitRate: number }> = []
  for (const [namespace] of stores) {
    const stats = getStats(namespace)
    if (stats) result.push({ namespace, ...stats })
  }
  return result
}

function evict(namespace: string): void {
  const store = stores.get(namespace)
  const config = configs.get(namespace)
  if (!store || !config) return

  switch (config.evictionPolicy) {
    case 'lru': {
      let oldest = Date.now()
      let oldestKey: string | null = null
      for (const [key, entry] of store) {
        if (entry.lastAccessed < oldest) {
          oldest = entry.lastAccessed
          oldestKey = key
        }
      }
      if (oldestKey) store.delete(oldestKey)
      break
    }
    case 'lfu': {
      let minHits = Infinity
      let minHitsKey: string | null = null
      for (const [key, entry] of store) {
        if (entry.hits < minHits) {
          minHits = entry.hits
          minHitsKey = key
        }
      }
      if (minHitsKey) store.delete(minHitsKey)
      break
    }
    case 'ttl': {
      let nearest = Infinity
      let nearestKey: string | null = null
      for (const [key, entry] of store) {
        if (entry.expiresAt < nearest) {
          nearest = entry.expiresAt
          nearestKey = key
        }
      }
      if (nearestKey) store.delete(nearestKey)
      break
    }
  }
}

const ENTERPRISE_CACHES: Array<{ namespace: string; config: Partial<CacheConfig> }> = [
  { namespace: 'accounts', config: { ttl: 60000, maxSize: 5000, evictionPolicy: 'lru' } },
  { namespace: 'products', config: { ttl: 120000, maxSize: 10000, evictionPolicy: 'lru' } },
  { namespace: 'customers', config: { ttl: 60000, maxSize: 5000, evictionPolicy: 'lru' } },
  { namespace: 'journal_entries', config: { ttl: 30000, maxSize: 2000, evictionPolicy: 'lru' } },
  { namespace: 'financial_statements', config: { ttl: 300000, maxSize: 500, evictionPolicy: 'lru' } },
  { namespace: 'reports', config: { ttl: 600000, maxSize: 200, evictionPolicy: 'lru' } },
  { namespace: 'reconciliation', config: { ttl: 60000, maxSize: 1000, evictionPolicy: 'lru' } },
  { namespace: 'dashboard', config: { ttl: 120000, maxSize: 500, evictionPolicy: 'lru' } },
  { namespace: 'tenant_config', config: { ttl: 300000, maxSize: 1000, evictionPolicy: 'lru' } },
]

export function registerEnterpriseCaches(): void {
  for (const { namespace, config } of ENTERPRISE_CACHES) {
    createCache(namespace, config)
  }
  logger.info(`Registered ${ENTERPRISE_CACHES.length} enterprise caches`)
}
