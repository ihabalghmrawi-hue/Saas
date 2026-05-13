import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  ResourceKind, ResourceStatus,
  registerControllerConfig, applyResource, deleteResource, getResource, listResources,
  updateObservedState, addCondition, reconcileResource, reconcileAll,
  cleanupStaleResources, getReconciliationHistory, getOperatorSummary,
} from '../operator-runtime'

import {
  TopologyNodeStatus,
  registerClusterNode, listClusterNodes, updateNodeUtilization, updateNodeStatus,
  registerWorkerTopology, listWorkerTopologies, updateWorkerLoad,
  registerQueuePartition, listQueuePartitions, updateQueueDepth,
  registerRegionTopology, listRegionTopologies, registerSchedulerTopology,
  placeTenant, getTenantPlacement, rebalanceTenant,
  takeTopologySnapshot, detectTopologyAnomalies,
} from '../topology-engine'

import {
  ReplicationRole,
  registerRegionMetadata, listRegionMetadatas, getActiveRegions, getRegionsByRole,
  registerReplicationCoordinator, listReplicationCoordinators,
  updateReplicationLag, getReplicationLag, getCriticalReplicationLags,
  setRegionRoute, getRegionRoute, getAllRoutesForRegion,
  getNextEventSequence, detectCircuitBreakers, checkRegionConnectivity,
  getMultiRegionSummary,
} from '../multi-region-coordinator'

import {
  registerReplicatedStream, listReplicatedStreams, replicateEvent,
  batchReplicateEvents, getReplicatedEvent, queryReplicatedEvents,
  requestReplay, executeReplay, registerSubscriber, listSubscribers,
  getReplicationSummary,
} from '../event-replicator'

import {
  AutoscaleTarget,
  registerAutoscalePolicy, listAutoscalePolicies, getAutoscalePolicy,
  recordLoadMetric, getLoadMetrics, getAverageLoad,
  evaluateAutoscale, evaluateAllAutoscalePolicies,
  getAutoscaleDecisions, getScalingEvents, completeScalingEvent,
  getAutoscalerSummary,
} from '../autoscaler'

import {
  FailoverType, FailoverPhase,
  createFailoverPlan, executeFailoverPlan, getFailoverPlan, listFailoverPlans,
  getFailoverHistory, createRecoveryAction, completeRecoveryAction, listRecoveryActions,
  createCacheRebuildPlan, updateCacheRebuildProgress, getCacheRebuildPlan, listCacheRebuildPlans,
  getFailoverSummary,
} from '../failover-orchestrator'

import {
  registerRuntimePolicy, getRuntimePolicy, listRuntimePolicies, evaluatePolicy, evaluateAllPolicies,
  setTenantQuota, getTenantQuota, checkTenantQuota,
  setRegionalUsagePolicy, getRegionalUsagePolicy, isRegionSaturated,
  setWorkerResourceGovernance, getWorkerResourceGovernance,
  setQueueSaturationProtection, getQueueSaturationProtection, checkQueueSaturation,
  registerOverloadProtection, getOverloadProtection, checkOverloadStatus,
  getGovernanceSummary,
} from '../runtime-governance'

import {
  computeClusterHealth, getClusterHealth, getAllClusterHealth,
  computeReplicationDashboard, getReplicationDashboard,
  recordFailoverAnalytic, getFailoverAnalytics,
  computeAutoscalingInsight, getAutoscalingInsight,
  reportAnomaly, getAnomaly, listAnomalies, resolveAnomaly,
  getOperationalSummary,
} from '../operational-insights'

import {
  runBenchmark, getBenchmarkResults, getBenchmarkRun, listBenchmarkRuns,
  computeBenchmarkSummary,
} from '../benchmark-suite'

import {
  registerResilienceTest, executeResilienceTest, runResilienceSuite,
  getResilienceTest, listResilienceTests, getValidationHistory,
  getResilienceSummary,
} from '../resilience-validator'

beforeEach(() => {
  for (const r of listResources()) deleteResource(r.ref.kind, r.ref.name)
})

