import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createClient, disconnectClient, getDefaultConfig, checkRedisHealth } from '../client'
import { withLock, tryLock, LockAcquisitionError } from '../lock'
import { DistributedQueue, QueueError } from '../queue'
import { RedisRateLimiter } from '../rate-limiter'
import { DistributedMetricsStore } from '../metrics-store'
import { DistributedCache } from '../cache'
import { DistributedSessionStore } from '../session-store'
import { IdempotencyStore } from '../idempotency'
import { configureAllModules, useRedisModuleStores } from '../configure'

let redisUrl: string | undefined
let client: any

beforeAll(async () => {
  redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST
  if (!redisUrl) {
    console.warn('REDIS_URL not set — running tests with in-memory fallback detection')
  }

  try {
    client = createClient({ lazyConnect: true })
    await client.connect()
    await client.ping()
    await client.flushall()
  } catch {
    console.warn('Redis not available — tests will validate module structure only')
    client = null
  }
})

afterAll(async () => {
  if (client) {
    await client.flushall()
    await disconnectClient(client)
  }
})

function skipIfNoRedis() {
  if (!client) return it.skip
  return it
}

describe('Redis Client', () => {
  it('creates default config from env', () => {
    const config = getDefaultConfig()
    expect(config.host).toBeDefined()
    expect(config.port).toBe(6379)
    expect(config.keyPrefix).toContain('finance')
  })

  const runIf = client ? it : it.skip

  runIf('connects and pings', async () => {
    const result = await client.ping()
    expect(result).toBe('PONG')
  })

  runIf('reports health', async () => {
    const health = await checkRedisHealth(client)
    expect(health.ok).toBe(true)
    expect(health.latency).toBeGreaterThanOrEqual(0)
    expect(health.info.version).toBeTruthy()
  })
})

describe('Distributed Lock', () => {
  const runIf = client ? it : it.skip

  runIf('acquires and releases lock', async () => {
    const lock = await tryLock(client, 'test-resource', { ttl: 5000 })
    expect(lock).not.toBeNull()
    expect(lock!.resource).toBe('test-resource')
    expect(lock!.identifier).toBeTruthy()
    expect(lock!.expiresAt).toBeGreaterThan(Date.now())

    const released = await lock!.release()
    expect(released).toBe(true)
  })

  runIf('fails to acquire held lock', async () => {
    const lock1 = await tryLock(client, 'test-resource-2')
    expect(lock1).not.toBeNull()

    const lock2 = await tryLock(client, 'test-resource-2', { retryCount: 0, maxRetries: 0 })
    expect(lock2).toBeNull()

    await lock1!.release()
  })

  runIf('executes function under lock', async () => {
    let executed = false
    await withLock(client, 'test-resource-3', async () => {
      executed = true
      return 'done'
    })
    expect(executed).toBe(true)
  })

  runIf('refreshes lock', async () => {
    const lock = await tryLock(client, 'test-refresh', { ttl: 5000 })
    expect(lock).not.toBeNull()
    const refreshed = await lock!.refresh(10000)
    expect(refreshed).toBe(true)
    await lock!.release()
  })
})

describe('Distributed Queue', () => {
  const runIf = client ? it : it.skip

  runIf('enqueues and dequeues messages', async () => {
    const queue = new DistributedQueue(client, 'test')
    const id = await queue.enqueue('jobs', { task: 'process_payment', amount: 100 })
    expect(id).toBeTruthy()

    const msg = await queue.dequeue('jobs', 1)
    expect(msg).not.toBeNull()
    expect(msg!.data.task).toBe('process_payment')
    expect(msg!.data.amount).toBe(100)
    expect(msg!.id).toBe(id)

    await queue.ack('jobs', msg!)
  })

  runIf('moves to dead letter after max retries', async () => {
    const queue = new DistributedQueue(client, 'test-dlq')
    await queue.enqueue('tasks', { x: 1 }, { maxRetries: 2 })

    const msg1 = await queue.dequeue('tasks', 1)
    expect(msg1).not.toBeNull()
    expect(msg1!.metadata.attempts).toBe(1)
    await queue.nack('tasks', msg1!)

    const msg2 = await queue.dequeue('tasks', 1)
    expect(msg2).not.toBeNull()
    expect(msg2!.metadata.attempts).toBe(2)
    await queue.nack('tasks', msg2!)

    const dlqItems = await queue.peekDeadLetter('tasks')
    expect(dlqItems.length).toBeGreaterThan(0)
    expect(dlqItems[0].data.x).toBe(1)

    await queue.purge('tasks')
  })

  runIf('enqueues batch messages', async () => {
    const queue = new DistributedQueue(client, 'test-batch')
    const ids = await queue.enqueueBatch('items', [{ n: 1 }, { n: 2 }, { n: 3 }])
    expect(ids).toHaveLength(3)

    expect(await queue.length('items')).toBe(3)
    await queue.purge('items')
  })

  runIf('reports queue stats', async () => {
    const queue = new DistributedQueue(client, 'test-stats')
    await queue.enqueue('stats', { x: 1 })

    const stats = await queue.stats('stats')
    expect(stats.queue).toBe('stats')
    expect(stats.length).toBeGreaterThan(0)

    await queue.purge('stats')
  })
})

