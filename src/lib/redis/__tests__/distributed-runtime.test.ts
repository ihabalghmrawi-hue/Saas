import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TracePropagator, TRACEPARENT_HEADER, TRACESTATE_HEADER, BAGGAGE_HEADER } from '../trace-propagator'
import { MetricsAggregator } from '../metrics-aggregator'
import { DistributedScheduler } from '../scheduler'
import { CacheInvalidationBus } from '../cache-invalidation'

function createMockRedis() {
  const store = new Map<string, string>()
  const listStore = new Map<string, string[]>()
  const setStore = new Map<string, Set<string>>()
  const sortedStore = new Map<string, Array<{ score: number; member: string }>>()

  const mock: any = {
    store, listStore, setStore, sortedStore,
    get: vi.fn(async (key: string) => store.get(key) || null),
    set: vi.fn(async (key: string, value: string, ...args: any[]) => {
      store.set(key, value)
      if (args.includes('PX') || args.includes('px')) {
        const ttlIdx = args.indexOf('PX') !== -1 ? args.indexOf('PX') : args.indexOf('px')
        if (ttlIdx !== -1) setTimeout(() => store.delete(key), parseInt(args[ttlIdx + 1], 10))
      }
      return 'OK'
    }),
    setex: vi.fn(async (key: string, ttl: number, value: string) => {
      store.set(key, value)
      return 'OK'
    }),
    del: vi.fn(async (...keys: string[]) => {
      let count = 0
      for (const k of keys) { if (store.delete(k)) count++ }
      return count
    }),
    exists: vi.fn(async (key: string) => store.has(key) ? 1 : 0),
    expire: vi.fn(async () => 1),
    pexpire: vi.fn(async () => 1),
    pttl: vi.fn(async (key: string) => store.has(key) ? 10000 : -2),
    incr: vi.fn(async (key: string) => {
      const v = (parseInt(store.get(key) || '0', 10)) + 1
      store.set(key, String(v))
      return v
    }),
    incrby: vi.fn(async (key: string, by: number) => {
      const v = (parseInt(store.get(key) || '0', 10)) + by
      store.set(key, String(v))
      return v
    }),
    hget: vi.fn(async (key: string, field: string) => {
      const raw = store.get(key)
      if (!raw) return null
      try {
        const obj = JSON.parse(raw)
        return obj[field] !== undefined ? JSON.stringify(obj[field]) : null
      } catch { return null }
    }),
    hset: vi.fn(async (key: string, field: string, value: string) => {
      let obj: any = {}
      try { const r = store.get(key); if (r) obj = JSON.parse(r) } catch {}
      obj[field] = JSON.parse(value)
      store.set(key, JSON.stringify(obj))
      return 1
    }),
    hgetall: vi.fn(async (key: string) => {
      const raw = store.get(key)
      if (!raw) return {}
      try { return JSON.parse(raw) } catch { return {} }
    }),
    hdel: vi.fn(async (key: string, field: string) => {
      const raw = store.get(key)
      if (!raw) return 0
      try {
        const obj = JSON.parse(raw)
        delete obj[field]
        if (Object.keys(obj).length === 0) store.delete(key)
        else store.set(key, JSON.stringify(obj))
        return 1
      } catch { return 0 }
    }),
    hexists: vi.fn(async (key: string, field: string) => {
      const raw = store.get(key)
      if (!raw) return 0
      try {
        const obj = JSON.parse(raw)
        return obj[field] !== undefined ? 1 : 0
      } catch { return 0 }
    }),
    hlen: vi.fn(async (key: string) => {
      const raw = store.get(key)
      if (!raw) return 0
      try { return Object.keys(JSON.parse(raw)).length } catch { return 0 }
    }),
    hkeys: vi.fn(async (key: string) => {
      const raw = store.get(key)
      if (!raw) return []
      try { return Object.keys(JSON.parse(raw)) } catch { return [] }
    }),
    lpush: vi.fn(async (key: string, value: string) => {
      if (!listStore.has(key)) listStore.set(key, [])
      listStore.get(key)!.unshift(value)
      return listStore.get(key)!.length
    }),
    rpop: vi.fn(async (key: string) => {
      const list = listStore.get(key)
      if (!list || list.length === 0) return null
      return list.pop() || null
    }),
    lpop: vi.fn(async (key: string) => {
      const list = listStore.get(key)
      if (!list || list.length === 0) return null
      return list.shift() || null
    }),
    lrange: vi.fn(async (key: string, start: number, stop: number) => {
      const list = listStore.get(key) || []
      const end = stop < 0 ? list.length + stop : stop
      return list.slice(start, end + 1)
    }),
    llen: vi.fn(async (key: string) => (listStore.get(key) || []).length),
    lrem: vi.fn(async (key: string, count: number, value: string) => {
      const list = listStore.get(key) || []
      const before = list.length
      const filtered = list.filter(v => v !== value)
      listStore.set(key, filtered)
      return before - filtered.length
    }),
    ltrim: vi.fn(async (key: string, start: number, stop: number) => {
      const list = listStore.get(key) || []
      listStore.set(key, list.slice(start, stop + 1))
      return 'OK'
    }),
    sadd: vi.fn(async (key: string, value: string) => {
      if (!setStore.has(key)) setStore.set(key, new Set())
      setStore.get(key)!.add(value)
      return 1
    }),
    srem: vi.fn(async (key: string, value: string) => {
      return setStore.get(key)?.delete(value) ? 1 : 0
    }),
    smembers: vi.fn(async (key: string) => [...(setStore.get(key) || [])]),
    sismember: vi.fn(async (key: string, value: string) => setStore.get(key)?.has(value) ? 1 : 0),
    scard: vi.fn(async (key: string) => setStore.get(key)?.size || 0),
    zadd: vi.fn(async (key: string, score: number, member: string) => {
      if (!sortedStore.has(key)) sortedStore.set(key, [])
      const arr = sortedStore.get(key)!
      const existing = arr.findIndex(e => e.member === member)
      if (existing !== -1) arr[existing].score = score
      else arr.push({ score, member })
      return 1
    }),
    zrem: vi.fn(async (key: string, member: string) => {
      if (!sortedStore.has(key)) return 0
      const arr = sortedStore.get(key)!
      const idx = arr.findIndex(e => e.member === member)
      if (idx !== -1) { arr.splice(idx, 1); return 1 }
      return 0
    }),
    zrangebyscore: vi.fn(async (key: string, min: number, max: number) => {
      const arr = sortedStore.get(key)
      if (!arr) return []
      return arr
        .filter(e => e.score >= min && e.score <= max)
        .sort((a, b) => a.score - b.score)
        .map(e => e.member)
    }),
    zcard: vi.fn(async (key: string) => (sortedStore.get(key) || []).length),
    zremrangebyscore: vi.fn(async (key: string, min: number, max: number) => {
      const arr = sortedStore.get(key)
      if (!arr) return 0
      const before = arr.length
      const filtered = arr.filter(e => e.score < min || e.score > max)
      sortedStore.set(key, filtered)
      return before - filtered.length
    }),
    scan: vi.fn(async (cursor: string, ...args: any[]) => {
      const matchIdx = args.indexOf('MATCH')
      const pattern = matchIdx !== -1 ? args[matchIdx + 1] : '*'
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
      const keys = [...store.keys()].filter(k => regex.test(k))
      return ['0', keys]
    }),
    keys: vi.fn(async (pattern: string) => []),
    subscribe: vi.fn(async () => {}),
    unsubscribe: vi.fn(async () => {}),
    publish: vi.fn(async (channel: string, message: string) => 1),
    psubscribe: vi.fn(async () => {}),
    on: vi.fn(),
    connect: vi.fn(async () => {}),
    quit: vi.fn(async () => {}),
    duplicate: vi.fn(() => null),
    pipeline: vi.fn(() => {
      const ops: Array<{ fn: string; args: any[] }> = []
      const builder: any = {
        incr: vi.fn((key: string) => { ops.push({ fn: 'incr', args: [key] }); return builder }),
        del: vi.fn((...keys: string[]) => { ops.push({ fn: 'del', args: keys }); return builder }),
        hset: vi.fn((key: string, field: string, value: string) => { ops.push({ fn: 'hset', args: [key, field, value] }); return builder }),
        zadd: vi.fn((key: string, score: number, member: string) => { ops.push({ fn: 'zadd', args: [key, score, member] }); return builder }),
        zremrangebyscore: vi.fn((key: string, min: number, max: number) => { ops.push({ fn: 'zremrangebyscore', args: [key, min, max] }); return builder }),
        zcard: vi.fn((key: string) => { ops.push({ fn: 'zcard', args: [key] }); return builder }),
        sadd: vi.fn((key: string, value: string) => { ops.push({ fn: 'sadd', args: [key, value] }); return builder }),
        setex: vi.fn((key: string, ttl: number, value: string) => { ops.push({ fn: 'setex', args: [key, ttl, value] }); return builder }),
        exec: vi.fn(async () => {
          const results: Array<[null, any]> = []
          for (const op of ops) {
            try {
              const result = await (mock as any)[op.fn](...op.args)
              results.push([null, result ?? 1])
            } catch {
              results.push([null, 1])
            }
          }
          return results
        }),
      }
      return builder
    }),
  }

  return mock
}

