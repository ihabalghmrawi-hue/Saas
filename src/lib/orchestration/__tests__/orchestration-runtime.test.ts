import { describe, it, expect, beforeEach } from 'vitest'

import {
  ResourceKind, ResourceStatus,
  registerControllerConfig, getControllerConfig, applyResource, deleteResource,
  getResource, listResources, updateObservedState, addCondition,
  reconcileResource, reconcileAll, cleanupStaleResources, getOperatorSummary,
} from '../operator-runtime'

import {
  TopologyNodeStatus,
  registerClusterNode, listClusterNodes, updateNodeUtilization, updateNodeStatus,
  registerWorkerTopology, listWorkerTopologies, updateWorkerLoad,
  registerQueuePartition, listQueuePartitions, updateQueueDepth,
  registerRegionTopology, listRegionTopologies, updateRegionHealthScore,
  registerSchedulerTopology, listSchedulerTopologies, placeTenant, getTenantPlacement,
  takeTopologySnapshot, detectTopologyAnomalies,
} from '../topology-engine'

import {
  ReplicationRole,
  registerRegionMetadata, listRegionMetadatas, getActiveRegions,
  registerReplicationCoordinator, listReplicationCoordinators, updateReplicationLag, getReplicationLag,
  setRegionRoute, getRegionRoute, getMultiRegionSummary,
} from '../multi-region-coordinator'

import {
  registerReplicatedStream, listReplicatedStreams, replicateEvent,
  getReplicatedEvent, queryReplicatedEvents, registerSubscriber,
  listSubscribers, getReplicationSummary,
} from '../event-replicator'

import {
  AutoscaleTarget,
  registerAutoscalePolicy, listAutoscalePolicies, evaluateAutoscale,
  recordLoadMetric, getAutoscalerSummary,
} from '../autoscaler'

import {
  FailoverType, FailoverPhase,
  createFailoverPlan, executeFailoverPlan, listFailoverPlans,
  createRecoveryAction, listRecoveryActions,
  createCacheRebuildPlan, updateCacheRebuildProgress, listCacheRebuildPlans, getFailoverSummary,
} from '../failover-orchestrator'

import {
  registerRuntimePolicy, listRuntimePolicies, evaluatePolicy,
  setTenantQuota, checkTenantQuota,
  setRegionalUsagePolicy, isRegionSaturated,
  setWorkerResourceGovernance, getWorkerResourceGovernance,
  setQueueSaturationProtection, checkQueueSaturation,
  registerOverloadProtection, checkOverloadStatus, getGovernanceSummary,
} from '../runtime-governance'

import {
  computeClusterHealth, getClusterHealth,
  computeReplicationDashboard, getReplicationDashboard,
  recordFailoverAnalytic, getFailoverAnalytics, reportAnomaly, listAnomalies,
  resolveAnomaly, getOperationalSummary,
} from '../operational-insights'

import {
  runBenchmark, getBenchmarkResults, listBenchmarkRuns, computeBenchmarkSummary,
} from '../benchmark-suite'

import {
  registerResilienceTest, executeResilienceTest, listResilienceTests,
  getResilienceSummary, runResilienceSuite,
} from '../resilience-validator'

beforeEach(() => {
  for (const r of listResources()) deleteResource(r.ref.kind, r.ref.name)
  for (const p of listAutoscalePolicies()) { /* policies cleared by re-init */ }
})

