import type { RedisClient } from './client'
import { configureTracerStores } from '@/lib/observability/tracer'
import { configureCollectorStores } from '@/lib/metrics/collector'
import { configureAlertStores } from '@/lib/alerting/alert-engine'
import { configureSessionStores } from '@/lib/security/session-hardening'
import { configureAbuseStores } from '@/lib/security/abuse-detection'
import { configureTamperStores } from '@/lib/security/tamper-detection'
import { configureCacheStores } from '@/lib/performance/cache-manager'
import { configureRetryStores } from '@/lib/ha/retry-orchestrator'
import { configureFailoverStores as configureWorkerFailoverStores } from '@/lib/ha/worker-failover'
import { configureImmutableLogStores } from '@/lib/compliance/immutable-log'
import { configureBackupStores } from '@/lib/backup/backup-orchestrator'
import { configureFlagStores } from '@/lib/config/feature-flags'
import { configureConfigStores } from '@/lib/config/runtime-config'
import { configureRegionStores } from '@/lib/multi-region/region-manager'
import { configureOperatorStores } from '@/lib/orchestration/operator-runtime'
import { configureTopologyStores } from '@/lib/orchestration/topology-engine'
import { configureMCRStores } from '@/lib/orchestration/multi-region-coordinator'
import { configureEventReplicatorStores } from '@/lib/orchestration/event-replicator'
import { configureAutoscalerStores } from '@/lib/orchestration/autoscaler'
import { configureFailoverStores } from '@/lib/orchestration/failover-orchestrator'
import { configureGovernanceStores } from '@/lib/orchestration/runtime-governance'
import { configureInsightsStores } from '@/lib/orchestration/operational-insights'
import { configureBenchmarkStores } from '@/lib/orchestration/benchmark-suite'
import { configureResilienceStores } from '@/lib/orchestration/resilience-validator'

export interface ModuleStores {
  tracer?: {
    spans?: Map<string, any>
  }
  collector?: {
    metrics?: Map<string, any[]>
  }
  alertEngine?: {
    rules?: Map<string, any>
    activeAlerts?: Map<string, any>
    handlers?: Map<string, any[]>
  }
  sessionHardening?: {
    activeSessions?: Map<string, any>
    loginHistory?: Map<string, any[]>
    anomalyLog?: any[]
  }
  abuseDetection?: {
    rateLimitStore?: Map<string, any>
    abuseEvents?: any[]
    blockedIPs?: Map<string, number>
    patternStore?: Map<string, any>
  }
  tamperDetection?: {
    integrityChain?: Map<string, any[]>
    tamperEvents?: any[]
  }
  cacheManager?: {
    stores?: Map<string, any>
    configs?: Map<string, any>
  }
  retryOrchestrator?: {
    retryStates?: Map<string, any>
  }
  workerFailover?: {
    instances?: Map<string, any>
    failoverHistory?: any[]
  }
  immutableLog?: {
    entries?: any[]
    sequence?: number
    sequenceCounter?: { increment(): Promise<number>; get(): Promise<number> }
  }
  backupOrchestrator?: {
    jobs?: Map<string, any>
  }
  featureFlags?: {
    flags?: Map<string, any>
    tenantOverrides?: Map<string, Map<string, boolean>>
    environmentOverrides?: Map<string, Map<string, boolean>>
  }
  runtimeConfig?: {
    definitions?: Map<string, any>
    entries?: Map<string, any>
    changeHandlers?: Map<string, any[]>
  }
  regionManager?: {
    regions?: Map<string, any>
    replicas?: Map<string, any>
    tenantAssignments?: Map<string, any>
  }
  operatorRuntime?: {
    resources?: Map<string, any>
    controllers?: Map<string, any>
    reconciliationHistory?: Map<string, any[]>
  }
  topologyEngine?: {
    clusterNodes?: Map<string, any>
    workerTopologies?: Map<string, any>
    queuePartitions?: Map<string, any>
    regionTopologies?: Map<string, any>
    schedulerTopologies?: Map<string, any>
    tenantPlacements?: Map<string, any>
  }
  multiRegionCoordinator?: {
    regionMetadatas?: Map<string, any>
    replicationCoordinators?: Map<string, any>
    replicationLags?: Map<string, any>
    regionRoutes?: Map<string, Map<string, any>>
    globalEventSequence?: Map<string, number>
  }
  eventReplicator?: {
    eventStreams?: Map<string, any>
    replicatedEvents?: Map<string, any>
    replayRequests?: Map<string, any>
    dedupCache?: Map<string, number>
    subscriptionRegistry?: Map<string, Set<string>>
  }
  autoscaler?: {
    autoscalePolicies?: Map<string, any>
    autoscaleDecisions?: Map<string, any[]>
    loadMetrics?: Map<string, any[]>
    scalingEvents?: Map<string, any>
    lastScaleTimes?: Map<string, number>
  }
  failoverOrchestrator?: {
    failoverPlans?: Map<string, any>
    recoveryActions?: Map<string, any>
    cacheRebuildPlans?: Map<string, any>
    failoverHistory?: Map<string, any[]>
  }
  runtimeGovernance?: {
    runtimePolicies?: Map<string, any>
    tenantQuotas?: Map<string, any>
    regionalUsagePolicies?: Map<string, any>
    workerResourceGovernances?: Map<string, any>
    queueSaturationProtections?: Map<string, any>
    overloadProtections?: Map<string, any>
    policyEvaluationLog?: Map<string, any[]>
  }
  operationalInsights?: {
    clusterHealthCache?: Map<string, any>
    replicationDashboard?: Map<string, any>
    failoverAnalytics?: Map<string, any[]>
    autoscalingInsights?: Map<string, any>
    runtimeAnomalies?: Map<string, any>
  }
  benchmarkSuite?: {
    benchmarkResults?: Map<string, any[]>
    benchmarkRuns?: Map<string, any>
  }
  resilienceValidator?: {
    resilienceTests?: Map<string, any>
    validationResults?: Map<string, any[]>
  }
}