describe('Enterprise Integration: Full Lifecycle', () => {
  it('Scenario 1: Resource → Reconcile → Anomaly Detection → Autoscale → Failover → Recover → Validate', async () => {
    // ── Phase 1: Register controller and apply resource ──
    registerControllerConfig({
      kind: ResourceKind.WORKER, reconciliationIntervalMs: 5000,
      minReplicas: 2, maxReplicas: 20, cooldownMs: 15000,
      selfHeal: true, staleThresholdMs: 60000,
    })

    const ref = applyResource(ResourceKind.WORKER, 'prod-worker-pool', {
      replicas: 4, spec: { type: 'accounting', version: '2.1' },
      labels: { tier: 'production', region: 'us-east' },
      annotations: { owner: 'platform-team' },
      createdAt: Date.now(), updatedAt: Date.now(),
    })
    expect(ref.generation).toBe(1)
    expect(ref.kind).toBe(ResourceKind.WORKER)

    // ── Phase 2: Update observed state and reconcile ──
    updateObservedState(ResourceKind.WORKER, 'prod-worker-pool', {
      availableReplicas: 4, readyReplicas: 4, status: ResourceStatus.RUNNING,
    })
    addCondition(ResourceKind.WORKER, 'prod-worker-pool', {
      type: 'Ready', status: 'True', reason: 'AllReplicasReady',
      message: 'All 4 replicas ready', lastTransitionTime: Date.now(), lastHeartbeatTime: Date.now(),
    })

    const reconcileResult = await reconcileResource(ResourceKind.WORKER, 'prod-worker-pool')
    expect(['noop', 'scale', 'provision']).toContain(reconcileResult.action)

    const history = getReconciliationHistory(ref.uid)
    expect(history.length).toBe(1)

    // ── Phase 3: Register topology and detect anomalies ──
    registerClusterNode({
      id: 'node-1', host: '10.0.0.1', port: 6379, role: 'primary',
      status: TopologyNodeStatus.ONLINE, region: 'us-east', zone: 'us-east-1a',
      capacity: { cpu: 8, memory: 32768, disk: 500 },
      utilization: { cpu: 0.92, memory: 0.75, disk: 0.3 },
      labels: {}, joinedAt: Date.now(), lastHeartbeat: Date.now(),
    })

    registerWorkerTopology({
      workerId: 'w-prod-1', type: 'accounting', region: 'us-east',
      status: TopologyNodeStatus.ONLINE, assignedQueues: ['payroll', 'invoicing'],
      capabilities: ['process'], currentLoad: 19, maxLoad: 20,
    })

    const anomalies = detectTopologyAnomalies()
    expect(anomalies.some(a => a.type === 'high_cpu')).toBe(true)
    expect(anomalies.some(a => a.type === 'worker_overloaded')).toBe(true)

    // ── Phase 4: Autoscale based on load ──
    registerAutoscalePolicy({
      id: 'prod-worker-autoscale', target: 'worker',
      minReplicas: 2, maxReplicas: 20, cooldownMs: 30000,
      scaleUpThreshold: 0.7, scaleDownThreshold: 0.2,
      scaleUpFactor: 1.5, scaleDownFactor: 0.5,
      metrics: ['cpu', 'queue_depth'], enabled: true,
    })
    recordLoadMetric({ name: 'cpu', value: 0.92, timestamp: Date.now(), labels: { worker: 'w-prod-1' } })
    recordLoadMetric({ name: 'queue_depth', value: 1500, timestamp: Date.now(), labels: { queue: 'payroll' } })

    const scaleDecision = await evaluateAutoscale('prod-worker-autoscale', 4)
    expect(scaleDecision.applied).toBe(true)
    expect(scaleDecision.desiredReplicas).toBeGreaterThan(4)
    expect(scaleDecision.reason).toContain('Scaling up')

    const decisions = getAutoscaleDecisions('prod-worker-autoscale')
    expect(decisions.length).toBe(1)

    const scalingEvents = getScalingEvents('prod-worker-autoscale', 'in_progress')
    expect(scalingEvents.length).toBe(1)
    expect(scalingEvents[0].from).toBe(4)
    expect(scalingEvents[0].to).toBeGreaterThan(4)

    completeScalingEvent(`prod-worker-autoscale:${scalingEvents[0].triggeredAt}`)
    expect(getScalingEvents('prod-worker-autoscale', 'completed').length).toBe(1)

    // ── Phase 5: Multi-region setup and failover ──
    registerRegionMetadata({
      regionId: 'us-east', name: 'US East', role: ReplicationRole.PRIMARY,
      endpoint: 'https://us-east.example.com', priority: 1, status: 'online',
      capabilities: ['read', 'write'], connectedRegions: ['eu-west'],
      latencyMs: 5, lastHealthCheck: Date.now(), version: '2.0',
    })
    registerRegionMetadata({
      regionId: 'eu-west', name: 'EU West', role: ReplicationRole.STANDBY,
      endpoint: 'https://eu-west.example.com', priority: 2, status: 'online',
      capabilities: ['read', 'write'], connectedRegions: ['us-east'],
      latencyMs: 65, lastHealthCheck: Date.now(), version: '2.0',
    })

    setRegionRoute('us-east', 'eu-west', {
      regionId: 'eu-west', priority: 1, weight: 100, healthy: true,
      circuitBreaker: { failures: 0, lastFailure: 0, state: 'closed' },
    })

    const mcrSummary = getMultiRegionSummary()
    expect(mcrSummary.totalRegions).toBe(2)
    expect(mcrSummary.activeRegions).toBe(2)

    // Register replication coordinator BEFORE failover
    registerReplicationCoordinator({
      sourceRegion: 'us-east', targetRegion: 'eu-west', streamName: 'worker-events',
      status: 'active', lagMs: 50, lastReplicatedOffset: 'seq-200',
      lastReplicatedAt: Date.now(), bytesReplicated: 5242880, errorCount: 0,
    })

    const failoverPlan = createFailoverPlan(FailoverType.WORKER, 'prod-worker-pool', 'us-east', 'eu-west')
    expect(failoverPlan.type).toBe(FailoverType.WORKER)
    expect(failoverPlan.steps.length).toBeGreaterThan(0)

    const executedPlan = await executeFailoverPlan(failoverPlan.id)
    expect(executedPlan.status).toBe('completed')
    expect(executedPlan.phase).toBe(FailoverPhase.COMPLETED)

    const historyEntries = getFailoverHistory('prod-worker-pool')
    expect(historyEntries.length).toBe(1)
    expect(historyEntries[0].status).toBe('completed')

    // ── Phase 6: Recovery actions ──
    const recovery = createRecoveryAction('restart', 'worker', 'w-prod-1', 'Post-failover restart')
    expect(recovery.status).toBe('pending')

    completeRecoveryAction(recovery.id)
    expect(listRecoveryActions('completed').length).toBe(1)

    const cachePlan = createCacheRebuildPlan('transaction-cache', 'eu-west', 25000, 'gradual')
    expect(cachePlan.status).toBe('pending')
    expect(cachePlan.estimatedSize).toBe(25000)

    updateCacheRebuildProgress('transaction-cache', 'eu-west', 100)
    expect(getCacheRebuildPlan('transaction-cache', 'eu-west')!.status).toBe('completed')

    // ── Phase 7: Validate resilience ──
    const test = registerResilienceTest({
      name: 'failover-no-data-loss', category: 'failover',
      description: 'Verify no data loss during worker failover',
      assertions: [
        { name: 'no_data_loss', passed: false, expected: '0', actual: '', message: 'Data loss should be 0' },
        { name: 'failover_timeout', passed: false, expected: '5000', actual: '', message: 'Failover under 5s' },
      ],
    })
    const passedTest = await executeResilienceTest(test.id)
    expect(passedTest.status).toBe('passed')

    // ── Phase 8: Operational insights ──
    const health = computeClusterHealth('prod-cluster', 10, 8, 2, 0, 50, 45, 0, 100, 1)
    expect(health.overallHealth).toBe('degraded')
    expect(health.healthyNodes).toBe(8)
    expect(getClusterHealth('prod-cluster')).toBeDefined()

    const dashboard = computeReplicationDashboard([{
      streamName: 'worker-events', sourceRegion: 'us-east', targetRegion: 'eu-west',
      status: 'active', lagMs: 100, eventsReplicated: 5000,
      lastReplicatedAt: Date.now(), health: 'healthy',
    }])
    expect(dashboard.length).toBe(1)
    expect(getReplicationDashboard().length).toBe(1)

    recordFailoverAnalytic({
      failoverId: failoverPlan.id, type: 'worker', targetId: 'prod-worker-pool',
      sourceRegion: 'us-east', targetRegion: 'eu-west', durationMs: 1520,
      stepsTotal: 5, stepsFailed: 0, status: 'completed', timestamp: Date.now(),
    })
    const analytics = getFailoverAnalytics('prod-worker-pool')
    expect(analytics.length).toBe(1)
    expect(analytics[0].status).toBe('completed')

    const anomaly = reportAnomaly('worker_cpu_spike', 'high', 'monitoring',
      'CPU spike detected on prod-worker-pool', { cpu: 0.92, worker: 'w-prod-1' })
    expect(anomaly.status).toBe('open')
    expect(listAnomalies('open').length).toBe(1)

    resolveAnomaly(anomaly.id)
    expect(listAnomalies('resolved').length).toBe(1)

    // ── Final: Operator summary ──
    const operatorSummary = getOperatorSummary()
    expect(operatorSummary.totalResources).toBeGreaterThan(0)
    expect(operatorSummary.byKind.worker).toBeGreaterThan(0)

    const failoverSummary = getFailoverSummary()
    expect(failoverSummary.totalPlans).toBeGreaterThan(0)
    expect(failoverSummary.completedFailovers).toBeGreaterThan(0)
  }, 30000)

  it('Scenario 2: Cross-Region Event Pipeline with Replication, Governance, and Insights', async () => {
    // ── Phase 1: Multi-region topology ──
    for (const r of [
      { id: 'us-east', name: 'US East', role: ReplicationRole.PRIMARY, priority: 1, status: 'online' as const },
      { id: 'eu-west', name: 'EU West', role: ReplicationRole.READ_REPLICA, priority: 2, status: 'online' as const },
      { id: 'ap-southeast', name: 'AP Southeast', role: ReplicationRole.READ_REPLICA, priority: 3, status: 'online' as const },
    ]) {
      registerRegionMetadata({
        regionId: r.id, name: r.name, role: r.role,
        endpoint: `https://${r.id}.example.com`, priority: r.priority,
        status: r.status, capabilities: ['read', 'write'],
        connectedRegions: ['us-east', 'eu-west', 'ap-southeast'],
        latencyMs: r.priority === 1 ? 5 : r.priority === 2 ? 65 : 120,
        lastHealthCheck: Date.now(), version: '2.0',
      })
    }

    registerRegionTopology({
      regionId: 'us-east', name: 'US East', status: 'active', priority: 1,
      endpoint: 'https://us-east.example.com', workerCount: 20, queueCount: 40,
      activeTenants: 100, avgLatencyMs: 5, healthScore: 0.98,
      capabilities: ['read', 'write', 'queue'], lastUpdated: Date.now(),
    })
    registerRegionTopology({
      regionId: 'eu-west', name: 'EU West', status: 'standby', priority: 2,
      endpoint: 'https://eu-west.example.com', workerCount: 10, queueCount: 20,
      activeTenants: 50, avgLatencyMs: 65, healthScore: 0.85,
      capabilities: ['read', 'queue'], lastUpdated: Date.now(),
    })

    expect(listRegionMetadatas().length).toBe(3)
    expect(getActiveRegions().length).toBe(3)
    expect(getRegionsByRole(ReplicationRole.READ_REPLICA).length).toBe(2)
    expect(listRegionTopologies().length).toBe(2)

    // ── Phase 2: Event replication pipeline ──
    registerReplicatedStream({
      name: 'journal-events', sourceRegion: 'us-east',
      targetRegions: ['eu-west', 'ap-southeast'],
      status: 'active', ordering: 'strict', dedupWindowMs: 10000,
      replayPolicy: 'all', lastSequence: 0, lastReplicatedAt: Date.now(),
      totalEvents: 0, totalDeduped: 0,
    })

    // Replicate a batch of events
    const events = await batchReplicateEvents({
      events: [
        { streamName: 'journal-events', type: 'journal.created', source: 'accounting', sourceRegion: 'us-east', targetRegions: ['eu-west', 'ap-southeast'], payload: { id: 'JE-100', amount: 5000 }, metadata: { tenant: 't-1' }, ttl: 86400000 },
        { streamName: 'journal-events', type: 'journal.created', source: 'accounting', sourceRegion: 'us-east', targetRegions: ['eu-west', 'ap-southeast'], payload: { id: 'JE-101', amount: 12000 }, metadata: { tenant: 't-2' }, ttl: 86400000 },
        { streamName: 'journal-events', type: 'journal.approved', source: 'approval', sourceRegion: 'us-east', targetRegions: ['eu-west'], payload: { id: 'JE-100', approved: true }, metadata: { reviewer: 'auditor' }, ttl: 86400000 },
      ],
      sourceRegion: 'us-east', targetRegion: 'eu-west',
      batchId: 'batch-001', checksum: 'abc123',
    })
    expect(events.length).toBe(3)
    expect(events[0].sequence).toBe(1)
    expect(events[2].sequence).toBe(3)

    // Query events by sequence range
    const queried = queryReplicatedEvents('journal-events', { fromSeq: 2, toSeq: 3 })
    expect(queried.length).toBe(2)
    expect(queried[0].payload.id).toBe('JE-101')

    // Query by type
    const approved = queryReplicatedEvents('journal-events', { type: 'journal.approved' })
    expect(approved.length).toBe(1)

    // Subscriber management
    registerSubscriber('journal-events', 'worker-eu-1')
    registerSubscriber('journal-events', 'worker-eu-2')
    registerSubscriber('journal-events', 'worker-ap-1')
    expect(listSubscribers('journal-events').length).toBe(3)

    // ── Phase 3: Replication coordinators and lag tracking ──
    registerReplicationCoordinator({
      sourceRegion: 'us-east', targetRegion: 'eu-west', streamName: 'journal-events',
      status: 'active', lagMs: 150, lastReplicatedOffset: 'seq-3',
      lastReplicatedAt: Date.now(), bytesReplicated: 2048, errorCount: 0,
    })
    registerReplicationCoordinator({
      sourceRegion: 'us-east', targetRegion: 'ap-southeast', streamName: 'journal-events',
      status: 'active', lagMs: 350, lastReplicatedOffset: 'seq-3',
      lastReplicatedAt: Date.now(), bytesReplicated: 2048, errorCount: 1,
    })

    const usEastCoordinators = listReplicationCoordinators('us-east')
    expect(usEastCoordinators.length).toBeGreaterThanOrEqual(2)

    await updateReplicationLag('us-east', 'eu-west', 'journal-events', 200, 512, 'seq-3')
    await updateReplicationLag('us-east', 'ap-southeast', 'journal-events', 6000, 2048, 'seq-2')

    const euLag = getReplicationLag('us-east', 'eu-west', 'journal-events')
    expect(euLag).toBeDefined()
    expect(euLag!.status).toBe('healthy')

    const apLag = getReplicationLag('us-east', 'ap-southeast', 'journal-events')
    expect(apLag!.status).toBe('critical')

    const criticalLags = getCriticalReplicationLags()
    expect(criticalLags.length).toBe(1)

    // ── Phase 4: Replay request and execution ──
    const replay = await requestReplay({
      streamName: 'journal-events', targetRegion: 'eu-west',
      fromSequence: 1, toSequence: 3, reason: 'Post-failover catchup',
    })
    expect(replay.status).toBe('pending')

    const replayResult = await executeReplay(`${replay.streamName}:${replay.targetRegion}:${replay.fromSequence}`)
    expect(replayResult.success).toBe(true)
    expect(replayResult.eventsReplayed).toBeGreaterThanOrEqual(0)

    // ── Phase 5: Region routes and circuit breakers ──
    setRegionRoute('us-east', 'eu-west', {
      regionId: 'eu-west', priority: 1, weight: 100, healthy: true,
      circuitBreaker: { failures: 0, lastFailure: 0, state: 'closed' },
    })
    setRegionRoute('us-east', 'ap-southeast', {
      regionId: 'ap-southeast', priority: 2, weight: 50, healthy: false,
      circuitBreaker: { failures: 5, lastFailure: Date.now(), state: 'open' },
    })

    const usEastRoutes = getAllRoutesForRegion('us-east')
    expect(usEastRoutes.size).toBe(2)

    const circuitBreakers = await detectCircuitBreakers()
    expect(circuitBreakers.length).toBe(1)
    expect(circuitBreakers[0].breakerState).toBe('open')

    const connectivity = await checkRegionConnectivity('us-east')
    expect(connectivity.routes).toBe(2)
    expect(connectivity.failedRoutes).toBe(1)
    expect(connectivity.healthy).toBe(false)

    // ── Phase 6: Governance enforcement ──
    registerRuntimePolicy({
      id: 'repl-lag-policy', name: 'Replication Lag', description: 'Alert on critical lag',
      scope: 'global', targetIds: ['*'],
      rules: [
        { metric: 'replication_lag_ms', operator: '>', threshold: 5000, windowMs: 60000, action: 'alert' },
        { metric: 'error_rate', operator: '>', threshold: 0.01, windowMs: 60000, action: 'throttle' },
      ],
      severity: 'critical', enabled: true, createdAt: Date.now(), updatedAt: Date.now(),
    })

    const evalResult = evaluatePolicy('repl-lag-policy', { replication_lag_ms: 6000, error_rate: 0.02 })
    expect(evalResult.violated).toBe(true)
    expect(evalResult.violations.length).toBe(2)

    // Tenant quotas
    setTenantQuota('t-1', {
      maxWorkers: 10, maxQueues: 20, maxConcurrentJobs: 200, maxStorageMB: 5120,
      maxBandwidthMBps: 500, maxApiCallsPerMin: 50000, usedWorkers: 3, usedQueues: 5,
      usedConcurrentJobs: 50, usedStorageMB: 1024, usedBandwidthMBps: 100, apiCallsThisMin: 500,
      quotas: { workers: 10 }, usage: { workers: 3 },
    })
    expect(checkTenantQuota('t-1', 'Workers', 5).allowed).toBe(true)
    expect(checkTenantQuota('t-1', 'Workers', 10).allowed).toBe(false)

    // Region saturation
    setRegionalUsagePolicy('us-east', {
      maxWorkers: 10, currentWorkers: 9, overloadProtection: true, saturationThreshold: 0.8,
    })
    const saturation = isRegionSaturated('us-east')
    expect(saturation.saturated).toBe(true)

    // Queue saturation
    setQueueSaturationProtection('journal-events', {
      maxDepth: 5000, maxLatencyMs: 3000, backpressureThreshold: 0.8,
    })
    const qStatus = checkQueueSaturation('journal-events', 6000, 500)
    expect(qStatus.saturated).toBe(true)
    expect(qStatus.backpressure).toBe(true)

    // Overload protection
    registerOverloadProtection({
      id: 'us-east-ov', targetType: 'region', targetId: 'us-east',
      cpuThreshold: 0.9, memoryThreshold: 0.85, queueDepthThreshold: 10000,
      latencyThresholdMs: 2000, cooldownMs: 30000, action: 'throttle', active: true,
    })
    const overload = checkOverloadStatus('region', 'us-east', 0.95, 0.9, 5000, 100)
    expect(overload.overloaded).toBe(true)
    expect(overload.triggeredBy.length).toBeGreaterThanOrEqual(2)

    // Worker governance
    setWorkerResourceGovernance('accounting', {
      workerType: 'accounting', maxConcurrentTasks: 20, maxMemoryMB: 2048,
      maxCPUCores: 4, maxQueueDepth: 5000, taskTimeoutMs: 60000, restartPolicy: 'always',
    })
    const gov = getWorkerResourceGovernance('accounting')
    expect(gov.maxConcurrentTasks).toBe(20)
    expect(gov.restartPolicy).toBe('always')

    // ── Phase 7: Operational dashboards ──
    const replDashboardData = computeReplicationDashboard([
      { streamName: 'journal-events', sourceRegion: 'us-east', targetRegion: 'eu-west', status: 'active', lagMs: 200, eventsReplicated: 3, lastReplicatedAt: Date.now(), health: 'healthy' },
      { streamName: 'journal-events', sourceRegion: 'us-east', targetRegion: 'ap-southeast', status: 'active', lagMs: 6000, eventsReplicated: 2, lastReplicatedAt: Date.now(), health: 'critical' },
    ])
    expect(replDashboardData.length).toBe(2)
    expect(getReplicationDashboard('ap-southeast').length).toBe(1)

    // Cluster health
    const clusterHealth = computeClusterHealth('global-cluster', 30, 25, 3, 2, 150, 130, 5, 200, 3)
    expect(clusterHealth.overallHealth).toBe('critical')
    expect(getAllClusterHealth().length).toBeGreaterThanOrEqual(1)

    // Autoscaling insight
    computeAutoscalingInsight('prod-worker-autoscale', [
      { desiredReplicas: 6, currentReplicas: 4, timestamp: Date.now() - 60000 },
      { desiredReplicas: 8, currentReplicas: 6, timestamp: Date.now() - 30000 },
      { desiredReplicas: 4, currentReplicas: 8, timestamp: Date.now() },
    ])
    const insight = getAutoscalingInsight('prod-worker-autoscale')
    expect(insight).toBeDefined()
    expect(insight!.totalScaleUps).toBe(2)
    expect(insight!.totalScaleDowns).toBe(1)

    // Anomaly reporting
    const replAnomaly = reportAnomaly('replication_lag_critical', 'critical', 'monitoring',
      'AP Southeast replication lag critical', { lagMs: 6000, stream: 'journal-events' })
    expect(listAnomalies('open', 'critical').length).toBeGreaterThan(0)

    // ── Phase 8: Summaries ──
    const replSummary = getReplicationSummary()
    expect(replSummary.totalStreams).toBeGreaterThan(0)
    expect(replSummary.totalEvents).toBeGreaterThan(0)

    const govSummary = getGovernanceSummary()
    expect(govSummary.totalPolicies).toBeGreaterThan(0)
    expect(govSummary.saturatedQueues).toBeGreaterThan(0)

    const opsSummary = getOperationalSummary()
    expect(opsSummary.clusterHealthCount).toBeGreaterThan(0)
    expect(opsSummary.replicationStreams).toBeGreaterThan(0)
    expect(opsSummary.criticalAnomalies).toBeGreaterThan(0)
  }, 30000)

  it('Scenario 3: Tenant Lifecycle with Placement, Rebalance, Benchmark, and Resilience Suite', async () => {
    // ── Phase 1: Infrastructure setup ──
    registerClusterNode({
      id: 'node-a', host: '10.0.0.1', port: 6379, role: 'primary',
      status: TopologyNodeStatus.ONLINE, region: 'us-east', zone: 'us-east-1a',
      capacity: { cpu: 16, memory: 65536, disk: 1000 },
      utilization: { cpu: 0.4, memory: 0.5, disk: 0.3 },
      labels: { tier: 'critical' }, joinedAt: Date.now(), lastHeartbeat: Date.now(),
    })
    registerClusterNode({
      id: 'node-b', host: '10.0.0.2', port: 6379, role: 'replica',
      status: TopologyNodeStatus.ONLINE, region: 'eu-west', zone: 'eu-west-1b',
      capacity: { cpu: 8, memory: 32768, disk: 500 },
      utilization: { cpu: 0.2, memory: 0.3, disk: 0.1 },
      labels: { tier: 'standard' }, joinedAt: Date.now(), lastHeartbeat: Date.now(),
    })

    registerSchedulerTopology({
      schedulerId: 'sched-us', region: 'us-east', leader: true,
      status: TopologyNodeStatus.ONLINE, registeredJobs: 25, activeExecutions: 5,
      lastHeartbeat: Date.now(),
    })
    registerSchedulerTopology({
      schedulerId: 'sched-eu', region: 'eu-west', leader: false,
      status: TopologyNodeStatus.ONLINE, registeredJobs: 15, activeExecutions: 2,
      lastHeartbeat: Date.now(),
    })

    // ── Phase 2: Tenant placement and rebalancing ──
    placeTenant({
      tenantId: 'acme-corp', primaryRegion: 'us-east', failoverRegion: 'eu-west',
      readRegions: ['eu-west'], assignedQueues: ['acme-payroll', 'acme-invoicing'],
      assignedWorkers: ['w-acme-1', 'w-acme-2'],
      placementPolicy: 'latency', pinned: false, placedAt: Date.now(), lastRebalanced: Date.now(),
    })

    const placement = getTenantPlacement('acme-corp')
    expect(placement).toBeDefined()
    expect(placement!.primaryRegion).toBe('us-east')
    expect(placement!.assignedQueues).toContain('acme-payroll')

    const rebalanced = rebalanceTenant('acme-corp', 'eu-west')
    expect(rebalanced!.primaryRegion).toBe('eu-west')
    expect(rebalanced!.failoverRegion).toBe('us-east')

    // ── Phase 3: Topology snapshot ──
    const snapshot = takeTopologySnapshot()
    expect(snapshot.cluster.length).toBeGreaterThanOrEqual(2)
    expect(snapshot.schedulers.length).toBe(2)
    expect(snapshot.tenants.length).toBe(1)
    expect(snapshot.timestamp).toBeGreaterThan(0)

    // ── Phase 4: Resource reconciliation with all 7 kinds ──
    const kinds = [ResourceKind.WORKER, ResourceKind.QUEUE, ResourceKind.SCHEDULER,
      ResourceKind.BACKUP, ResourceKind.REPORT, ResourceKind.AI_WORKLOAD, ResourceKind.RECONCILIATION]

    for (const kind of kinds) {
      registerControllerConfig({
        kind, reconciliationIntervalMs: 10000, minReplicas: 1, maxReplicas: 10,
        cooldownMs: 30000, selfHeal: true, staleThresholdMs: 60000,
      })
      const r = applyResource(kind, `${kind}-test`, {
        replicas: 2, spec: { type: kind }, labels: { test: 'true' },
        annotations: {}, createdAt: Date.now(), updatedAt: Date.now(),
      })
      expect(r.generation).toBe(1)
      updateObservedState(kind, `${kind}-test`, { status: ResourceStatus.RUNNING })
    }
    expect(listResources().length).toBe(kinds.length)
    const allResults = await reconcileAll()
    expect(allResults.length).toBe(kinds.length)
    expect(allResults.every(r => r.success)).toBe(true)

    // Mark one as FAILED and verify self-heal (set availableReplicas to match desired first)
    updateObservedState(ResourceKind.WORKER, 'worker-test', { availableReplicas: 2, readyReplicas: 2, status: ResourceStatus.FAILED })
    const healed = await reconcileResource(ResourceKind.WORKER, 'worker-test')
    expect(healed.action).toBe('self_heal')
    const healedRes = getResource(ResourceKind.WORKER, 'worker-test')
    expect(healedRes!.observed.conditions.some(c => c.type === 'SelfHealing')).toBe(true)

    const summary = getOperatorSummary()
    expect(summary.totalResources).toBe(kinds.length)
    expect(Object.keys(summary.byKind).length).toBe(kinds.length)

    // ── Phase 5: Benchmark suite ──
    const benchRun = await runBenchmark({
      name: 'stress-test', category: 'runtime_stress', concurrency: 10,
      totalOperations: 50, durationSeconds: 1, payloadSize: 64, options: {},
    })
    expect(benchRun.status).toBe('completed')
    expect(benchRun.results.length).toBeGreaterThan(0)
    expect(benchRun.results[0].opsPerSecond).toBeGreaterThan(0)

    const benchRun2 = await runBenchmark({
      name: 'multi-worker-test', category: 'multi_worker', concurrency: 5,
      totalOperations: 30, durationSeconds: 1, payloadSize: 128, options: {},
    })
    expect(benchRun2.status).toBe('completed')

    const benchResults = getBenchmarkResults('runtime_stress')
    expect(benchResults.length).toBe(1)
    expect(benchResults[0].name).toBe('stress-test')

    const benchRuns = listBenchmarkRuns(undefined, 10)
    expect(benchRuns.length).toBe(2)

    const benchSynced = computeBenchmarkSummary()
    expect(benchSynced.totalRuns).toBe(2)
    expect(Object.keys(benchSynced.avgOpsPerSecond).length).toBe(2)

    // ── Phase 6: Resilience validation suite ──
    registerResilienceTest({
      name: 'replay-no-duplicates', category: 'replay',
      description: 'Verify replay produces no duplicates',
      assertions: [{ name: 'no_duplicates', passed: false, expected: '0', actual: '', message: 'No duplicate events' }],
    })
    registerResilienceTest({
      name: 'tenant-isolation', category: 'isolation',
      description: 'Verify cross-tenant isolation',
      assertions: [{ name: 'cross_tenant_blocked', passed: false, expected: 'no_cross_tenant_access', actual: '', message: 'Cross-tenant access blocked' }],
    })
    registerResilienceTest({
      name: 'backpressure-handling', category: 'saturation',
      description: 'Verify backpressure activates on saturation',
      assertions: [{ name: 'backpressure', passed: false, expected: 'backpressure_activated', actual: '', message: 'Backpressure activated' }],
    })
    registerResilienceTest({
      name: 'replication-consistency', category: 'consistency',
      description: 'Verify cross-region consistency',
      assertions: [{ name: 'replication_gap', passed: false, expected: '0', actual: '', message: 'No replication gap' }],
    })

    expect(listResilienceTests().length).toBeGreaterThanOrEqual(4)

    const suiteResults = await runResilienceSuite()
    expect(suiteResults.length).toBe(4)
    expect(suiteResults.every(r => r.status === 'passed')).toBe(true)

    const relSummary = getResilienceSummary()
    expect(relSummary.totalTests).toBeGreaterThanOrEqual(4)
    expect(relSummary.passed).toBeGreaterThanOrEqual(4)
    expect(relSummary.passRate).toBeGreaterThanOrEqual(0.8)

    const validationLog = getValidationHistory()
    expect(validationLog.length).toBeGreaterThanOrEqual(4)
    expect(validationLog.every(v => v.passed)).toBe(true)

    // ── Phase 7: Cleanup stale resources ──
    applyResource(ResourceKind.WORKER, 'stale-cleanup-test', {
      replicas: 0, spec: {}, labels: {}, annotations: {},
      createdAt: Date.now() - 3600000, updatedAt: Date.now() - 3600000,
    })
    updateObservedState(ResourceKind.WORKER, 'stale-cleanup-test', {
      status: ResourceStatus.TERMINATED, lastHeartbeat: Date.now() - 300000,
    })
    const cleaned = cleanupStaleResources(60000)
    expect(cleaned.length).toBe(1)
    expect(getResource(ResourceKind.WORKER, 'stale-cleanup-test')).toBeUndefined()
  }, 30000)
})