describe('Operator / Controller Runtime', () => {
  it('registers and gets controller configs', () => {
    registerControllerConfig({
      kind: ResourceKind.WORKER, reconciliationIntervalMs: 5000,
      minReplicas: 2, maxReplicas: 20, cooldownMs: 15000,
      selfHeal: true, staleThresholdMs: 30000,
    })
    const config = getControllerConfig(ResourceKind.WORKER)
    expect(config.minReplicas).toBe(2)
    expect(config.maxReplicas).toBe(20)
  })

  it('applies and retrieves resources', () => {
    const ref = applyResource(ResourceKind.WORKER, 'worker-pool-1', {
      replicas: 3, spec: { type: 'accounting' }, labels: { tier: 'production' },
      annotations: {}, createdAt: Date.now(), updatedAt: Date.now(),
    })
    expect(ref.kind).toBe(ResourceKind.WORKER)
    expect(ref.generation).toBe(1)

    const resource = getResource(ResourceKind.WORKER, 'worker-pool-1')
    expect(resource).toBeDefined()
    expect(resource!.desired.replicas).toBe(3)
  })

  it('lists resources by kind', () => {
    applyResource(ResourceKind.WORKER, 'w1', { replicas: 1, spec: {}, labels: {}, annotations: {}, createdAt: Date.now(), updatedAt: Date.now() })
    applyResource(ResourceKind.QUEUE, 'q1', { replicas: 2, spec: {}, labels: {}, annotations: {}, createdAt: Date.now(), updatedAt: Date.now() })
    applyResource(ResourceKind.WORKER, 'w2', { replicas: 1, spec: {}, labels: {}, annotations: {}, createdAt: Date.now(), updatedAt: Date.now() })

    const workers = listResources(ResourceKind.WORKER)
    expect(workers.length).toBe(2)
    expect(listResources().length).toBe(3)
  })

  it('reconciles desired vs observed state', async () => {
    applyResource(ResourceKind.WORKER, 'test-worker', {
      replicas: 5, spec: {}, labels: {}, annotations: {}, createdAt: Date.now(), updatedAt: Date.now(),
    })
    const result = await reconcileResource(ResourceKind.WORKER, 'test-worker')
    expect(result.success).toBe(true)
    expect(result.action).toBe('scale')
  })

  it('performs self-healing on failed resources', async () => {
    applyResource(ResourceKind.WORKER, 'failed-worker', {
      replicas: 2, spec: {}, labels: {}, annotations: {}, createdAt: Date.now(), updatedAt: Date.now(),
    })
    updateObservedState(ResourceKind.WORKER, 'failed-worker', { status: ResourceStatus.FAILED })
    const result = await reconcileResource(ResourceKind.WORKER, 'failed-worker')
    const resource = getResource(ResourceKind.WORKER, 'failed-worker')
    expect(resource!.observed.conditions.some(c => c.type === 'SelfHealing')).toBe(true)
  })

  it('updates observed state and conditions', () => {
    applyResource(ResourceKind.QUEUE, 'test-queue', {
      replicas: 1, spec: {}, labels: {}, annotations: {}, createdAt: Date.now(), updatedAt: Date.now(),
    })
    updateObservedState(ResourceKind.QUEUE, 'test-queue', {
      availableReplicas: 1, readyReplicas: 1, status: ResourceStatus.RUNNING,
    })
    addCondition(ResourceKind.QUEUE, 'test-queue', {
      type: 'Ready', status: 'True', reason: 'AllReplicasReady',
      message: 'Queue is ready', lastTransitionTime: Date.now(), lastHeartbeatTime: Date.now(),
    })
    const resource = getResource(ResourceKind.QUEUE, 'test-queue')
    expect(resource!.observed.availableReplicas).toBe(1)
    expect(resource!.observed.conditions.length).toBe(1)
  })

  it('reconciles all resources', async () => {
    applyResource(ResourceKind.WORKER, 'w1', { replicas: 2, spec: {}, labels: {}, annotations: {}, createdAt: Date.now(), updatedAt: Date.now() })
    applyResource(ResourceKind.QUEUE, 'q1', { replicas: 1, spec: {}, labels: {}, annotations: {}, createdAt: Date.now(), updatedAt: Date.now() })
    const results = await reconcileAll()
    expect(results.length).toBe(2)
  })

  it('cleans up stale terminated resources', () => {
    const ref = applyResource(ResourceKind.WORKER, 'stale-worker', {
      replicas: 0, spec: {}, labels: {}, annotations: {}, createdAt: Date.now(), updatedAt: Date.now(),
    })
    updateObservedState(ResourceKind.WORKER, 'stale-worker', { status: ResourceStatus.TERMINATED, lastHeartbeat: Date.now() - 600000 })
    const cleaned = cleanupStaleResources(100)
    expect(cleaned.length).toBe(1)
    expect(getResource(ResourceKind.WORKER, 'stale-worker')).toBeUndefined()
  })

  it('provides operator summary', () => {
    applyResource(ResourceKind.WORKER, 'w1', { replicas: 1, spec: {}, labels: {}, annotations: {}, createdAt: Date.now(), updatedAt: Date.now() })
    updateObservedState(ResourceKind.WORKER, 'w1', { status: ResourceStatus.RUNNING })
    applyResource(ResourceKind.QUEUE, 'q1', { replicas: 1, spec: {}, labels: {}, annotations: {}, createdAt: Date.now(), updatedAt: Date.now() })
    updateObservedState(ResourceKind.QUEUE, 'q1', { status: ResourceStatus.FAILED })

    const summary = getOperatorSummary()
    expect(summary.totalResources).toBe(2)
    expect(summary.byKind.worker).toBe(1)
    expect(summary.failedResources.length).toBe(1)
  })

  it('handles deletion of non-existent resource', () => {
    expect(deleteResource(ResourceKind.WORKER, 'nonexistent')).toBe(false)
  })

  it('starts at generation 1 and increments', () => {
    const ref1 = applyResource(ResourceKind.WORKER, 'gen-test', {
      replicas: 1, spec: {}, labels: {}, annotations: {}, createdAt: Date.now(), updatedAt: Date.now(),
    })
    const ref2 = applyResource(ResourceKind.WORKER, 'gen-test', {
      replicas: 2, spec: {}, labels: {}, annotations: {}, createdAt: Date.now(), updatedAt: Date.now(),
    })
    expect(ref1.generation).toBe(1)
    expect(ref2.generation).toBe(2)
  })
})