describe('TracePropagator', () => {
  const mockRedis = createMockRedis()

  it('injects W3C traceparent headers', () => {
    const propagator = new TracePropagator(mockRedis as any, { serviceName: 'test-svc' })
    const headers = propagator.inject({
      traceId: 'abc123def456',
      parentSpanId: 'span1234567890',
      serviceName: 'test-svc',
      operationName: 'test-op',
    })

    expect(headers[TRACEPARENT_HEADER]).toMatch(/^00-abc123def456-span1234567890-01$/)
  })

  it('extracts trace context from headers', () => {
    const propagator = new TracePropagator(mockRedis as any, { serviceName: 'test-svc' })
    const context = propagator.extract({
      [TRACEPARENT_HEADER]: '00-abc123def456-span1234567890-01',
      [TRACESTATE_HEADER]: 'service=test-svc,op=test-op',
    })

    expect(context).not.toBeNull()
    expect(context!.traceId).toBe('abc123def456')
    expect(context!.parentSpanId).toBe('span1234567890')
    expect(context!.serviceName).toBe('test-svc')
    expect(context!.operationName).toBe('test-op')
  })

  it('returns null for missing traceparent', () => {
    const propagator = new TracePropagator(mockRedis as any)
    const context = propagator.extract({})
    expect(context).toBeNull()
  })

  it('injects and extracts baggage', () => {
    const propagator = new TracePropagator(mockRedis as any)
    const headers = propagator.inject({
      traceId: 'trace-1',
      parentSpanId: 'parent-1',
      serviceName: 'svc',
      operationName: 'op',
      baggage: { tenantId: 'tenant-42', userId: 'user-7' },
    })

    expect(headers[BAGGAGE_HEADER]).toContain('tenantId=tenant-42')
    expect(headers[BAGGAGE_HEADER]).toContain('userId=user-7')
  })

  it('creates continuation headers for next service', () => {
    const propagator = new TracePropagator(mockRedis as any, { serviceName: 'origin' })
    const context = propagator.createNewContext('initial-op')

    const continued = propagator.continuationHeaders(context, 'next-svc', 'next-op')
    expect(continued[TRACEPARENT_HEADER]).toBeTruthy()

    const extracted = propagator.extract(continued)
    expect(extracted!.serviceName).toBe('next-svc')
    expect(extracted!.operationName).toBe('next-op')
    expect(extracted!.traceId).toBe(context.traceId)
  })

  it('injects trace context into queue messages', () => {
    const propagator = new TracePropagator(mockRedis as any)
    const context = propagator.createNewContext('queue-send')
    const message = propagator.injectIntoMessage(context, { type: 'test', data: 'hello' })

    expect(message._traceContext).toBeDefined()
    expect(message._traceContext.traceId).toBe(context.traceId)
    expect(message.data).toBe('hello')
  })

  it('extracts trace context from queue messages', () => {
    const propagator = new TracePropagator(mockRedis as any)
    const message = {
      type: 'test',
      _traceContext: {
        traceId: 'msg-trace-1',
        parentSpanId: 'msg-span-1',
        serviceName: 'producer',
        operationName: 'produce',
      },
    }
    const context = propagator.extractFromMessage(message)
    expect(context).not.toBeNull()
    expect(context!.traceId).toBe('msg-trace-1')
    expect(context!.serviceName).toBe('producer')
  })

  it('persists and retrieves trace context', async () => {
    const propagator = new TracePropagator(mockRedis as any)
    await propagator.persistTraceContext({
      traceId: 'persist-trace-1',
      parentSpanId: 'persist-span-1',
      serviceName: 'svc',
      operationName: 'op',
    })

    const retrieved = await propagator.getTraceContext('persist-trace-1')
    expect(retrieved).not.toBeNull()
    expect(retrieved!.traceId).toBe('persist-trace-1')
  })
})

