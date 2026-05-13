import { RedisClient } from './client'

export interface KVStore<T = unknown> {
  get(key: string): Promise<T | null>
  set(key: string, value: T): Promise<void>
  setex(key: string, value: T, ttlMs: number): Promise<void>
  delete(key: string): Promise<boolean>
  clear(): Promise<number>
  keys(pattern?: string): Promise<string[]>
}

export interface ListStore<T = unknown> {
  append(key: string, value: T): Promise<number>
  range(key: string, start: number, stop: number): Promise<T[]>
  length(key: string): Promise<number>
  remove(key: string, value: T, count?: number): Promise<number>
  delete(key: string): Promise<boolean>
  clear(): Promise<number>
}

export interface MapStore<V = unknown> {
  get(key: string): Promise<V | undefined>
  set(key: string, value: V): Promise<void>
  delete(key: string): Promise<boolean>
  has(key: string): Promise<boolean>
  keys(): Promise<string[]>
  entries(): Promise<[string, V][]>
  size(): Promise<number>
  clear(): Promise<void>
}

export interface CounterStore {
  get(key: string): Promise<number>
  increment(key: string, by?: number): Promise<number>
  decrement(key: string, by?: number): Promise<number>
  reset(key: string): Promise<void>
  clear(): Promise<number>
}

export interface SetStore {
  add(key: string, value: string): Promise<void>
  remove(key: string, value: string): Promise<boolean>
  members(key: string): Promise<string[]>
  isMember(key: string, value: string): Promise<boolean>
  size(key: string): Promise<number>
  clear(): Promise<number>
}

export function createInMemoryKVStore<T = unknown>(store?: Map<string, T>): KVStore<T> {
  const data = store || new Map<string, T>()
  const ttls = new Map<string, number>()

  const prune = () => {
    const now = Date.now()
    for (const [key, expiry] of ttls) {
      if (expiry <= now) {
        data.delete(key)
        ttls.delete(key)
      }
    }
  }

  return {
    async get(key) {
      prune()
      const expiry = ttls.get(key)
      if (expiry && expiry <= Date.now()) {
        data.delete(key)
        ttls.delete(key)
        return null
      }
      return data.get(key) ?? null
    },
    async set(key, value) {
      data.set(key, value)
    },
    async setex(key, value, ttlMs) {
      data.set(key, value)
      ttls.set(key, Date.now() + ttlMs)
    },
    async delete(key) {
      ttls.delete(key)
      return data.delete(key)
    },
    async clear() {
      const count = data.size
      data.clear()
      ttls.clear()
      return count
    },
    async keys(pattern) {
      prune()
      const all = [...data.keys()]
      if (!pattern || pattern === '*') return all
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
      return all.filter((k) => regex.test(k))
    },
  }
}

export function createInMemoryListStore<T = unknown>(): ListStore<T> {
  const lists = new Map<string, T[]>()

  return {
    async append(key, value) {
      const list = lists.get(key) || []
      list.push(value)
      lists.set(key, list)
      return list.length
    },
    async range(key, start, stop) {
      const list = lists.get(key) || []
      const end = stop < 0 ? list.length + stop : stop
      return list.slice(start, end + 1)
    },
    async length(key) {
      return (lists.get(key) || []).length
    },
    async remove(key, value, count) {
      const list = lists.get(key) || []
      const originalLen = list.length
      if (count === undefined || count <= 0) {
        lists.set(key, list.filter((v) => v !== value))
      } else {
        let removed = 0
        lists.set(
          key,
          list.filter((v) => {
            if (v === value && removed < count) {
              removed++
              return false
            }
            return true
          })
        )
      }
      return originalLen - (lists.get(key)?.length || 0)
    },
    async delete(key) {
      return lists.delete(key)
    },
    async clear() {
      const count = lists.size
      lists.clear()
      return count
    },
  }
}