describe('Topology Engine', () => {
  it('registers and lists cluster nodes', () => {
    registerClusterNode({ id: 'node-1', host: '10.0.0.1', port: 6379, role: 'primary', status: TopologyNodeStatus.ONLINE, region: 'us-east', zone: 'us-east-1a', capacity: { cpu: 8, memory: 32768, disk: 500 }, utilization: { cpu: 0.3, memory: 0.5, disk: 0.2 }, labels: {}, joinedAt: Date.now(), lastHeartbeat: Date.now() })
    const nodes = listClusterNodes()
    expect(nodes.length).toBe(1)
    expect(nodes[0].region).toBe('us-east')
  })

  it('updates node utilization and status', () => {
    registerClusterNode({ id: 'node-2', host: '10.0.0.2', port: 6379, role: 'replica', status: TopologyNodeStatus.ONLINE, region: 'eu-west', zone: 'eu-west-1a', capacity: { cpu: 4, memory: 16384, disk: 250 }, utilization: { cpu: 0.1, memory: 0.2, disk: 0.1 }, labels: {}, joinedAt: Date.now(), lastHeartbeat: Date.now() })
    updateNodeUtilization('node-2', { cpu: 0.8, memory: 0.9, disk: 0.5 })
    updateNodeStatus('node-2', TopologyNodeStatus.DEGRADED)
    const node = listClusterNodes().find(n => n.id === 'node-2')
    expect(node!.utilization.cpu).toBe(0.8)
    expect(node!.status).toBe(TopologyNodeStatus.DEGRADED)
  })

  it('registers worker topologies', () => {
    registerWorkerTopology({ workerId: 'w-1', type: 'accounting', region: 'us-east', status: TopologyNodeStatus.ONLINE, assignedQueues: ['payroll', 'invoicing'], capabilities: ['process'], currentLoad: 5, maxLoad: 20 })
    const workers = listWorkerTopologies()
    expect(workers.length).toBe(1)
    expect(workers[0].assignedQueues).toContain('payroll')
  })

  it('updates worker load', () => {
    registerWorkerTopology({ workerId: 'w-2', type: 'report', region: 'eu-west', status: TopologyNodeStatus.ONLINE, assignedQueues: [], capabilities: ['generate'], currentLoad: 0, maxLoad: 10 })
    updateWorkerLoad('w-2', 8)
    expect(listWorkerTopologies().find(w => w.workerId === 'w-2')!.currentLoad).toBe(8)
  })

  it('registers queue partition topologies', () => {
    registerQueuePartition({ queueName: 'payroll', partition: 0, leader: 'w-1', replicas: ['w-2'], region: 'us-east', status: TopologyNodeStatus.ONLINE, depth: 100, throughput: 50, lagMs: 10, lastProcessedOffset: 500 })
    const queues = listQueuePartitions()
    expect(queues.length).toBe(1)
    expect(queues[0].depth).toBe(100)
  })

  it('updates queue depth', () => {
    registerQueuePartition({ queueName: 'invoicing', partition: 0, leader: 'w-1', replicas: [], region: 'us-east', status: TopologyNodeStatus.ONLINE, depth: 50, throughput: 30, lagMs: 5, lastProcessedOffset: 200 })
    updateQueueDepth('invoicing', 0, 250)
    expect(listQueuePartitions().find(q => q.queueName === 'invoicing')!.depth).toBe(250)
  })

  it('registers region topologies', () => {
    registerRegionTopology({ regionId: 'us-east', name: 'US East', status: 'active', priority: 1, endpoint: 'https://us-east.api.test.com', workerCount: 10, queueCount: 20, activeTenants: 50, avgLatencyMs: 5, healthScore: 0.95, capabilities: ['read', 'write', 'queue'], lastUpdated: Date.now() })
    const regions = listRegionTopologies()
    expect(regions.length).toBe(1)
    expect(regions[0].healthScore).toBe(0.95)
  })

  it('updates region health score', () => {
    registerRegionTopology({ regionId: 'eu-west', name: 'EU West', status: 'standby', priority: 2, endpoint: 'https://eu-west.api.test.com', workerCount: 5, queueCount: 10, activeTenants: 25, avgLatencyMs: 15, healthScore: 0.85, capabilities: ['read'], lastUpdated: Date.now() })
    updateRegionHealthScore('eu-west', 0.5)
    expect(listRegionTopologies().find(r => r.regionId === 'eu-west')!.healthScore).toBe(0.5)
  })

  it('registers scheduler topologies', () => {
    registerSchedulerTopology({ schedulerId: 'sched-1', region: 'us-east', leader: true, status: TopologyNodeStatus.ONLINE, registeredJobs: 15, activeExecutions: 3, lastHeartbeat: Date.now() })
    registerSchedulerTopology({ schedulerId: 'sched-2', region: 'eu-west', leader: false, status: TopologyNodeStatus.ONLINE, registeredJobs: 10, activeExecutions: 1, lastHeartbeat: Date.now() })
    expect(listSchedulerTopologies().length).toBe(2)
  })

  it('places and retrieves tenants', () => {
    placeTenant({ tenantId: 't-1', primaryRegion: 'us-east', failoverRegion: 'eu-west', readRegions: ['eu-west'], assignedQueues: [], assignedWorkers: [], placementPolicy: 'latency', pinned: false, placedAt: Date.now(), lastRebalanced: Date.now() })
    const placement = getTenantPlacement('t-1')
    expect(placement).toBeDefined()
    expect(placement!.primaryRegion).toBe('us-east')
  })

  it('takes topology snapshot', () => {
    registerClusterNode({ id: 'node-snap', host: '10.0.0.1', port: 6379, role: 'primary', status: TopologyNodeStatus.ONLINE, region: 'us-east', zone: 'us-east-1a', capacity: { cpu: 8, memory: 32768, disk: 500 }, utilization: { cpu: 0.3, memory: 0.5, disk: 0.2 }, labels: {}, joinedAt: Date.now(), lastHeartbeat: Date.now() })
    const snapshot = takeTopologySnapshot()
    expect(snapshot.cluster.length).toBeGreaterThan(0)
    expect(snapshot.timestamp).toBeGreaterThan(0)
  })

  it('detects topology anomalies', () => {
    registerClusterNode({ id: 'node-anom', host: '10.0.0.1', port: 6379, role: 'primary', status: TopologyNodeStatus.ONLINE, region: 'us-east', zone: 'us-east-1a', capacity: { cpu: 8, memory: 32768, disk: 500 }, utilization: { cpu: 0.95, memory: 0.5, disk: 0.2 }, labels: {}, joinedAt: Date.now(), lastHeartbeat: Date.now() })
    const anomalies = detectTopologyAnomalies()
    expect(anomalies.some(a => a.type === 'high_cpu')).toBe(true)
  })
})