describe('MetricsAggregator', () => {
  const mockRedis = createMockRedis()

  beforeEach(() => {
    mockRedis.store.clear()
    mockRedis.listStore.clear()
    mockRedis.setStore.clear()
    mockRedis.sortedStore.clear()
  })

  it('records and queries metrics', async () => {
    const aggregator = new MetricsAggregator(mockRedis as any, {
      windows: [{ windowMs: 60_000, bucketCount: 60, bucketMs: 1_000 }],
    })

    await aggregator.record('api.requests', 1, { method: 'GET' })
    await aggregator.record('api.requests', 2, { method: 'GET' })
    await aggregator.record('api.requests', 3, { method: 'GET' })

    const result = await aggregator.query('api.requests', { labels: { method: 'GET' } })
    expect(result).not.toBeNull()
    expect(result!.count).toBe(3)
    expect(result!.sum).toBe(6)
    expect(result!.avg).toBe(2)
  })

  it('records and retrieves counter values', async () => {
    const aggregator = new MetricsAggregator(mockRedis as any)

    for (let i = 0; i < 5; i++) {
      await aggregator.record('payments.processed', 100)
    }

    const counter = await aggregator.getCounter('payments.processed')
    expect(counter).toBe(5)
  })

  it('queries tenant-level metrics', async () => {
    const aggregator = new MetricsAggregator(mockRedis as any, {
      windows: [{ windowMs: 60_000, bucketCount: 60, bucketMs: 1_000 }],
    })

    await aggregator.record('api.requests', 10, {}, 'tenant-1')
    await aggregator.record('api.requests', 20, {}, 'tenant-1')

    const tenantMetric = await aggregator.getTenantMetrics('api.requests', 'tenant-1')
    expect(tenantMetric).not.toBeNull()
    expect(tenantMetric!.count).toBe(2)
    expect(tenantMetric!.sum).toBe(30)
  })

  it('returns null for unknown metric', async () => {
    const aggregator = new MetricsAggregator(mockRedis as any)
    const result = await aggregator.query('nonexistent')
    expect(result).toBeNull()
  })

  it('lists metric names', async () => {
    const aggregator = new MetricsAggregator(mockRedis as any)

    await aggregator.record('metric.a', 1)
    await aggregator.record('metric.b', 2)
    await aggregator.record('metric.c', 3)

    const names = await aggregator.listMetricNames()
    expect(names).toContain('metric.a')
    expect(names).toContain('metric.b')
    expect(names).toContain('metric.c')
  })

  it('calculates percentiles correctly', async () => {
    const aggregator = new MetricsAggregator(mockRedis as any, {
      windows: [{ windowMs: 60_000, bucketCount: 60, bucketMs: 1_000 }],
    })

    for (let i = 1; i <= 100; i++) {
      await aggregator.record('latency', i)
    }

    const result = await aggregator.query('latency')
    expect(result).not.toBeNull()
    expect(result!.p50).toBeGreaterThanOrEqual(49)
    expect(result!.p50).toBeLessThanOrEqual(51)
    expect(result!.p95).toBeGreaterThanOrEqual(94)
    expect(result!.p99).toBeGreaterThanOrEqual(98)
  })
})

