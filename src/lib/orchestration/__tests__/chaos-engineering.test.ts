import { describe, it, expect, beforeEach } from 'vitest'

import {
  ResourceKind, ResourceStatus,
  registerControllerConfig, applyResource, getResource, updateObservedState,
  reconcileResource, deleteResource, listResources,
} from '../operator-runtime'

import {
  ReplicationRole,
  registerRegionMetadata, updateReplicationLag, getReplicationLag,
  registerReplicationCoordinator, listRegionMetadatas,
} from '../multi-region-coordinator'

import {
  setQueueSaturationProtection, getQueueSaturationProtection,
  registerOverloadProtection, registerRuntimePolicy,
} from '../runtime-governance'

import {
  registerAutoscalePolicy, getAutoscalePolicy, evaluateAutoscale,
} from '../autoscaler'

import {
  createFailoverPlan, executeFailoverPlan, listFailoverPlans,
} from '../failover-orchestrator'

import {
  updateNodeStatus, TopologyNodeStatus, registerClusterNode, listClusterNodes,
} from '../topology-engine'

import {
  listAnomalies, reportAnomaly,
} from '../operational-insights'

import {
  createChaosExperiment, getChaosExperiment, listChaosExperiments,
  runChaosExperiment, getChaosSummary, configureChaosStores,
} from '../chaos-engineering'

beforeEach(() => {
  for (const r of listResources()) deleteResource(r.ref.kind, r.ref.name)
  configureChaosStores({ chaosExperiments: new Map(), activeFaults: new Map() })
})