describe('Multi-Region Coordinator', () => {
  it('registers and lists region metadata', () => {
    registerRegionMetadata({ regionId: 'us-east', name: 'US East', role: ReplicationRole.PRIMARY, endpoint: 'https://us-east.test.com', priority: 1, status: 'online', capabilities: ['read', 'write'], connectedRegions: ['eu-west'], latencyMs: 5, lastHealthCheck: Date.now(), version: '1.0' })
    const regions = listRegionMetadatas()
    expect(regions.length).toBe(1)
    expect(getActiveRegions().length).toBe(1)
  })

  it('registers replication coordinators', () => {
    registerReplicationCoordinator({ sourceRegion: 'us-east', targetRegion: 'eu-west', streamName: 'journal-events', status: 'active', lagMs: 50, lastReplicatedOffset: 'seq-100', lastReplicatedAt: Date.now(), bytesReplicated: 1048576, errorCount: 0 })
    const coordinators = listReplicationCoordinators('us-east')
    expect(coordinators.length).toBe(1)
  })

  it('tracks replication lag', async () => {
    await updateReplicationLag('us-east', 'eu-west', 'journal-events', 200, 1024, 'seq-105')
    const lag = getReplicationLag('us-east', 'eu-west', 'journal-events')
    expect(lag).toBeDefined()
    expect(lag!.status).toBe('healthy')
  })

  it('manages region routes', () => {
    setRegionRoute('us-east', 'eu-west', { regionId: 'eu-west', priority: 1, weight: 100, healthy: true, circuitBreaker: { failures: 0, lastFailure: 0, state: 'closed' } })
    const route = getRegionRoute('us-east', 'eu-west')
    expect(route).toBeDefined()
    expect(route!.healthy).toBe(true)
  })

  it('provides multi-region summary', () => {
    registerRegionMetadata({ regionId: 'us-east', name: 'US East', role: ReplicationRole.PRIMARY, endpoint: '', priority: 1, status: 'online', capabilities: [], connectedRegions: [], latencyMs: 0, lastHealthCheck: Date.now(), version: '1.0' })
    const summary = getMultiRegionSummary()
    expect(summary.totalRegions).toBeGreaterThan(0)
    expect(summary.activeRegions).toBeGreaterThan(0)
  })
})