describe('DistributedScheduler', () => {
  it('registers job registration interface', () => {
    const instance = new DistributedScheduler({} as any)
    expect(typeof instance.registerJob).toBe('function')
    expect(typeof instance.unregisterJob).toBe('function')
    expect(typeof instance.getJob).toBe('function')
    expect(typeof instance.listJobs).toBe('function')
    expect(typeof instance.start).toBe('function')
    expect(typeof instance.stop).toBe('function')
    expect(typeof instance.pauseJob).toBe('function')
    expect(typeof instance.resumeJob).toBe('function')
    expect(typeof instance.scheduleJob).toBe('function')
    expect(typeof instance.recoverOrphanedJobs).toBe('function')
    expect(typeof instance.isCurrentLeader).toBe('function')
    expect(typeof instance.getWorkerId).toBe('function')
  })
})

describe('CacheInvalidationBus', () => {
  it('registers cache invalidation interface', () => {
    const instance = new CacheInvalidationBus({} as any)
    expect(typeof instance.invalidate).toBe('function')
    expect(typeof instance.invalidateByTag).toBe('function')
    expect(typeof instance.invalidateByPattern).toBe('function')
    expect(typeof instance.clearAll).toBe('function')
    expect(typeof instance.subscribe).toBe('function')
    expect(typeof instance.unsubscribe).toBe('function')
    expect(typeof instance.on).toBe('function')
    expect(typeof instance.off).toBe('function')
    expect(typeof instance.getGeneration).toBe('function')
    expect(typeof instance.isStale).toBe('function')
    expect(typeof instance.attachTag).toBe('function')
    expect(typeof instance.getKeysByTag).toBe('function')
    expect(typeof instance.removeTag).toBe('function')
  })
})
