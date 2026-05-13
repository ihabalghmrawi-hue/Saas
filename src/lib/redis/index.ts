export {
  createClient,
  getDefaultClient,
  setDefaultClient,
  connectClient,
  disconnectClient,
  checkRedisHealth,
  flushDefaultClient,
  getDefaultConfig,
} from './client'

export type { RedisConfig, RedisHealth, RedisClient } from './client'

export { withLock, tryLock, LockAcquisitionError } from './lock'
export type { Lock, LockOptions } from './lock'

export { DistributedQueue, QueueError } from './queue'
export type { QueueMessage, QueueOptions, QueueStats } from './queue'

export { EventBus } from './pubsub'
export type { EventHandler } from './pubsub'

export { RedisRateLimiter } from './rate-limiter'
export type { RateLimitWindow, RateLimitResult } from './rate-limiter'

export { DistributedMetricsStore } from './metrics-store'
export type { CounterRecord, GaugeRecord, HistogramRecord } from './metrics-store'

export { DistributedCache } from './cache'
export type { CacheOptions, CacheStats } from './cache'

export { DistributedSessionStore } from './session-store'
export type { SessionData, SessionInfo } from './session-store'

export { IdempotencyStore, IdempotencyError } from './idempotency'
export type { IdempotencyRecord } from './idempotency'

export { WorkerCoordinator, WorkerStatus } from './worker-coordinator'
export type { WorkerRegistration, LeaderInfo, ClusterStats } from './worker-coordinator'

export {
  createInMemoryKVStore,
  createInMemoryListStore,
  createInMemoryMapStore,
  createInMemoryCounterStore,
  createInMemorySetStore,
  createRedisKVStore,
  createRedisListStore,
  createRedisMapStore,
  createRedisCounterStore,
  createRedisSetStore,
  createDefaultStoreFactory,
} from './stores'

export type {
  KVStore,
  ListStore,
  MapStore,
  CounterStore,
  SetStore,
} from './stores'

export { DistributedScheduler } from './scheduler'
export type { ScheduledJob, JobExecution } from './scheduler'

export { CacheInvalidationBus } from './cache-invalidation'
export type { CacheInvalidationEvent } from './cache-invalidation'

export { TracePropagator } from './trace-propagator'
export type { TraceContext } from './trace-propagator'
export { TRACEPARENT_HEADER, TRACESTATE_HEADER, BAGGAGE_HEADER } from './trace-propagator'

export { MetricsAggregator } from './metrics-aggregator'
export type { AggregatedMetric, RollingWindow } from './metrics-aggregator'