export function createInMemoryMapStore<V = unknown>(): MapStore<V> {
  const maps = new Map<string, Map<string, V>>()

  const getMap = (key: string): Map<string, V> => {
    if (!maps.has(key)) maps.set(key, new Map())
    return maps.get(key)!
  }

  return {
    async get(key) {
      const parts = splitStoreKey(key)
      const map = maps.get(parts[0])
      if (!map) return undefined
      return map.get(parts[1])
    },
    async set(key, value) {
      const parts = splitStoreKey(key)
      getMap(parts[0]).set(parts[1], value)
    },
    async delete(key) {
      const parts = splitStoreKey(key)
      const map = maps.get(parts[0])
      if (!map) return false
      return map.delete(parts[1])
    },
    async has(key) {
      const parts = splitStoreKey(key)
      const map = maps.get(parts[0])
      if (!map) return false
      return map.has(parts[1])
    },
    async keys() {
      const result: string[] = []
      for (const [namespace, map] of maps) {
        for (const key of map.keys()) {
          result.push(`${namespace}:${key}`)
        }
      }
      return result
    },
    async entries() {
      const result: [string, V][] = []
      for (const [namespace, map] of maps) {
        for (const [key, value] of map) {
          result.push([`${namespace}:${key}`, value])
        }
      }
      return result
    },
    async size() {
      let total = 0
      for (const map of maps.values()) total += map.size
      return total
    },
    async clear() {
      maps.clear()
    },
  }
}

export function createInMemoryCounterStore(): CounterStore {
  const counters = new Map<string, number>()

  return {
    async get(key) {
      return counters.get(key) || 0
    },
    async increment(key, by = 1) {
      const current = counters.get(key) || 0
      const next = current + by
      counters.set(key, next)
      return next
    },
    async decrement(key, by = 1) {
      const current = counters.get(key) || 0
      const next = Math.max(0, current - by)
      counters.set(key, next)
      return next
    },
    async reset(key) {
      counters.delete(key)
    },
    async clear() {
      const count = counters.size
      counters.clear()
      return count
    },
  }
}

export function createInMemorySetStore(): SetStore {
  const sets = new Map<string, Set<string>>()

  return {
    async add(key, value) {
      if (!sets.has(key)) sets.set(key, new Set())
      sets.get(key)!.add(value)
    },
    async remove(key, value) {
      const s = sets.get(key)
      if (!s) return false
      const result = s.delete(value)
      if (s.size === 0) sets.delete(key)
      return result
    },
    async members(key) {
      const s = sets.get(key)
      return s ? [...s] : []
    },
    async isMember(key, value) {
      return sets.get(key)?.has(value) ?? false
    },
    async size(key) {
      return sets.get(key)?.size ?? 0
    },
    async clear() {
      const count = sets.size
      sets.clear()
      return count
    },
  }
}

export function createRedisKVStore<T = unknown>(client: RedisClient, prefix = ''): KVStore<T> {
  return {
    async get(key) {
      const data = await client.get(`${prefix}${key}`)
      if (!data) return null
      return JSON.parse(data) as T
    },
    async set(key, value) {
      await client.set(`${prefix}${key}`, JSON.stringify(value))
    },
    async setex(key, value, ttlMs) {
      await client.setex(`${prefix}${key}`, Math.ceil(ttlMs / 1000), JSON.stringify(value))
    },
    async delete(key) {
      const result = await client.del(`${prefix}${key}`)
      return result > 0
    },
    async clear() {
      let deleted = 0
      let cursor = '0'
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100)
        cursor = nextCursor
        if (keys.length > 0) {
          await client.del(...keys)
          deleted += keys.length
        }
      } while (cursor !== '0')
      return deleted
    },
    async keys(pattern) {
      const result: string[] = []
      const searchPattern = pattern ? `${prefix}${pattern}` : `${prefix}*`
      let cursor = '0'
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', searchPattern, 'COUNT', 100)
        cursor = nextCursor
        for (const k of keys) {
          result.push(k.slice(prefix.length))
        }
      } while (cursor !== '0')
      return result
    },
  }
}