export function configureAllModules(stores: ModuleStores): void {
  if (stores.tracer) configureTracerStores(stores.tracer as any)
  if (stores.collector) configureCollectorStores(stores.collector as any)
  if (stores.alertEngine) configureAlertStores(stores.alertEngine as any)
  if (stores.sessionHardening) configureSessionStores(stores.sessionHardening as any)
  if (stores.abuseDetection) configureAbuseStores(stores.abuseDetection as any)
  if (stores.tamperDetection) configureTamperStores(stores.tamperDetection as any)
  if (stores.cacheManager) configureCacheStores(stores.cacheManager as any)
  if (stores.retryOrchestrator) configureRetryStores(stores.retryOrchestrator as any)
  if (stores.workerFailover) configureWorkerFailoverStores(stores.workerFailover as any)
  if (stores.immutableLog) configureImmutableLogStores(stores.immutableLog as any)
  if (stores.backupOrchestrator) configureBackupStores(stores.backupOrchestrator as any)
  if (stores.featureFlags) configureFlagStores(stores.featureFlags as any)
  if (stores.runtimeConfig) configureConfigStores(stores.runtimeConfig as any)
  if (stores.regionManager) configureRegionStores(stores.regionManager as any)
  if (stores.operatorRuntime) configureOperatorStores(stores.operatorRuntime as any)
  if (stores.topologyEngine) configureTopologyStores(stores.topologyEngine as any)
  if (stores.multiRegionCoordinator) configureMCRStores(stores.multiRegionCoordinator as any)
  if (stores.eventReplicator) configureEventReplicatorStores(stores.eventReplicator as any)
  if (stores.autoscaler) configureAutoscalerStores(stores.autoscaler as any)
  if (stores.failoverOrchestrator) configureFailoverStores(stores.failoverOrchestrator as any)
  if (stores.runtimeGovernance) configureGovernanceStores(stores.runtimeGovernance as any)
  if (stores.operationalInsights) configureInsightsStores(stores.operationalInsights as any)
  if (stores.benchmarkSuite) configureBenchmarkStores(stores.benchmarkSuite as any)
  if (stores.resilienceValidator) configureResilienceStores(stores.resilienceValidator as any)
}