describe('Redis Rate Limiter', () => {
  const runIf = client ? it : it.skip

  runIf('allows requests within limit', async () => {
    const limiter = new RedisRateLimiter(client)
    const result = await limiter.checkSlidingWindow('test-key', 60000, 10)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBeGreaterThanOrEqual(9)
    expect(result.total).toBeGreaterThanOrEqual(1)
  })

  runIf('blocks requests over limit', async () => {
    const limiter = new RedisRateLimiter(client)

    for (let i = 0; i < 3; i++) {
      await limiter.checkSlidingWindow('test-limit-key', 60000, 3)
    }
    const result = await limiter.checkSlidingWindow('test-limit-key', 60000, 3)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)

    await limiter.reset('test-limit-key')
  })

  runIf('resets rate limit state', async () => {
    const limiter = new RedisRateLimiter(client)
    await limiter.checkSlidingWindow('test-reset', 60000, 5)
    await limiter.reset('test-reset')
    const remaining = await limiter.getRemaining('test-reset', 60000, 5)
    expect(remaining).toBe(5)
  })
})

describe('Distributed Metrics Store', () => {
  const runIf = client ? it : it.skip

  runIf('increments and reads counters', async () => {
    const metrics = new DistributedMetricsStore(client)
    const val = await metrics.incrementCounter('test_counter', 5, { env: 'test' })
    expect(val).toBe(5)

    const read = await metrics.getCounter('test_counter', { env: 'test' })
    expect(read).toBe(5)
  })

  runIf('sets and reads gauges', async () => {
    const metrics = new DistributedMetricsStore(client)
    await metrics.setGauge('test_gauge', 42, { region: 'us' })

    const val = await metrics.getGauge('test_gauge', { region: 'us' })
    expect(val).toBe(42)
  })

  runIf('observes histograms', async () => {
    const metrics = new DistributedMetricsStore(client)
    await metrics.observeHistogram('test_hist', 100, { op: 'query' })
    await metrics.observeHistogram('test_hist', 200, { op: 'query' })

    const hist = await metrics.getHistogram('test_hist', { op: 'query' })
    expect(hist.count).toBe(2)
    expect(hist.sum).toBe(300)
    expect(hist.min).toBe(100)
    expect(hist.max).toBe(200)
  })

  runIf('resets all metrics', async () => {
    const metrics = new DistributedMetricsStore(client)
    await metrics.incrementCounter('reset_counter')
    const deleted = await metrics.resetAll()
    expect(deleted).toBeGreaterThan(0)
  })
})