describe('Event Replicator', () => {
  it('registers replicated streams', () => {
    registerReplicatedStream({ name: 'journal-events', sourceRegion: 'us-east', targetRegions: ['eu-west'], status: 'active', ordering: 'strict', dedupWindowMs: 5000, replayPolicy: 'latest', lastSequence: 0, lastReplicatedAt: Date.now(), totalEvents: 0, totalDeduped: 0 })
    const streams = listReplicatedStreams()
    expect(streams.length).toBe(1)
  })

  it('replicates events with sequencing', async () => {
    registerReplicatedStream({ name: 'audit-log', sourceRegion: 'us-east', targetRegions: ['eu-west', 'ap-southeast'], status: 'active', ordering: 'strict', dedupWindowMs: 10000, replayPolicy: 'all', lastSequence: 0, lastReplicatedAt: Date.now(), totalEvents: 0, totalDeduped: 0 })

    const event = await replicateEvent({ streamName: 'audit-log', type: 'journal.created', source: 'accounting', sourceRegion: 'us-east', targetRegions: ['eu-west'], payload: { id: 'JE-123', amount: 1000 }, metadata: { tenant: 't-1' }, ttl: 86400000 })
    expect(event.sequence).toBe(1)
    expect(event.payload.id).toBe('JE-123')

    const fetched = getReplicatedEvent(event.id)
    expect(fetched).toBeDefined()
    expect(fetched!.source).toBe('accounting')
  })

  it('deduplicates duplicate events', async () => {
    registerReplicatedStream({ name: 'dedup-test', sourceRegion: 'us-east', targetRegions: ['eu-west'], status: 'active', ordering: 'strict', dedupWindowMs: 5000, replayPolicy: 'latest', lastSequence: 0, lastReplicatedAt: Date.now(), totalEvents: 0, totalDeduped: 0 })

    await replicateEvent({ streamName: 'dedup-test', type: 'test.event', source: 'test', sourceRegion: 'us-east', targetRegions: ['eu-west'], payload: { key: 'duplicate' }, metadata: {}, ttl: 86400000 })
    await expect(replicateEvent({ streamName: 'dedup-test', type: 'test.event', source: 'test', sourceRegion: 'us-east', targetRegions: ['eu-west'], payload: { key: 'duplicate' }, metadata: {}, ttl: 86400000 })).rejects.toThrow('Duplicate')
  })

  it('queries events by sequence range', async () => {
    registerReplicatedStream({ name: 'query-test', sourceRegion: 'us-east', targetRegions: ['eu-west'], status: 'active', ordering: 'strict', dedupWindowMs: 100, replayPolicy: 'all', lastSequence: 0, lastReplicatedAt: Date.now(), totalEvents: 0, totalDeduped: 0 })

    await replicateEvent({ streamName: 'query-test', type: 'a', source: 'src', sourceRegion: 'us-east', targetRegions: ['eu-west'], payload: { n: 1 }, metadata: {}, ttl: 86400000 })
    await replicateEvent({ streamName: 'query-test', type: 'b', source: 'src', sourceRegion: 'us-east', targetRegions: ['eu-west'], payload: { n: 2 }, metadata: {}, ttl: 86400000 })

    const results = queryReplicatedEvents('query-test', { fromSeq: 1, toSeq: 1 })
    expect(results.length).toBe(1)
    expect(results[0].payload.n).toBe(1)
  })

  it('manages subscribers', () => {
    registerSubscriber('journal-events', 'worker-1')
    registerSubscriber('journal-events', 'worker-2')
    expect(listSubscribers('journal-events').length).toBe(2)
  })

  it('provides replication summary', () => {
    registerReplicatedStream({ name: 'summary-stream', sourceRegion: 'us-east', targetRegions: ['eu-west'], status: 'active', ordering: 'strict', dedupWindowMs: 5000, replayPolicy: 'latest', lastSequence: 10, lastReplicatedAt: Date.now(), totalEvents: 10, totalDeduped: 2 })
    const summary = getReplicationSummary()
    expect(summary.totalStreams).toBeGreaterThan(0)
    expect(summary.totalDeduped).toBeGreaterThanOrEqual(0)
  })
})