describe('Enterprise Integration: Edge Cases and Error Paths', () => {
  it('handles failover plan not found', async () => {
    await expect(executeFailoverPlan('nonexistent')).rejects.toThrow('not found')
  })

  it('handles replication on unknown stream', async () => {
    await expect(replicateEvent({
      streamName: 'unknown', type: 'test', source: 'test',
      sourceRegion: 'us-east', targetRegions: ['eu-west'],
      payload: {}, metadata: {}, ttl: 86400000,
    })).rejects.toThrow('Unknown replicated stream')
  })

  it('handles resilience test not found', async () => {
    await expect(executeResilienceTest('nonexistent')).rejects.toThrow('not found')
  })

  it('handles duplicate event rejection', async () => {
    registerReplicatedStream({
      name: 'strict-stream', sourceRegion: 'us-east', targetRegions: ['eu-west'],
      status: 'active', ordering: 'strict', dedupWindowMs: 50000,
      replayPolicy: 'latest', lastSequence: 0, lastReplicatedAt: Date.now(),
      totalEvents: 0, totalDeduped: 0,
    })
    await replicateEvent({
      streamName: 'strict-stream', type: 'unique.event', source: 'src',
      sourceRegion: 'us-east', targetRegions: ['eu-west'],
      payload: { key: 'value' }, metadata: {}, ttl: 86400000,
    })
    await expect(replicateEvent({
      streamName: 'strict-stream', type: 'unique.event', source: 'src',
      sourceRegion: 'us-east', targetRegions: ['eu-west'],
      payload: { key: 'value' }, metadata: {}, ttl: 86400000,
    })).rejects.toThrow('Duplicate')
  })

  it('handles autoscale with disabled policy', async () => {
    registerAutoscalePolicy({
      id: 'disabled-policy', target: 'worker', minReplicas: 1, maxReplicas: 10,
      cooldownMs: 30000, scaleUpThreshold: 0.7, scaleDownThreshold: 0.3,
      scaleUpFactor: 1.5, scaleDownFactor: 0.5, metrics: ['load'], enabled: false,
    })
    const decision = await evaluateAutoscale('disabled-policy', 5)
    expect(decision.applied).toBe(false)
    expect(decision.reason).toBe('Policy disabled')
  })

  it('handles autoscale with unknown policy', async () => {
    const decision = await evaluateAutoscale('ghost-policy', 3)
    expect(decision.applied).toBe(false)
    expect(decision.reason).toContain('not found')
  })

  it('handles deletion of non-existent failover plan', () => {
    expect(getFailoverPlan('ghost-plan')).toBeUndefined()
  })

  it('handles governance policy with no metric data', () => {
    registerRuntimePolicy({
      id: 'no-metric-policy', name: 'No Metric', description: '',
      scope: 'global', targetIds: [],
      rules: [{ metric: 'undefined_metric', operator: '>', threshold: 0.5, windowMs: 1000, action: 'alert' }],
      severity: 'warning', enabled: true, createdAt: Date.now(), updatedAt: Date.now(),
    })
    const result = evaluatePolicy('no-metric-policy', { some_other_metric: 1 })
    expect(result.violated).toBe(false)
    expect(result.violations.length).toBe(0)
  })

  it('handles tenant quota with no quota defined', () => {
    const result = checkTenantQuota('undefined-tenant', 'Workers', 10)
    expect(result.allowed).toBe(true)
    expect(result.message).toBe('No quota defined')
  })

  it('handles region saturation with no policy', () => {
    const result = isRegionSaturated('nonexistent-region')
    expect(result.saturated).toBe(false)
  })

  it('handles queue saturation with no protection', () => {
    const result = checkQueueSaturation('unknown-queue', 100000, 50000)
    expect(result.saturated).toBe(false)
  })

  it('handles overload check with no protection registered', () => {
    const result = checkOverloadStatus('region', 'no-protection-region', 0.99, 0.99, 99999, 99999)
    expect(result.overloaded).toBe(false)
  })

  it('handles benchmark failure gracefully', async () => {
    const run = await runBenchmark({
      name: 'fast-bench', category: 'event_propagation',
      concurrency: 1, totalOperations: 1, durationSeconds: 0, payloadSize: 1, options: {},
    })
    expect(run.status).toBe('completed')
  })

  it('handles resource generation tracking correctly', () => {
    const r1 = applyResource(ResourceKind.QUEUE, 'gen-queue', {
      replicas: 1, spec: {}, labels: {}, annotations: {},
      createdAt: Date.now(), updatedAt: Date.now(),
    })
    expect(r1.generation).toBe(1)

    const r2 = applyResource(ResourceKind.QUEUE, 'gen-queue', {
      replicas: 3, spec: {}, labels: {}, annotations: {},
      createdAt: Date.now(), updatedAt: Date.now(),
    })
    expect(r2.generation).toBe(2)

    const r3 = applyResource(ResourceKind.QUEUE, 'gen-queue', {
      replicas: 5, spec: {}, labels: {}, annotations: {},
      createdAt: Date.now(), updatedAt: Date.now(),
    })
    expect(r3.generation).toBe(3)

    expect(getResource(ResourceKind.QUEUE, 'gen-queue')!.desired.replicas).toBe(5)
  })

  it('handles event query with no matches', () => {
    registerReplicatedStream({
      name: 'empty-stream', sourceRegion: 'us-east', targetRegions: ['eu-west'],
      status: 'active', ordering: 'strict', dedupWindowMs: 5000,
      replayPolicy: 'all', lastSequence: 0, lastReplicatedAt: Date.now(),
      totalEvents: 0, totalDeduped: 0,
    })
    const results = queryReplicatedEvents('empty-stream', { type: 'nonexistent' })
    expect(results.length).toBe(0)
  })
})