describe('Distributed Cache', () => {
  const runIf = client ? it : it.skip

  runIf('stores and retrieves values', async () => {
    const cache = new DistributedCache(client, 'test')
    await cache.set('key1', { hello: 'world' })
    const val = await cache.get<any>('key1')
    expect(val).toEqual({ hello: 'world' })
  })

  runIf('returns null for missing keys', async () => {
    const cache = new DistributedCache(client, 'test')
    const val = await cache.get('nonexistent')
    expect(val).toBeNull()
  })

  runIf('implements getOrSet pattern', async () => {
    const cache = new DistributedCache(client, 'test')
    const fetcher = vi.fn().mockResolvedValue('computed')
    const val1 = await cache.getOrSet('compute-key', fetcher)
    expect(val1).toBe('computed')
    expect(fetcher).toHaveBeenCalledTimes(1)
    const val2 = await cache.getOrSet('compute-key', fetcher)
    expect(val2).toBe('computed')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  runIf('deletes values', async () => {
    const cache = new DistributedCache(client, 'test')
    await cache.set('delete-me', 1)
    expect(await cache.exists('delete-me')).toBe(true)
    await cache.del('delete-me')
    expect(await cache.exists('delete-me')).toBe(false)
  })

  runIf('invalidates by tag', async () => {
    const cache = new DistributedCache(client, 'test')
    await cache.set('tagged-item', 'val', { tags: ['group1'] })
    expect(await cache.exists('tagged-item')).toBe(true)
    await cache.invalidateTag('group1')
    expect(await cache.exists('tagged-item')).toBe(false)
  })

  runIf('reports stats', async () => {
    const cache = new DistributedCache(client, 'test-stats')
    await cache.set('stat-key', 1)
    const stats = await cache.getStats()
    expect(stats.keys).toBeGreaterThanOrEqual(1)
    expect(stats.hits).toBeGreaterThanOrEqual(0)
    expect(stats.misses).toBeGreaterThanOrEqual(0)
    expect(stats.memory).toBeTruthy()
    await cache.clear()
  })
})

describe('Distributed Session Store', () => {
  const runIf = client ? it : it.skip

  runIf('creates and retrieves sessions', async () => {
    const store = new DistributedSessionStore(client)
    const session = await store.createSession('user-1', {
      userId: 'user-1',
      role: 'admin',
      tenantId: 'tenant-1',
      ip: '192.168.1.1',
      device: 'chrome',
    })
    expect(session.id).toBeTruthy()
    expect(session.data.userId).toBe('user-1')
    expect(session.data.role).toBe('admin')

    const retrieved = await store.getSession(session.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.data.userId).toBe('user-1')
    await store.destroySession(session.id)
  })

  runIf('destroys all user sessions', async () => {
    const store = new DistributedSessionStore(client)
    await store.createSession('user-bulk', { userId: 'user-bulk', role: 'user' })
    await store.createSession('user-bulk', { userId: 'user-bulk', role: 'user' })
    const destroyed = await store.destroyAllUserSessions('user-bulk')
    expect(destroyed).toBeGreaterThanOrEqual(1)
  })

  runIf('rotates sessions', async () => {
    const store = new DistributedSessionStore(client)
    const session = await store.createSession('rotate-user', {
      userId: 'rotate-user',
      role: 'viewer',
    })
    const rotated = await store.rotateSession(session.id)
    expect(rotated).not.toBeNull()
    expect(rotated!.id).not.toBe(session.id)
    await store.destroyAllUserSessions('rotate-user')
  })

  runIf('returns active session count', async () => {
    const store = new DistributedSessionStore(client)
    await store.createSession('count-user', { userId: 'count-user', role: 'user' })
    const count = await store.getActiveSessionCount('count-user')
    expect(count).toBeGreaterThanOrEqual(1)
    await store.destroyAllUserSessions('count-user')
  })
})

describe('Idempotency Store', () => {
  const runIf = client ? it : it.skip

  runIf('processes idempotent operations', async () => {
    const store = new IdempotencyStore(client)
    const fn = vi.fn().mockResolvedValue('result')
    const result1 = await store.process('idem-key-1', fn)
    expect(result1).toBe('result')
    expect(fn).toHaveBeenCalledTimes(1)

    const result2 = await store.process('idem-key-1', fn)
    expect(result2).toBe('result')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  runIf('checks if key is processed', async () => {
    const store = new IdempotencyStore(client)
    await store.process('idem-check', async () => 'done')
    expect(await store.isProcessed('idem-check')).toBe(true)
    expect(await store.isProcessed('idem-missing')).toBe(false)
    await store.clear('idem-check')
  })
})

describe('Module Configuration', () => {
  const runIf = client ? it : it.skip

  runIf('creates Redis module stores', () => {
    const stores = useRedisModuleStores(client)
    expect(stores.tracer).toBeDefined()
    expect(stores.collector).toBeDefined()
    expect(stores.alertEngine).toBeDefined()
    expect(stores.sessionHardening).toBeDefined()
    expect(stores.abuseDetection).toBeDefined()
    expect(stores.cacheManager).toBeDefined()
    expect(stores.retryOrchestrator).toBeDefined()
    expect(stores.immutableLog).toBeDefined()
    expect(stores.backupOrchestrator).toBeDefined()
    expect(stores.featureFlags).toBeDefined()
    expect(stores.runtimeConfig).toBeDefined()
    expect(stores.tamperDetection).toBeDefined()
    expect(stores.regionManager).toBeDefined()
    expect(stores.workerFailover).toBeDefined()
  })

  runIf('configures all modules with Redis stores', async () => {
    const stores = useRedisModuleStores(client)
    expect(() => configureAllModules(stores)).not.toThrow()
  })
})

describe('Lock - LockAcquisitionError', () => {
  it('has correct name and message', () => {
    const err = new LockAcquisitionError('test-resource', 5)
    expect(err.name).toBe('LockAcquisitionError')
    expect(err.message).toContain('test-resource')
    expect(err.message).toContain('5')
  })
})

describe('QueueError', () => {
  it('has correct properties', () => {
    const err = new QueueError('test error', 'TEST_CODE')
    expect(err.name).toBe('QueueError')
    expect(err.message).toBe('test error')
    expect(err.code).toBe('TEST_CODE')
  })
})