describe('Autoscaler', () => {
  it('registers autoscale policies', () => {
    registerAutoscalePolicy({ id: 'worker-pool-scale', target: 'worker', minReplicas: 2, maxReplicas: 20, cooldownMs: 30000, scaleUpThreshold: 0.8, scaleDownThreshold: 0.2, scaleUpFactor: 1.5, scaleDownFactor: 0.5, metrics: ['queue_depth', 'cpu_utilization'], enabled: true })
    const policies = listAutoscalePolicies('worker')
    expect(policies.length).toBe(1)
  })

  it('evaluates scale-up decisions', async () => {
    registerAutoscalePolicy({ id: 'scale-test', target: 'worker', minReplicas: 1, maxReplicas: 10, cooldownMs: 100, scaleUpThreshold: 0.7, scaleDownThreshold: 0.3, scaleUpFactor: 2.0, scaleDownFactor: 0.5, metrics: ['load'], enabled: true })
    recordLoadMetric({ name: 'load', value: 0.9, timestamp: Date.now(), labels: {} })
    const decision = await evaluateAutoscale('scale-test', 1)
    expect(decision.desiredReplicas).toBeGreaterThan(1)
    expect(decision.applied).toBe(true)
  })

  it('evaluates scale-down decisions', async () => {
    registerAutoscalePolicy({ id: 'scale-down-test', target: 'worker', minReplicas: 1, maxReplicas: 10, cooldownMs: 100, scaleUpThreshold: 0.7, scaleDownThreshold: 0.3, scaleUpFactor: 2.0, scaleDownFactor: 0.5, metrics: ['scale_down_load'], enabled: true })
    recordLoadMetric({ name: 'scale_down_load', value: 0.1, timestamp: Date.now(), labels: {} })
    const decision = await evaluateAutoscale('scale-down-test', 5)
    expect(decision.desiredReplicas).toBe(2)
    expect(decision.applied).toBe(true)
  })

  it('respects cooldown period', async () => {
    registerAutoscalePolicy({ id: 'cooldown-test', target: 'worker', minReplicas: 1, maxReplicas: 10, cooldownMs: 60000, scaleUpThreshold: 0.5, scaleDownThreshold: 0.1, scaleUpFactor: 2.0, scaleDownFactor: 0.5, metrics: ['load'], enabled: true })
    recordLoadMetric({ name: 'load', value: 0.9, timestamp: Date.now(), labels: {} })
    await evaluateAutoscale('cooldown-test', 2)
    const decision = await evaluateAutoscale('cooldown-test', 2)
    expect(decision.applied).toBe(false)
  })

  it('provides autoscaler summary', () => {
    registerAutoscalePolicy({ id: 'summary-test', target: 'queue', minReplicas: 1, maxReplicas: 5, cooldownMs: 30000, scaleUpThreshold: 0.8, scaleDownThreshold: 0.2, scaleUpFactor: 1.5, scaleDownFactor: 0.5, metrics: ['depth'], enabled: true })
    const summary = getAutoscalerSummary()
    expect(summary.totalPolicies).toBeGreaterThan(0)
  })
})