describe('Chaos Engineering Harness', () => {
  it('creates chaos experiments', () => {
    const experiment = createChaosExperiment('test-failover', [
      { type: 'region_failure', targetId: 'us-east', params: { markNodesOffline: true }, durationMs: 100, injectAt: Date.now() },
    ])
    expect(experiment.status).toBe('pending')
    expect(experiment.faults.length).toBe(1)

    const fetched = getChaosExperiment(experiment.id)
    expect(fetched).toBeDefined()
    expect(fetched!.name).toBe('test-failover')
  })

  it('lists chaos experiments by status', () => {
    createChaosExperiment('exp-1', [])
    createChaosExperiment('exp-2', [])

    const all = listChaosExperiments()
    expect(all.length).toBe(2)
    const pending = listChaosExperiments('pending')
    expect(pending.length).toBe(2)
  })

  it('runs resource failure chaos experiment with recovery', async () => {
    registerControllerConfig({
      kind: ResourceKind.WORKER, reconciliationIntervalMs: 10000,
      minReplicas: 1, maxReplicas: 10, cooldownMs: 30000,
      selfHeal: true, staleThresholdMs: 60000,
    })
    applyResource(ResourceKind.WORKER, 'chaos-worker', {
      replicas: 3, spec: {}, labels: {}, annotations: {},
      createdAt: Date.now(), updatedAt: Date.now(),
    })
    updateObservedState(ResourceKind.WORKER, 'chaos-worker', {
      availableReplicas: 3, readyReplicas: 3, status: ResourceStatus.RUNNING,
    })

    const experiment = createChaosExperiment('resource-failure-test', [
      {
        type: 'resource_failure',
        targetId: ResourceKind.WORKER,
        params: {
          name: 'chaos-worker',
          observedState: { availableReplicas: 3, readyReplicas: 3 },
        },
        durationMs: 20,
        injectAt: Date.now(),
      },
    ])

    const result = await runChaosExperiment(experiment.id)
    expect(result.status).toBe('completed')
    expect(result.results.length).toBe(1)
    expect(result.results[0].faultType).toBe('resource_failure')
    expect(result.results[0].recovered).toBe(true)
    expect(result.results[0].recoveryAction).toBe('self_heal')
  })

  it('runs region failure chaos experiment', async () => {
    registerRegionMetadata({
      regionId: 'us-east', name: 'US East', role: ReplicationRole.PRIMARY,
      endpoint: 'https://us-east.test.com', priority: 1, status: 'online',
      capabilities: ['read', 'write'], connectedRegions: ['eu-west'],
      latencyMs: 5, lastHealthCheck: Date.now(), version: '1.0',
    })
    registerRegionMetadata({
      regionId: 'eu-west', name: 'EU West', role: ReplicationRole.STANDBY,
      endpoint: 'https://eu-west.test.com', priority: 2, status: 'online',
      capabilities: ['read', 'write'], connectedRegions: ['us-east'],
      latencyMs: 65, lastHealthCheck: Date.now(), version: '1.0',
    })

    createFailoverPlan('regional', 'us-east', 'us-east', 'eu-west')

    const experiment = createChaosExperiment('region-failure-test', [
      {
        type: 'region_failure',
        targetId: 'us-east',
        params: { markNodesOffline: true },
        durationMs: 20,
        injectAt: Date.now(),
      },
    ])

    const result = await runChaosExperiment(experiment.id)
    expect(result.status).toBe('completed')
    expect(result.results[0].recovered).toBe(true)
    expect(result.results[0].recoveryAction).toBe('failover_executed')
  })

  it('runs replication lag spike chaos experiment', async () => {
    registerRegionMetadata({
      regionId: 'us-east', name: 'US East', role: ReplicationRole.PRIMARY,
      endpoint: '', priority: 1, status: 'online',
      capabilities: [], connectedRegions: ['eu-west'],
      latencyMs: 0, lastHealthCheck: Date.now(), version: '1.0',
    })
    registerRegionMetadata({
      regionId: 'eu-west', name: 'EU West', role: ReplicationRole.READ_REPLICA,
      endpoint: '', priority: 2, status: 'online',
      capabilities: [], connectedRegions: ['us-east'],
      latencyMs: 0, lastHealthCheck: Date.now(), version: '1.0',
    })
    registerReplicationCoordinator({
      sourceRegion: 'us-east', targetRegion: 'eu-west', streamName: 'events',
      status: 'active', lagMs: 50, lastReplicatedOffset: 'seq-100',
      lastReplicatedAt: Date.now(), bytesReplicated: 1024, errorCount: 0,
    })

    reportAnomaly('replication_lag_critical', 'critical', 'chaos', 'Injected lag spike', {})

    const experiment = createChaosExperiment('lag-spike-test', [
      {
        type: 'replication_lag_spike',
        targetId: 'us-east:eu-west:events',
        params: {
          sourceRegion: 'us-east', targetRegion: 'eu-west', streamName: 'events',
          lagMs: 10000, lagBytes: 99999,
        },
        durationMs: 20,
        injectAt: Date.now(),
      },
    ])

    const result = await runChaosExperiment(experiment.id)
    expect(result.status).toBe('completed')
    expect(result.results[0].injected).toBe(true)
    expect(result.results[0].detected).toBe(true)
    expect(result.results[0].recovered).toBe(true)
  })

  it('runs queue saturation chaos experiment', async () => {
    setQueueSaturationProtection('payroll-queue', {
      maxDepth: 1000, maxLatencyMs: 5000, backpressureThreshold: 0.8,
    })

    const experiment = createChaosExperiment('queue-saturation-test', [
      {
        type: 'queue_saturation',
        targetId: 'payroll-queue',
        params: { depth: 5000, latencyMs: 100, maxDepth: 1000, maxLatencyMs: 5000, backpressureThreshold: 0.8 },
        durationMs: 20,
        injectAt: Date.now(),
      },
    ])

    const result = await runChaosExperiment(experiment.id)
    expect(result.status).toBe('completed')
    expect(result.results[0].injected).toBe(true)
    expect(result.results[0].detected).toBe(true)
    expect(result.results[0].recovered).toBe(true)
    expect(result.results[0].recoveryAction).toBe('queue_drained')
  })

  it('runs autoscale throttle chaos experiment', async () => {
    registerAutoscalePolicy({
      id: 'chaos-autoscale', target: 'worker',
      minReplicas: 1, maxReplicas: 10, cooldownMs: 60000,
      scaleUpThreshold: 0.7, scaleDownThreshold: 0.2,
      scaleUpFactor: 1.5, scaleDownFactor: 0.5,
      metrics: ['load'], enabled: true,
    })

    const experiment = createChaosExperiment('autoscale-throttle-test', [
      {
        type: 'autoscale_throttle',
        targetId: 'chaos-autoscale',
        params: { metricName: 'load', metricValue: 0.95, metricCount: 5, currentReplicas: 5 },
        durationMs: 20,
        injectAt: Date.now(),
      },
    ])

    const result = await runChaosExperiment(experiment.id)
    expect(result.status).toBe('completed')
    expect(result.results[0].injected).toBe(true)
  })

  it('handles experiment with all fault types and provides summary', async () => {
    registerControllerConfig({
      kind: ResourceKind.WORKER, reconciliationIntervalMs: 10000,
      minReplicas: 1, maxReplicas: 10, cooldownMs: 30000,
      selfHeal: true, staleThresholdMs: 60000,
    })
    applyResource(ResourceKind.WORKER, 'multi-chaos-worker', {
      replicas: 2, spec: {}, labels: {}, annotations: {},
      createdAt: Date.now(), updatedAt: Date.now(),
    })
    updateObservedState(ResourceKind.WORKER, 'multi-chaos-worker', {
      availableReplicas: 2, readyReplicas: 2, status: ResourceStatus.RUNNING,
    })

    registerRegionMetadata({
      regionId: 'us-east', name: 'US East', role: ReplicationRole.PRIMARY,
      endpoint: '', priority: 1, status: 'online',
      capabilities: [], connectedRegions: ['eu-west'],
      latencyMs: 0, lastHealthCheck: Date.now(), version: '1.0',
    })
    createFailoverPlan('regional', 'us-east', 'us-east', 'eu-west')

    registerReplicationCoordinator({
      sourceRegion: 'us-east', targetRegion: 'eu-west', streamName: 'multi-stream',
      status: 'active', lagMs: 50, lastReplicatedOffset: 'seq-50',
      lastReplicatedAt: Date.now(), bytesReplicated: 512, errorCount: 0,
    })
    reportAnomaly('replication_lag_critical', 'critical', 'chaos', 'Injected', {})

    setQueueSaturationProtection('multi-queue', {
      maxDepth: 500, maxLatencyMs: 2000, backpressureThreshold: 0.8,
    })

    registerAutoscalePolicy({
      id: 'multi-chaos-autoscale', target: 'worker',
      minReplicas: 1, maxReplicas: 10, cooldownMs: 60000,
      scaleUpThreshold: 0.7, scaleDownThreshold: 0.2,
      scaleUpFactor: 1.5, scaleDownFactor: 0.5,
      metrics: ['load'], enabled: true,
    })

    const experiment = createChaosExperiment('full-chaos', [
      {
        type: 'resource_failure', targetId: ResourceKind.WORKER,
        params: { name: 'multi-chaos-worker', observedState: { availableReplicas: 2, readyReplicas: 2 } },
        durationMs: 20, injectAt: Date.now(),
      },
      {
        type: 'region_failure', targetId: 'us-east',
        params: { markNodesOffline: false },
        durationMs: 20, injectAt: Date.now(),
      },
      {
        type: 'replication_lag_spike', targetId: 'multi-stream',
        params: { sourceRegion: 'us-east', targetRegion: 'eu-west', streamName: 'multi-stream', lagMs: 9999, lagBytes: 99999 },
        durationMs: 20, injectAt: Date.now(),
      },
      {
        type: 'queue_saturation', targetId: 'multi-queue',
        params: { depth: 50000, latencyMs: 500, maxDepth: 500, maxLatencyMs: 2000, backpressureThreshold: 0.8 },
        durationMs: 20, injectAt: Date.now(),
      },
      {
        type: 'autoscale_throttle', targetId: 'multi-chaos-autoscale',
        params: { metricName: 'load', metricValue: 0.95, metricCount: 3, currentReplicas: 3 },
        durationMs: 20, injectAt: Date.now(),
      },
    ])

    const result = await runChaosExperiment(experiment.id)
    expect(result.results.length).toBe(5)

    const recovered = result.results.filter(r => r.recovered).length
    expect(recovered).toBeGreaterThanOrEqual(3)

    const summary = getChaosSummary()
    expect(summary.totalExperiments).toBeGreaterThan(0)
    expect(summary.totalFaults).toBeGreaterThan(0)
    expect(summary.passRate).toBeGreaterThan(0)
  }, 15000)

  it('handles non-existent experiment', async () => {
    await expect(runChaosExperiment('nonexistent')).rejects.toThrow('not found')
  })

  it('handles experiment with no faults', async () => {
    const experiment = createChaosExperiment('empty-experiment', [])
    const result = await runChaosExperiment(experiment.id)
    expect(result.status).toBe('completed')
    expect(result.results.length).toBe(0)
  })

  it('handles resource failure fault without registered resource', async () => {
    const experiment = createChaosExperiment('ghost-resource', [
      {
        type: 'resource_failure', targetId: ResourceKind.WORKER,
        params: { name: 'nonexistent' },
        durationMs: 10, injectAt: Date.now(),
      },
    ])
    const result = await runChaosExperiment(experiment.id)
    expect(result.results[0].injected).toBe(false)
    expect(result.results[0].recovered).toBe(false)
  })

  it('handles autoscale throttle without registered policy', async () => {
    const experiment = createChaosExperiment('ghost-autoscale', [
      {
        type: 'autoscale_throttle', targetId: 'ghost-policy',
        params: { metricName: 'load', metricValue: 0.95, metricCount: 3, currentReplicas: 3 },
        durationMs: 10, injectAt: Date.now(),
      },
    ])
    const result = await runChaosExperiment(experiment.id)
    expect(result.results[0].injected).toBe(false)
  })
})