export function createRedisListStore<T = unknown>(client: RedisClient, prefix = ''): ListStore<T> {
  return {
    async append(key, value) {
      return client.lpush(`${prefix}${key}`, JSON.stringify(value))
    },
    async range(key, start, stop) {
      const items = await client.lrange(`${prefix}${key}`, start, stop)
      return items.map((i) => JSON.parse(i)) as T[]
    },
    async length(key) {
      return client.llen(`${prefix}${key}`)
    },
    async remove(key, value, count) {
      return client.lrem(`${prefix}${key}`, count ?? 0, JSON.stringify(value))
    },
    async delete(key) {
      const result = await client.del(`${prefix}${key}`)
      return result > 0
    },
    async clear() {
      let deleted = 0
      let cursor = '0'
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100)
        cursor = nextCursor
        if (keys.length > 0) {
          await client.del(...keys)
          deleted += keys.length
        }
      } while (cursor !== '0')
      return deleted
    },
  }
}

export function createRedisMapStore<V = unknown>(client: RedisClient, prefix = ''): MapStore<V> {
  return {
    async get(key) {
      const data = await client.hget(`${prefix}map`, key)
      if (!data) return undefined
      return JSON.parse(data) as V
    },
    async set(key, value) {
      await client.hset(`${prefix}map`, key, JSON.stringify(value))
    },
    async delete(key) {
      const result = await client.hdel(`${prefix}map`, key)
      return result > 0
    },
    async has(key) {
      const result = await client.hexists(`${prefix}map`, key)
      return result > 0
    },
    async keys() {
      return client.hkeys(`${prefix}map`)
    },
    async entries() {
      const raw = await client.hgetall(`${prefix}map`)
      return Object.entries(raw).map(([k, v]) => [k, JSON.parse(v) as V])
    },
    async size() {
      return client.hlen(`${prefix}map`)
    },
    async clear() {
      await client.del(`${prefix}map`)
    },
  }
}

export function createRedisCounterStore(client: RedisClient, prefix = ''): CounterStore {
  return {
    async get(key) {
      const val = await client.get(`${prefix}${key}`)
      return val ? parseInt(val, 10) : 0
    },
    async increment(key, by = 1) {
      return client.incrby(`${prefix}${key}`, by)
    },
    async decrement(key, by = 1) {
      return client.decrby(`${prefix}${key}`, by)
    },
    async reset(key) {
      await client.del(`${prefix}${key}`)
    },
    async clear() {
      let deleted = 0
      let cursor = '0'
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100)
        cursor = nextCursor
        if (keys.length > 0) {
          await client.del(...keys)
          deleted += keys.length
        }
      } while (cursor !== '0')
      return deleted
    },
  }
}

export function createRedisSetStore(client: RedisClient, prefix = ''): SetStore {
  return {
    async add(key, value) {
      await client.sadd(`${prefix}${key}`, value)
    },
    async remove(key, value) {
      const result = await client.srem(`${prefix}${key}`, value)
      return result > 0
    },
    async members(key) {
      return client.smembers(`${prefix}${key}`)
    },
    async isMember(key, value) {
      const result = await client.sismember(`${prefix}${key}`, value)
      return result === 1
    },
    async size(key) {
      return client.scard(`${prefix}${key}`)
    },
    async clear() {
      let deleted = 0
      let cursor = '0'
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100)
        cursor = nextCursor
        if (keys.length > 0) {
          await client.del(...keys)
          deleted += keys.length
        }
      } while (cursor !== '0')
      return deleted
    },
  }
}

export function createDefaultStoreFactory(client?: RedisClient) {
  if (client) {
    return {
      kv: <T>(prefix = '') => createRedisKVStore<T>(client, prefix),
      list: <T>(prefix = '') => createRedisListStore<T>(client, prefix),
      map: <V>(prefix = '') => createRedisMapStore<V>(client, prefix),
      counter: (prefix = '') => createRedisCounterStore(client, prefix),
      set: (prefix = '') => createRedisSetStore(client, prefix),
    }
  }
  return {
    kv: <T>() => createInMemoryKVStore<T>(),
    list: <T>() => createInMemoryListStore<T>(),
    map: <V>() => createInMemoryMapStore<V>(),
    counter: () => createInMemoryCounterStore(),
    set: () => createInMemorySetStore(),
  }
}

function splitStoreKey(key: string): [string, string] {
  const idx = key.indexOf(':')
  if (idx === -1) return ['_default', key]
  return [key.slice(0, idx), key.slice(idx + 1)]
}