describe('Failover Orchestrator', () => {
  it('creates failover plans', () => {
    const plan = createFailoverPlan(FailoverType.REGIONAL, 'us-east', 'us-east', 'eu-west')
    expect(plan.type).toBe(FailoverType.REGIONAL)
    expect(plan.steps.length).toBeGreaterThan(0)
  })

  it('executes failover plan', async () => {
    const plan = createFailoverPlan(FailoverType.WORKER, 'worker-pool-1', 'us-east', 'eu-west')
    const result = await executeFailoverPlan(plan.id)
    expect(result.status).toBe('completed')
    expect(result.phase).toBe(FailoverPhase.COMPLETED)
  })

  it('creates recovery actions', () => {
    const action = createRecoveryAction('restart', 'worker', 'worker-1', 'OOM crash')
    expect(action.status).toBe('pending')
    const actions = listRecoveryActions('pending')
    expect(actions.length).toBe(1)
  })

  it('creates cache rebuild plans', () => {
    const plan = createCacheRebuildPlan('transaction-cache', 'eu-west', 50000, 'gradual')
    expect(plan.status).toBe('pending')
    updateCacheRebuildProgress('transaction-cache', 'eu-west', 50)
    expect(listCacheRebuildPlans('eu-west')[0].progress).toBe(50)
  })

  it('provides failover summary', () => {
    createFailoverPlan(FailoverType.SCHEDULER, 'sched-1', 'us-east', 'eu-west')
    const summary = getFailoverSummary()
    expect(summary.totalPlans).toBeGreaterThan(0)
  })
})

describe('Runtime Governance', () => {
  it('registers and evaluates runtime policies', () => {
    registerRuntimePolicy({ id: 'high-cpu-policy', name: 'High CPU', description: 'Alert on high CPU', scope: 'global', targetIds: ['*'], rules: [{ metric: 'cpu_utilization', operator: '>', threshold: 0.9, windowMs: 60000, action: 'alert' }], severity: 'critical', enabled: true, createdAt: Date.now(), updatedAt: Date.now() })
    const result = evaluatePolicy('high-cpu-policy', { cpu_utilization: 0.95 })
    expect(result.violated).toBe(true)
    expect(result.violations.length).toBe(1)
  })

  it('enforces tenant quotas', () => {
    setTenantQuota('t-1', { maxWorkers: 5, usedWorkers: 3 })
    const allowed = checkTenantQuota('t-1', 'Workers', 1)
    expect(allowed.allowed).toBe(true)
    const denied = checkTenantQuota('t-1', 'Workers', 3)
    expect(denied.allowed).toBe(false)
  })

  it('detects region saturation', () => {
    setRegionalUsagePolicy('us-east', { maxWorkers: 10, currentWorkers: 9, overloadProtection: true, saturationThreshold: 0.8 })
    const saturation = isRegionSaturated('us-east')
    expect(saturation.saturated).toBe(true)
  })

  it('manages worker resource governance', () => {
    setWorkerResourceGovernance('accounting', { workerType: 'accounting', maxConcurrentTasks: 20, maxMemoryMB: 1024, maxCPUCores: 4, maxQueueDepth: 5000, taskTimeoutMs: 60000, restartPolicy: 'always' })
    const gov = getWorkerResourceGovernance('accounting')
    expect(gov.maxConcurrentTasks).toBe(20)
  })

  it('detects queue saturation', () => {
    setQueueSaturationProtection('invoicing', { maxDepth: 1000, maxLatencyMs: 5000, backpressureThreshold: 0.8 })
    const status = checkQueueSaturation('invoicing', 1500, 100)
    expect(status.saturated).toBe(true)
    expect(status.backpressure).toBe(true)
  })

  it('detects overload conditions', () => {
    registerOverloadProtection({ id: 'ov-1', targetType: 'region', targetId: 'us-east', cpuThreshold: 0.9, memoryThreshold: 0.9, queueDepthThreshold: 10000, latencyThresholdMs: 5000, cooldownMs: 30000, action: 'throttle', active: true })
    const status = checkOverloadStatus('region', 'us-east', 0.95, 0.5, 100, 10)
    expect(status.overloaded).toBe(true)
    expect(status.triggeredBy.some(t => t.includes('CPU'))).toBe(true)
  })

  it('provides governance summary', () => {
    registerRuntimePolicy({ id: 'summary-policy', name: 'Test', description: '', scope: 'global', targetIds: [], rules: [{ metric: 'test', operator: '>', threshold: 1, windowMs: 1000, action: 'alert' }], severity: 'warning', enabled: true, createdAt: Date.now(), updatedAt: Date.now() })
    const summary = getGovernanceSummary()
    expect(summary.totalPolicies).toBeGreaterThan(0)
  })
})