export function useRedisModuleStores(
  client: RedisClient,
  prefix = 'finance:dist:'
): ModuleStores {
  const createMapStore = <V>(ns: string) => {
    const redisKey = `${prefix}${ns}`
    return new Proxy({} as Map<string, V>, {
      get(_target, prop: string | symbol) {
        if (prop === 'get') return async (key: string) => {
          const data = await client.hget(redisKey, key)
          return data ? JSON.parse(data) : undefined
        }
        if (prop === 'set') return async (key: string, value: V) => {
          await client.hset(redisKey, key, JSON.stringify(value))
        }
        if (prop === 'delete') return async (key: string) => {
          const result = await client.hdel(redisKey, key)
          return result > 0
        }
        if (prop === 'clear') return async () => { await client.del(redisKey) }
        if (prop === 'has') return async (key: string) => {
          return client.hexists(redisKey, key)
        }
        if (prop === 'size') return {
          valueOf: async () => { return client.hlen(redisKey) }
        }
        if (prop === 'values') return async () => {
          const raw = await client.hgetall(redisKey)
          return Object.values(raw).map((v) => JSON.parse(v))
        }
        if (prop === 'entries') return async () => {
          const raw = await client.hgetall(redisKey)
          return Object.entries(raw).map(([k, v]) => [k, JSON.parse(v)])
        }
        if (prop === Symbol.iterator) return function* () { return; }
        return undefined
      },
    }) as unknown as Map<string, V>
  }

  const createListStore = <V>(ns: string) => {
    const redisKey = `${prefix}${ns}`
    return new Proxy([] as V[], {
      get(_target: any, prop: string | symbol) {
        if (prop === 'push') return async (...items: V[]) => {
          for (const item of items) {
            await client.lpush(redisKey, JSON.stringify(item))
          }
          return items.length
        }
        if (prop === 'pop') return async () => {
          const data = await client.lpop(redisKey)
          return data ? JSON.parse(data) : undefined
        }
        if (prop === 'length') return { valueOf: async () => client.llen(redisKey) }
        if (prop === 'filter') return async (fn: Function) => {
          const items = await client.lrange(redisKey, 0, -1)
          return items.map((i) => JSON.parse(i)).filter(fn)
        }
        if (prop === 'slice') return async (start?: number, end?: number) => {
          const items = await client.lrange(redisKey, start ?? 0, end ?? -1)
          return items.map((i) => JSON.parse(i))
        }
        if (prop === 'shift') return async () => {
          const data = await client.rpop(redisKey)
          return data ? JSON.parse(data) : undefined
        }
        if (prop === 'splice') {
          return async (start: number, deleteCount: number, ...items: V[]) => {
            const list = await client.lrange(redisKey, 0, -1)
            const parsed = list.map((i) => JSON.parse(i))
            const deleted = parsed.splice(start, deleteCount, ...items)
            await client.del(redisKey)
            for (const item of parsed.reverse()) {
              await client.lpush(redisKey, JSON.stringify(item))
            }
            return deleted
          }
        }
        if (prop === Symbol.iterator) return function* () { return; }
        return undefined
      },
    }) as unknown as V[]
  }

  const createNestedMapStore = (ns: string) => {
    const redisKey = `${prefix}${ns}`
    return new Proxy({} as Map<string, Map<string, boolean>>, {
      get(_target, prop: string | symbol) {
        if (prop === 'get') return async (key: string) => {
          const raw = await client.hgetall(`${redisKey}:${key}`)
          if (!raw || Object.keys(raw).length === 0) return undefined
          const inner = new Map<string, boolean>()
          for (const [k, v] of Object.entries(raw)) inner.set(k, v === 'true')
          return inner
        }
        if (prop === 'set') return async (key: string, innerMap: Map<string, boolean>) => {
          const pipeline = client.pipeline()
          for (const [k, v] of innerMap) pipeline.hset(`${redisKey}:${key}`, k, String(v))
          await pipeline.exec()
        }
        if (prop === 'has') return async (key: string) => {
          const exists = await client.exists(`${redisKey}:${key}`)
          return exists > 0
        }
        if (prop === 'delete') return async (key: string) => {
          const result = await client.del(`${redisKey}:${key}`)
          return result > 0
        }
        if (prop === 'clear') return async () => {
          let cursor = '0'
          do {
            const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `${redisKey}:*`, 'COUNT', 100)
            cursor = nextCursor
            if (keys.length > 0) await client.del(...keys)
          } while (cursor !== '0')
        }
        if (prop === 'keys') return async () => {
          const keys: string[] = []
          let cursor = '0'
          do {
            const [nextCursor, ks] = await client.scan(cursor, 'MATCH', `${redisKey}:*`, 'COUNT', 100)
            cursor = nextCursor
            for (const k of ks) keys.push(k.slice(redisKey.length + 1))
          } while (cursor !== '0')
          return keys
        }
        if (prop === 'entries') return async () => {
          const result: [string, Map<string, boolean>][] = []
          let cursor = '0'
          do {
            const [nextCursor, ks] = await client.scan(cursor, 'MATCH', `${redisKey}:*`, 'COUNT', 100)
            cursor = nextCursor
            for (const k of ks) {
              const innerKey = k.slice(redisKey.length + 1)
              const raw = await client.hgetall(k)
              const inner = new Map<string, boolean>()
              for (const [ik, iv] of Object.entries(raw)) inner.set(ik, iv === 'true')
              result.push([innerKey, inner])
            }
          } while (cursor !== '0')
          return result
        }
        if (prop === 'size') return { valueOf: async (): Promise<number> => {
          let count = 0
          let cursor = '0'
          do {
            const [nextCursor] = await client.scan(cursor, 'MATCH', `${redisKey}:*`, 'COUNT', 100)
            cursor = nextCursor
            count += 100
          } while (cursor !== '0')
          return count
        }}
        if (prop === 'values') return async () => {
          const vals: Map<string, boolean>[] = []
          let cursor = '0'
          do {
            const [nextCursor, ks] = await client.scan(cursor, 'MATCH', `${redisKey}:*`, 'COUNT', 100)
            cursor = nextCursor
            for (const k of ks) {
              const raw = await client.hgetall(k)
              const inner = new Map<string, boolean>()
              for (const [ik, iv] of Object.entries(raw)) inner.set(ik, iv === 'true')
              vals.push(inner)
            }
          } while (cursor !== '0')
          return vals
        }
        if (prop === Symbol.iterator) return function* () { return }
        return undefined
      },
    }) as unknown as Map<string, Map<string, boolean>>
  }

  return {
    tracer: {
      spans: createMapStore<any>('tracer:spans'),
    },
    collector: {
      metrics: createMapStore<any[]>('collector:metrics'),
    },
    alertEngine: {
      rules: createMapStore<any>('alerts:rules'),
      activeAlerts: createMapStore<any>('alerts:active'),
      handlers: createMapStore<any[]>('alerts:handlers'),
    },
    sessionHardening: {
      activeSessions: createMapStore<any>('sessions'),
      loginHistory: createMapStore<any[]>('sessions:history'),
      anomalyLog: createListStore<any>('sessions:anomalies'),
    },
    abuseDetection: {
      rateLimitStore: createMapStore<any>('abuse:ratelimit'),
      abuseEvents: createListStore<any>('abuse:events'),
      blockedIPs: createMapStore<number>('abuse:blocked'),
      patternStore: createMapStore<any>('abuse:patterns'),
    },
    tamperDetection: {
      integrityChain: createMapStore<any[]>('tamper:chain'),
      tamperEvents: createListStore<any>('tamper:events'),
    },
    cacheManager: {
      stores: createMapStore<any>('cache:stores'),
      configs: createMapStore<any>('cache:configs'),
    },
    retryOrchestrator: {
      retryStates: createMapStore<any>('retry'),
    },
    workerFailover: {
      instances: createMapStore<any>('workers'),
      failoverHistory: createListStore<any>('workers:failover'),
    },
    immutableLog: {
      entries: createListStore<any>('immutable'),
      sequence: 0,
      sequenceCounter: {
        async increment() { return client.incr(`${prefix}immutable:seq`) },
        async get() {
          const v = await client.get(`${prefix}immutable:seq`)
          return v ? parseInt(v, 10) : 0
        },
      },
    },
    backupOrchestrator: {
      jobs: createMapStore<any>('backup'),
    },
    featureFlags: {
      flags: createMapStore<any>('flags'),
      tenantOverrides: createNestedMapStore('flag-overrides:tenant'),
      environmentOverrides: createNestedMapStore('flag-overrides:env'),
    },
    runtimeConfig: {
      definitions: createMapStore<any>('config:defs'),
      entries: createMapStore<any>('config:entries'),
      changeHandlers: createMapStore<any[]>('config:handlers'),
    },
    regionManager: {
      regions: createMapStore<any>('region:regions'),
      replicas: createMapStore<any>('region:replicas'),
      tenantAssignments: createMapStore<any>('region:tenants'),
    },
    operatorRuntime: {
      resources: createMapStore<any>('operator:resources'),
      controllers: createMapStore<any>('operator:controllers'),
      reconciliationHistory: createMapStore<any[]>('operator:reconciliation'),
    },
    topologyEngine: {
      clusterNodes: createMapStore<any>('topology:nodes'),
      workerTopologies: createMapStore<any>('topology:workers'),
      queuePartitions: createMapStore<any>('topology:queues'),
      regionTopologies: createMapStore<any>('topology:regions'),
      schedulerTopologies: createMapStore<any>('topology:schedulers'),
      tenantPlacements: createMapStore<any>('topology:tenants'),
    },
    multiRegionCoordinator: {
      regionMetadatas: createMapStore<any>('mrc:regions'),
      replicationCoordinators: createMapStore<any>('mrc:coordinators'),
      replicationLags: createMapStore<any>('mrc:lags'),
      regionRoutes: createMapStore<any>('mrc:routes'),
      globalEventSequence: createMapStore<number>('mrc:sequence'),
    },
    eventReplicator: {
      eventStreams: createMapStore<any>('replicator:streams'),
      replicatedEvents: createMapStore<any>('replicator:events'),
      replayRequests: createMapStore<any>('replicator:replays'),
      dedupCache: createMapStore<number>('replicator:dedup'),
      subscriptionRegistry: createMapStore<any>('replicator:subs'),
    },
    autoscaler: {
      autoscalePolicies: createMapStore<any>('autoscaler:policies'),
      autoscaleDecisions: createMapStore<any[]>('autoscaler:decisions'),
      loadMetrics: createMapStore<any[]>('autoscaler:metrics'),
      scalingEvents: createMapStore<any>('autoscaler:events'),
      lastScaleTimes: createMapStore<number>('autoscaler:lastscale'),
    },
    failoverOrchestrator: {
      failoverPlans: createMapStore<any>('failover:plans'),
      recoveryActions: createMapStore<any>('failover:recovery'),
      cacheRebuildPlans: createMapStore<any>('failover:cache'),
      failoverHistory: createMapStore<any[]>('failover:history'),
    },
    runtimeGovernance: {
      runtimePolicies: createMapStore<any>('governance:policies'),
      tenantQuotas: createMapStore<any>('governance:quotas'),
      regionalUsagePolicies: createMapStore<any>('governance:regions'),
      workerResourceGovernances: createMapStore<any>('governance:workers'),
      queueSaturationProtections: createMapStore<any>('governance:queues'),
      overloadProtections: createMapStore<any>('governance:overload'),
      policyEvaluationLog: createMapStore<any[]>('governance:evalog'),
    },
    operationalInsights: {
      clusterHealthCache: createMapStore<any>('insights:health'),
      replicationDashboard: createMapStore<any>('insights:dashboard'),
      failoverAnalytics: createMapStore<any[]>('insights:failovers'),
      autoscalingInsights: createMapStore<any>('insights:autoscale'),
      runtimeAnomalies: createMapStore<any>('insights:anomalies'),
    },
    benchmarkSuite: {
      benchmarkResults: createMapStore<any[]>('benchmark:results'),
      benchmarkRuns: createMapStore<any>('benchmark:runs'),
    },
    resilienceValidator: {
      resilienceTests: createMapStore<any>('resilience:tests'),
      validationResults: createMapStore<any[]>('resilience:validation'),
    },
  }
}