describe('Operational Insights', () => {
  it('computes cluster health', () => {
    const health = computeClusterHealth('cluster-1', 10, 8, 1, 1, 50, 45, 2, 30, 1)
    expect(health.overallHealth).toBe('critical')
    expect(health.healthyNodes).toBe(8)
  })

  it('computes replication dashboard', () => {
    const entries = computeReplicationDashboard([{ streamName: 'journal', sourceRegion: 'us-east', targetRegion: 'eu-west', status: 'active', lagMs: 100, eventsReplicated: 5000, lastReplicatedAt: Date.now(), health: 'healthy' }])
    expect(entries.length).toBe(1)
    expect(getReplicationDashboard().length).toBe(1)
  })

  it('records failover analytics', () => {
    recordFailoverAnalytic({ failoverId: 'f-1', type: 'regional', targetId: 'us-east', sourceRegion: 'us-east', targetRegion: 'eu-west', durationMs: 15000, stepsTotal: 5, stepsFailed: 0, status: 'completed', timestamp: Date.now() })
    const analytics = getFailoverAnalytics('us-east')
    expect(analytics.length).toBe(1)
  })

  it('reports and resolves anomalies', () => {
    const anomaly = reportAnomaly('high_latency', 'critical', 'monitoring', 'Latency spike detected in us-east', { region: 'us-east', latency: 5000 })
    expect(anomaly.status).toBe('open')
    expect(listAnomalies('open').length).toBe(1)

    resolveAnomaly(anomaly.id)
    expect(listAnomalies('resolved').length).toBe(1)
  })

  it('provides operational summary', () => {
    computeClusterHealth('cluster-2', 5, 5, 0, 0, 20, 20, 0, 10, 0)
    const summary = getOperationalSummary()
    expect(summary.clusterHealthCount).toBeGreaterThan(0)
  })
})

describe('Benchmark Suite', () => {
  it('runs a benchmark and produces results', async () => {
    const run = await runBenchmark({ name: 'redis-lock-test', category: 'redis_coordination', concurrency: 10, totalOperations: 100, durationSeconds: 1, payloadSize: 64, options: {} })
    expect(run.status).toBe('completed')
    expect(run.results.length).toBe(1)
    expect(run.results[0].opsPerSecond).toBeGreaterThan(0)
  })

  it('lists benchmark results by category', async () => {
    await runBenchmark({ name: 'queue-test', category: 'queue_throughput', concurrency: 5, totalOperations: 50, durationSeconds: 1, payloadSize: 128, options: {} })
    const results = getBenchmarkResults('queue_throughput')
    expect(results.length).toBe(1)
  })

  it('computes benchmark summary', async () => {
    await runBenchmark({ name: 'summary-bench', category: 'event_propagation', concurrency: 10, totalOperations: 100, durationSeconds: 1, payloadSize: 256, options: {} })
    const summary = computeBenchmarkSummary()
    expect(summary.totalRuns).toBeGreaterThan(0)
    expect(Object.keys(summary.avgOpsPerSecond).length).toBeGreaterThan(0)
  })
})

describe('Resilience Validator', () => {
  it('registers and executes resilience tests', async () => {
    const test = registerResilienceTest({
      name: 'failover-no-data-loss', category: 'failover', description: 'Verify no data loss during failover',
      assertions: [{ name: 'no_data_loss', passed: false, expected: '0', actual: '', message: 'Data loss should be 0' }],
    })
    const result = await executeResilienceTest(test.id)
    expect(result.status).toBe('passed')
  })

  it('runs resilience suite', async () => {
    registerResilienceTest({ name: 'replay-safety', category: 'replay', description: 'Replay safety check', assertions: [{ name: 'no_duplicates', passed: false, expected: '0', actual: '', message: 'No duplicate events' }] })
    registerResilienceTest({ name: 'tenant-isolation', category: 'isolation', description: 'Tenant isolation check', assertions: [{ name: 'cross_tenant_blocked', passed: false, expected: 'no_cross_tenant_access', actual: '', message: 'Cross-tenant access blocked' }] })

    const results = await runResilienceSuite()
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(r => r.status === 'passed')).toBe(true)
  })

  it('provides resilience summary', () => {
    registerResilienceTest({ name: 'summary-test', category: 'consistency', description: 'Summary test', assertions: [{ name: 'check', passed: false, expected: 'consistent', actual: '', message: 'Check consistency' }] })
    const summary = getResilienceSummary()
    expect(summary.totalTests).toBeGreaterThan(0)
  })
})
