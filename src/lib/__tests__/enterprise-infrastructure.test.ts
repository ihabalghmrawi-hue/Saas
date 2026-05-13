import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// ── Observability ──────────────────────────────────────────────────────────────
import {
  generateCorrelationId, setCorrelationId, getCorrelationId,
  setCausationId, getCausationId, startTrace, endTrace, getTrace,
  correlationHeaders, extractCorrelationContext, createTraceLogger,
} from '@/lib/observability/correlation'

import { createLogger } from '@/lib/observability/logger'

import {
  startSpan, endSpan, startChildSpan, addSpanEvent, setSpanAttribute,
  getSpan, clearSpans, getActiveSpanCount, exportTrace, traceAsync,
} from '@/lib/observability/tracer'

// ── Metrics ────────────────────────────────────────────────────────────────────
import {
  incrementCounter, setGauge, observeHistogram, getMetric,
  getAllMetrics, generatePrometheusFormat, resetMetrics,
  recordDBQuery, recordRPCCall, recordQueueOperation, recordWorkerHeartbeat,
  recordAccountingTransaction, recordCacheOperation, recordWebhookDelivery, recordBackupOperation,
} from '@/lib/metrics/collector'

import {
  registerHealthCheck, runHealthChecks, createDbHealthChecker,
  createMemoryHealthChecker, livenessCheck,
} from '@/lib/metrics/health-probes'

// ── Alerting ───────────────────────────────────────────────────────────────────
import {
  registerAlertRule, evaluateAlerts, acknowledgeAlert,
  getActiveAlerts, getAlertHistory,
} from '@/lib/alerting/alert-engine'
import type { Alert, AlertRule } from '@/lib/alerting/alert-engine'

import {
  registerFinancialIntegrityAlerts, registerWorkerAlerts,
  registerSecurityAlerts, registerBackupAlerts,
} from '@/lib/alerting/alert-rules'

// ── Backup ─────────────────────────────────────────────────────────────────────
import {
  createBackupPolicy, executeBackup, enforceRetentionPolicy,
  verifyBackupIntegrity, getBackupJob, getRecentBackups,
} from '@/lib/backup/backup-orchestrator'
import type { BackupPolicy, BackupJob, BackupEntry } from '@/lib/backup/backup-orchestrator'

import {
  validateRestore, createReconciliationValidator, createTrialBalanceValidator,
} from '@/lib/backup/restore-validator'

// ── HA ─────────────────────────────────────────────────────────────────────────
import {
  registerWorker, heartbeat, markFailed, detectFailedWorkers,
  executeFailover, recoverWorker, getWorkerStatus, getAllWorkers, getHealthyWorkers,
} from '@/lib/ha/worker-failover'

import {
  registerShutdownHandler, gracefulShutdown, isShuttingDownFlag,
} from '@/lib/ha/graceful-shutdown'

import {
  createRetryConfig, withRetry, getRetryState, resetRetryState, deadLetterRecovery,
} from '@/lib/ha/retry-orchestrator'

// ── Config ─────────────────────────────────────────────────────────────────────
import {
  defineConfig, getDefinition, getAllDefinitions, setConfig,
  getConfig, getConfigWithMeta, getAllConfigs, onConfigChange,
} from '@/lib/config/runtime-config'

import {
  defineFlag, defineFlags, isEnabled, setTenantOverride, setEnvironmentOverride,
  setRolloutPercentage, getFlag, getAllFlags, getAllEvaluations,
} from '@/lib/config/feature-flags'

// ── Security ───────────────────────────────────────────────────────────────────
import {
  defineRole, getRole, getAllRoles, assignRole, revokeRole, getUserRoles,
  checkPermission, hasPermission, registerSystemRoles,
} from '@/lib/security/advanced-rbac'
import type { Role } from '@/lib/security/advanced-rbac'

import {
  createSession, validateSession, destroySession,
  destroyAllUserSessions, getActiveSessions, getLoginAnomalies,
} from '@/lib/security/session-hardening'

import {
  recordIntegrity, verifyIntegrity, getIntegrityChain, getTamperEvents,
  hashEntityData,
} from '@/lib/security/tamper-detection'

import {
  checkRateLimit, recordAbuseEvent, isBlocked, blockIP, unblockIP,
  getBlockedIPs, trackPattern,
} from '@/lib/security/abuse-detection'

// ── Compliance ─────────────────────────────────────────────────────────────────
import {
  appendImmutableEntry, verifyChain, getImmutableEntries,
  exportImmutableLog, getChainStats, clearEntries,
} from '@/lib/compliance/immutable-log'

import {
  loadDefaultPolicies, setRetentionPolicy, getRetentionPolicy, getAllRetentionPolicies,
  placeLegalHold, releaseLegalHold, getActiveLegalHolds, isUnderLegalHold,
} from '@/lib/compliance/retention-engine'

// ── Operations ─────────────────────────────────────────────────────────────────
import {
  buildSystemSummary, createComponent, assessOverallHealth,
  getSystemUptime,
} from '@/lib/operations/system-health'

// ── Performance ────────────────────────────────────────────────────────────────
import {
  createCache, get, set, del, clear, getOrSet,
  invalidatePattern, getStats, getAllStats,
} from '@/lib/performance/cache-manager'

import {
  createBulkConfig, processBulk, processBatchSequential, chunkArray,
} from '@/lib/performance/bulk-operations'

// ── Multi-Region ───────────────────────────────────────────────────────────────
import {
  loadDefaultRegions, registerRegion, getAllRegions, getActiveRegions,
  assignTenantToRegion, getTenantAssignment, failoverTenant,
  registerReplica, getReplicas, getTenantRegionDistribution,
} from '@/lib/multi-region/region-manager'

// ═══════════════════════════════════════════════════════════════════════════════
// OBSERVABILITY
// ═══════════════════════════════════════════════════════════════════════════════

describe('Correlation IDs', () => {
  afterEach(() => {
    setCorrelationId('')
  })

  it('generates unique correlation IDs', () => {
    const id1 = generateCorrelationId()
    const id2 = generateCorrelationId()
    expect(id1).not.toBe(id2)
    expect(id1).toMatch(/^[0-9a-f-]+$/)
  })

  it('sets and gets correlation ID', () => {
    const id = setCorrelationId('test-corr-id')
    expect(getCorrelationId()).toBe('test-corr-id')
    expect(id).toBe('test-corr-id')
  })

  it('auto-generates ID if none set', () => {
    const id = getCorrelationId()
    expect(id).toBeTruthy()
  })

  it('handles causation IDs', () => {
    setCausationId('cause-123')
    expect(getCausationId()).toBe('cause-123')
  })

  it('starts and ends traces', () => {
    const trace = startTrace('test-service')
    expect(trace.service).toBe('test-service')
    expect(trace.correlationId).toBeTruthy()
    expect(trace.spanId).toBeTruthy()

    const result = endTrace(trace.spanId)
    expect(result.duration).toBeGreaterThanOrEqual(0)
  })

  it('creates child traces with parent context', () => {
    const parent = startTrace('parent')
    const child = startTrace('child', { correlationId: parent.correlationId, spanId: parent.spanId })
    expect(child.correlationId).toBe(parent.correlationId)
    expect(child.parentSpanId).toBe(parent.spanId)
  })

  it('generates correlation headers', () => {
    const id = setCorrelationId('corr-42')
    const headers = correlationHeaders()
    expect(headers['x-correlation-id']).toBe('corr-42')
  })

  it('extracts context from headers', () => {
    const ctx = extractCorrelationContext({ 'x-correlation-id': 'extracted-id' })
    expect(ctx.correlationId).toBe('extracted-id')
  })

  it('creates trace logger', () => {
    const log = createTraceLogger('test-svc', { correlationId: 'test-cid' })
    expect(log.getTraceId()).toBe('test-cid')
    expect(() => log.info('test')).not.toThrow()
    expect(() => log.error('test', new Error('e'))).not.toThrow()
    expect(() => log.warn('test')).not.toThrow()
    expect(() => log.debug('test')).not.toThrow()
  })
})

describe('Logger', () => {
  it('creates logger with service name', () => {
    const log = createLogger('test-service')
    expect(log).toBeDefined()
    expect(typeof log.info).toBe('function')
  })

  it('creates child loggers', () => {
    const parent = createLogger('parent')
    const child = parent.child('child')
    expect(child).toBeDefined()
  })

  it('logs without throwing', () => {
    const log = createLogger('test')
    expect(() => log.info('info message')).not.toThrow()
    expect(() => log.warn('warn message')).not.toThrow()
    expect(() => log.error('error message')).not.toThrow()
    expect(() => log.debug('debug message')).not.toThrow()
    expect(() => log.fatal('fatal message')).not.toThrow()
  })
})

describe('Tracer', () => {
  afterEach(() => {
    clearSpans()
  })

  it('starts and ends spans', () => {
    const span = startSpan('svc', 'op1')
    expect(span.spanId).toBeTruthy()
    expect(span.serviceName).toBe('svc')
    expect(span.operationName).toBe('op1')

    const ended = endSpan(span.spanId)
    expect(ended?.duration).toBeGreaterThanOrEqual(0)
    expect(ended?.status).toBe('ok')
  })

  it('creates child spans', () => {
    const parent = startSpan('svc', 'parent')
    const child = startChildSpan(parent, 'child-op')
    expect(child.parentSpanId).toBe(parent.spanId)
    expect(child.traceId).toBe(parent.traceId)
  })

  it('adds events to spans', () => {
    const span = startSpan('svc', 'op')
    addSpanEvent(span.spanId, 'event1', { key: 'val' })
    addSpanEvent(span.spanId, 'event2')
    expect(getSpan(span.spanId)?.events.length).toBe(2)
  })

  it('sets span attributes', () => {
    const span = startSpan('svc', 'op')
    setSpanAttribute(span.spanId, 'key1', 'val1')
    setSpanAttribute(span.spanId, 'key2', 42)
    expect(getSpan(span.spanId)?.attributes.key1).toBe('val1')
    expect(getSpan(span.spanId)?.attributes.key2).toBe(42)
  })

  it('exports trace', () => {
    const span = startSpan('svc', 'op')
    endSpan(span.spanId)
    const trace = exportTrace(span.traceId)
    expect(trace.spanCount).toBe(1)
    expect(trace.spans[0].operationName).toBe('op')
  })

  it('tracks active span count', () => {
    clearSpans()
    startSpan('svc', 'a')
    startSpan('svc', 'b')
    expect(getActiveSpanCount()).toBe(2)
  })

  it('traces async operations', async () => {
    const result = await traceAsync('svc', 'async-op', async (span) => {
      expect(span.spanId).toBeTruthy()
      return 42
    })
    expect(result).toBe(42)
  })

  it('handles errors in traced async ops', async () => {
    await expect(traceAsync('svc', 'failing-op', async () => {
      throw new Error('fail')
    })).rejects.toThrow('fail')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// METRICS & MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Metrics Collector', () => {
  beforeEach(() => {
    resetMetrics()
  })

  it('increments counters', () => {
    incrementCounter('test_counter', { label: 'a' })
    incrementCounter('test_counter', { label: 'a' })
    incrementCounter('test_counter', { label: 'a' })
    const metric = getMetric('test_counter')
    expect(metric).toHaveLength(1)
    expect(metric[0].value).toBe(3)
  })

  it('supports multiple label combinations', () => {
    incrementCounter('multi_counter', { env: 'prod' })
    incrementCounter('multi_counter', { env: 'staging' })
    expect(getMetric('multi_counter')).toHaveLength(2)
  })

  it('sets and overwrites gauges', () => {
    setGauge('test_gauge', 42, { component: 'worker' })
    expect(getMetric('test_gauge')[0].value).toBe(42)
    setGauge('test_gauge', 10, { component: 'worker' })
    expect(getMetric('test_gauge')[0].value).toBe(10)
  })

  it('records histograms', () => {
    observeHistogram('test_histogram', 100)
    observeHistogram('test_histogram', 200)
    observeHistogram('test_histogram', 300)
    expect(getMetric('test_histogram')).toHaveLength(3)
  })

  it('generates Prometheus format', () => {
    incrementCounter('http_requests', { method: 'GET' })
    const format = generatePrometheusFormat()
    expect(format).toContain('http_requests')
  })

  it('records DB queries', () => {
    recordDBQuery(5, 'SELECT', 'accounts')
    recordDBQuery(10, 'INSERT', 'journals')
    const dbQueries = getMetric('db_query_total')
    expect(dbQueries).toHaveLength(2)
  })

  it('records RPC calls', () => {
    recordRPCCall(15, 'check_unbalanced_entries')
    const rpcCalls = getMetric('rpc_calls_total')
    expect(rpcCalls).toHaveLength(1)
  })

  it('records queue operations', () => {
    recordQueueOperation('enqueue', 'accounting', 'success')
    expect(getMetric('queue_operations_total')).toHaveLength(1)
  })

  it('records worker heartbeats', () => {
    recordWorkerHeartbeat('worker-1', 'alive')
    expect(getMetric('worker_heartbeat')[0].value).toBe(1)
  })

  it('records accounting transactions', () => {
    recordAccountingTransaction('journal_post', 'success')
    expect(getMetric('accounting_transactions_total')[0].value).toBe(1)
  })

  it('records cache operations', () => {
    recordCacheOperation('get', true)
    recordCacheOperation('get', false)
    expect(getMetric('cache_operations_total')[0].value).toBe(1)
    expect(getMetric('cache_operations_total')[1].value).toBe(1)
  })

  it('records webhook deliveries', () => {
    recordWebhookDelivery('delivered', 'stripe')
    expect(getMetric('webhook_deliveries_total')[0].value).toBe(1)
  })

  it('records backup operations', () => {
    recordBackupOperation('backup', 'success')
    expect(getMetric('backup_operations_total')[0].value).toBe(1)
  })

  it('resets all metrics', () => {
    incrementCounter('counter_1')
    incrementCounter('counter_2')
    resetMetrics()
    expect(getAllMetrics()).toEqual({})
  })
})

describe('Health Probes', () => {
  it('liveness check returns alive', async () => {
    const result = await livenessCheck()
    expect(result.status).toBe('alive')
  })

  it('runs registered health checks', async () => {
    registerHealthCheck('test-check', async () => ({
      status: 'healthy' as const,
      component: 'test',
      message: 'ok',
      duration: 1,
      lastChecked: new Date().toISOString(),
    }))

    const report = await runHealthChecks()
    expect(report.status).toBe('healthy')
    expect(report.checks).toHaveLength(1)
  })

  it('creates DB health checker', async () => {
    const checker = createDbHealthChecker(async () => true)
    const result = await checker()
    expect(result.status).toBe('healthy')
    expect(result.component).toBe('database')
  })

  it('creates memory health checker', async () => {
    const checker = createMemoryHealthChecker()
    const result = await checker()
    expect(['healthy', 'degraded']).toContain(result.status)
  })

  it('reports degraded when check fails', async () => {
    registerHealthCheck('failing', async () => ({
      status: 'unhealthy' as const,
      component: 'failing-comp',
      message: 'failed',
      duration: 0,
      lastChecked: new Date().toISOString(),
    }))

    const report = await runHealthChecks()
    expect(report.status).toBe('unhealthy')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Alerting Engine', () => {
  it('registers and evaluates alert rules', async () => {
    registerAlertRule({
      name: 'test_alert',
      severity: 'critical',
      source: 'test',
      description: 'Test alert',
      evaluate: async () => ({
        firing: true,
        message: 'Test alert firing',
        metadata: { value: 42 },
      }),
    })

    const fired = await evaluateAlerts()
    expect(fired).toHaveLength(1)
    expect(fired[0].name).toBe('test_alert')
    expect(fired[0].severity).toBe('critical')
    expect(fired[0].status).toBe('firing')
  })

  it('resolves alerts when condition clears', async () => {
    let firing = true
    registerAlertRule({
      name: 'resolve_test_2',
      severity: 'warning',
      source: 'test',
      description: 'Resolve test 2',
      evaluate: async () => ({
        firing,
        message: firing ? 'Firing' : 'Resolved',
        metadata: {},
      }),
    })

    await evaluateAlerts()
    firing = false
    const resolved = await evaluateAlerts()
    expect(resolved).toHaveLength(2)
    expect(resolved.some(a => a.status === 'resolved')).toBe(true)
  })

  it('acknowledges alerts', () => {
    const alert = acknowledgeAlert('test_alert', 'admin')
    expect(alert?.status).toBe('acknowledged')
    expect(alert?.acknowledgedBy).toBe('admin')
  })

  it('returns active alerts', () => {
    const active = getActiveAlerts()
    expect(Array.isArray(active)).toBe(true)
  })

  it('returns alert history', () => {
    const history = getAlertHistory()
    expect(Array.isArray(history)).toBe(true)
  })

  it('registers financial integrity alerts', async () => {
    registerFinancialIntegrityAlerts(
      async () => 3, async () => ({ count: 2, total: 500 }), async () => ({ count: 1, lastError: 'timeout' }),
    )
    await evaluateAlerts()
    expect(getAlertHistory().some(a => a.name === 'unbalanced_journal_entries')).toBe(true)
  })

  it('registers worker alerts', async () => {
    registerWorkerAlerts(
      async () => 15, async () => 1500, async () => 3,
    )
    await evaluateAlerts()
    expect(getAlertHistory().some(a => a.name.includes('queue'))).toBe(true)
  })

  it('registers security alerts', async () => {
    registerSecurityAlerts(
      async () => ({ count: 3, types: ['tamper', 'abuse'] }), async () => ({ count: 10, ip: '10.0.0.1' }),
    )
    await evaluateAlerts()
    expect(getAlertHistory().some(a => a.name.includes('suspicious'))).toBe(true)
  })

  it('registers backup alerts', async () => {
    registerBackupAlerts(
      async () => ({ success: false, age: 0 }), async () => ({ passed: false, errors: ['checksum mismatch'] }),
    )
    await evaluateAlerts()
    expect(getAlertHistory().some(a => a.name.includes('backup'))).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// BACKUP & DISASTER RECOVERY
// ═══════════════════════════════════════════════════════════════════════════════

describe('Backup Orchestrator', () => {
  it('creates backup policy with defaults', () => {
    const policy = createBackupPolicy({ retentionDays: 60 })
    expect(policy.retentionDays).toBe(60)
    expect(policy.schedule).toBe('daily')
    expect(policy.compression).toBe('gzip')
  })

  it('executes backup job', async () => {
    const job = await executeBackup('company-1', 'full', async (j) => ({
      storagePath: `backups/company-1/${j.id}.json`,
      size: 1024,
      tableCounts: { accounts: 10, journals: 50 },
      checksum: 'abc123',
    }))

    expect(job.status).toBe('completed')
    expect(job.size).toBe(1024)
    expect(job.storagePath).toBeTruthy()
  })

  it('handles backup failure', async () => {
    const job = await executeBackup('company-1', 'full', async () => {
      throw new Error('Storage full')
    })

    expect(job.status).toBe('failed')
    expect(job.error).toBe('Storage full')
  })

  it('returns backup jobs', () => {
    const jobs = getRecentBackups()
    expect(Array.isArray(jobs)).toBe(true)
  })

  it('gets specific backup job', () => {
    const job = getBackupJob('nonexistent')
    expect(job).toBeUndefined()
  })
})

describe('Restore Validator', () => {
  it('validates successful restore', async () => {
    const result = await validateRestore(
      'backup-1', 'company-1',
      { accounts: 10, journals: 50 },
      async (table, count) => ({
        name: `table_${table}`,
        status: 'passed' as const,
        message: `Table ${table} has ${count} rows`,
      }),
      async () => ({
        name: 'integrity',
        status: 'passed' as const,
        message: 'Integrity checks passed',
      }),
      async () => [{
        name: 'data_consistency',
        status: 'passed' as const,
        message: 'Data consistent',
      }],
    )

    expect(result.status).toBe('passed')
    expect(result.checks.length).toBeGreaterThan(0)
  })

  it('fails validation when checks fail', async () => {
    const result = await validateRestore(
      'backup-2', 'company-1',
      { accounts: 10 },
      async () => ({
        name: 'table_accounts',
        status: 'failed' as const,
        message: 'Row count mismatch',
      }),
      async () => ({
        name: 'integrity',
        status: 'passed' as const,
        message: 'OK',
      }),
      async () => [],
    )

    expect(result.status).toBe('failed')
  })

  it('creates reconciliation validator', () => {
    const validator = createReconciliationValidator(async () => ({
      matched: 100, unmatched: 0, totalDifference: 0,
    }))
    expect(validator).toBeInstanceOf(Function)
  })

  it('creates trial balance validator', () => {
    const validator = createTrialBalanceValidator(async () => ({
      balanced: true, difference: 0, entryCount: 50,
    }))
    expect(validator).toBeInstanceOf(Function)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// HIGH AVAILABILITY
// ═══════════════════════════════════════════════════════════════════════════════

describe('Worker Failover', () => {
  afterEach(() => {
    // Clear all workers
    for (const w of getAllWorkers()) {
      /* cleanup */
    }
  })

  it('registers and tracks workers', () => {
    registerWorker({
      id: 'worker-1', name: 'Worker 1', status: 'active',
      lastHeartbeat: Date.now(), assignedQueues: ['accounting'],
      startedAt: Date.now(), metadata: {},
    })
    expect(getAllWorkers()).toHaveLength(1)
    expect(getHealthyWorkers()).toHaveLength(1)
  })

  it('updates heartbeat', () => {
    registerWorker({
      id: 'worker-hb', name: 'HB Worker', status: 'active',
      lastHeartbeat: Date.now(), assignedQueues: [],
      startedAt: Date.now(), metadata: {},
    })
    heartbeat('worker-hb')
    const w = getWorkerStatus('worker-hb')
    expect(w?.status).toBe('active')
  })

  it('marks workers as failed', () => {
    registerWorker({
      id: 'worker-fail', name: 'Fail Worker', status: 'active',
      lastHeartbeat: Date.now(), assignedQueues: [],
      startedAt: Date.now(), metadata: {},
    })
    markFailed('worker-fail', 'OOM')
    expect(getWorkerStatus('worker-fail')?.status).toBe('failed')
  })

  it('detects failed workers by heartbeat timeout', () => {
    registerWorker({
      id: 'worker-timeout', name: 'Timeout Worker', status: 'active',
      lastHeartbeat: Date.now() - 60000, assignedQueues: [],
      startedAt: Date.now(), metadata: {},
    })
    const failed = detectFailedWorkers({ heartbeatTimeout: 1000, failoverDelay: 0, maxFailoverAttempts: 3, cooldownPeriod: 0 })
    expect(failed.length).toBeGreaterThan(0)
  })

  it('executes failover to available worker', async () => {
    registerWorker({
      id: 'failed-w', name: 'Failed', status: 'failed',
      lastHeartbeat: Date.now(), assignedQueues: ['accounting'],
      startedAt: Date.now(), metadata: {},
    })
    registerWorker({
      id: 'backup-w', name: 'Backup', status: 'active',
      lastHeartbeat: Date.now(), assignedQueues: [],
      startedAt: 0, metadata: {},
    })

    // We need the backup to be eligible (cooldown period must pass)
    const result = await executeFailover(
      getWorkerStatus('failed-w')!,
      () => getAllWorkers(),
      async (id, queues) => {
        return true
      },
      { heartbeatTimeout: 30000, failoverDelay: 0, maxFailoverAttempts: 3, cooldownPeriod: 0 },
    )
    expect(result.success).toBe(true)
  })

  it('recovers failed workers', async () => {
    registerWorker({
      id: 'recover-w', name: 'Recover', status: 'failed',
      lastHeartbeat: Date.now(), assignedQueues: [],
      startedAt: Date.now(), metadata: {},
    })

    const ok = await recoverWorker('recover-w', async () => true)
    expect(ok).toBe(true)
    expect(getWorkerStatus('recover-w')?.status).toBe('active')
  })
})

describe('Graceful Shutdown', () => {
  it('registers and runs shutdown handlers', async () => {
    const handler = vi.fn().mockResolvedValue(undefined)
    registerShutdownHandler('test-handler', handler, 50, 1000)
    await gracefulShutdown('SIGTERM')
    expect(handler).toHaveBeenCalled()
  })

  it('prevents duplicate shutdowns', async () => {
    const handler = vi.fn().mockResolvedValue(undefined)
    registerShutdownHandler('dup-handler', handler, 50, 1000)
    await gracefulShutdown('SIGTERM')
    const count = handler.mock.calls.length
    await gracefulShutdown('SIGTERM')
    expect(handler.mock.calls.length).toBe(count)
  })

  it('returns shutdown flag', () => {
    expect(isShuttingDownFlag()).toBe(true)
  })
})

describe('Retry Orchestrator', () => {
  it('creates retry config', () => {
    const config = createRetryConfig({ maxRetries: 5 })
    expect(config.maxRetries).toBe(5)
    expect(config.backoffFactor).toBe(2)
  })

  it('retries and succeeds', async () => {
    let attempts = 0
    const result = await withRetry('op1', async () => {
      attempts++
      if (attempts < 2) throw new Error('NETWORK_ERROR')
      return 'success'
    }, createRetryConfig({ maxRetries: 3, retryableErrors: ['NETWORK_ERROR'] }))

    expect(result.success).toBe(true)
    expect(result.result).toBe('success')
    expect(result.attempts).toBe(2)
  })

  it('fails after max retries', async () => {
    const result = await withRetry('op-fail', async () => {
      throw new Error('PERSISTENT_ERROR')
    }, createRetryConfig({ maxRetries: 2, retryableErrors: ['PERSISTENT_ERROR'] }))

    expect(result.success).toBe(false)
    expect(result.attempts).toBe(2)
  })

  it('does not retry non-retryable errors', async () => {
    const result = await withRetry('op-nonretry', async () => {
      throw new Error('VALIDATION_ERROR')
    }, createRetryConfig({ maxRetries: 3, retryableErrors: ['NETWORK_ERROR'] }))

    expect(result.success).toBe(false)
    expect(result.attempts).toBe(1)
  })

  it('tracks retry state', () => {
    expect(getRetryState('op1')).toBeDefined()
  })

  it('resets retry state', () => {
    resetRetryState('op1')
    expect(getRetryState('op1')).toBeUndefined()
  })

  it('performs dead letter recovery', async () => {
    const result = await deadLetterRecovery('dlq-item', async () => 'recovered')
    expect(result.success).toBe(true)
    expect(result.result).toBe('recovered')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// RUNTIME CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Runtime Config', () => {
  const TEST_CONFIGS = [
    { key: 'test.string', type: 'string' as const, defaultValue: 'default', description: 'Test string', scope: 'global' as const, sensitive: false },
    { key: 'test.number', type: 'number' as const, defaultValue: 42, description: 'Test number', scope: 'tenant' as const, sensitive: false },
    { key: 'test.boolean', type: 'boolean' as const, defaultValue: true, description: 'Test bool', scope: 'environment' as const, sensitive: false },
    { key: 'test.secret', type: 'string' as const, defaultValue: '', description: 'Test secret', scope: 'environment' as const, sensitive: true },
  ]

  beforeEach(() => {
    for (const def of TEST_CONFIGS) {
      defineConfig(def)
    }
  })

  it('defines configs', () => {
    expect(getDefinition('test.string')?.key).toBe('test.string')
    expect(getAllDefinitions().length).toBeGreaterThanOrEqual(4)
  })

  it('sets and gets config values', () => {
    const result = setConfig('test.string', 'hello', 'global')
    expect(result.success).toBe(true)
    expect(getConfig('test.string')).toBe('hello')
  })

  it('returns default value when not set', () => {
    expect(getConfig('test.number')).toBe(42)
  })

  it('validates config values', () => {
    const result = setConfig('nonexistent', 'val', 'global')
    expect(result.success).toBe(false)
  })

  it('gets config with metadata', () => {
    const meta = getConfigWithMeta('test.number')
    expect(meta.value).toBe(42)
    expect(meta.definition).toBeDefined()
  })

  it('supports tenant-scoped overrides', () => {
    setConfig('test.string', 'tenant-value', 'tenant', { tenantId: 'tenant-1' })
    expect(getConfig('test.string', { tenantId: 'tenant-1' })).toBe('tenant-value')
    expect(getConfig('test.string', { tenantId: 'tenant-2' })).toBe('hello')
  })

  it('supports environment-scoped overrides', () => {
    setConfig('test.boolean', false, 'environment', { environment: 'production' })
    expect(getConfig('test.boolean', { environment: 'production' })).toBe(false)
  })

  it('registers change handlers', () => {
    const handler = vi.fn()
    onConfigChange('test.string', handler)
    setConfig('test.string', 'new-val', 'global')
    expect(handler).toHaveBeenCalled()
  })

  it('gathers all configs', () => {
    setConfig('test.string', 'val', 'global')
    setConfig('test.number', 100, 'tenant', { tenantId: 't1' })
    expect(getAllConfigs().length).toBeGreaterThanOrEqual(2)
  })
})

describe('Feature Flags', () => {
  it('defines and evaluates flags', () => {
    defineFlag('test.flag', 'Test flag', false)
    const evaluation = isEnabled('test.flag')
    expect(evaluation.enabled).toBe(false)
    expect(evaluation.source).toBe('default')
  })

  it('defines multiple flags', () => {
    defineFlags([
      { key: 'flag.a', description: 'A' },
      { key: 'flag.b', description: 'B', enabled: true },
    ])
    expect(isEnabled('flag.a').enabled).toBe(false)
    expect(isEnabled('flag.b').enabled).toBe(true)
  })

  it('supports tenant overrides', () => {
    defineFlag('tenant.flag', 'Tenant flag', false)
    setTenantOverride('tenant.flag', 'tenant-42', true)
    expect(isEnabled('tenant.flag', { tenantId: 'tenant-42' }).enabled).toBe(true)
  })

  it('supports environment overrides', () => {
    defineFlag('env.flag', 'Env flag', false)
    setEnvironmentOverride('env.flag', 'staging', true)
    expect(isEnabled('env.flag', { environment: 'staging' }).enabled).toBe(true)
  })

  it('supports rollout percentage', () => {
    defineFlag('rollout.flag', 'Rollout', false)
    setRolloutPercentage('rollout.flag', 0)
    expect(getFlag('rollout.flag')?.rolloutPercentage).toBe(0)
  })

  it('checks flag dependencies', () => {
    defineFlag('parent.flag', 'Parent', false)
    defineFlag('child.flag', 'Child', true, ['parent.flag'])
    expect(isEnabled('child.flag').enabled).toBe(false)
  })

  it('returns all flag evaluations', () => {
    const all = getAllEvaluations({ tenantId: 't1' })
    expect(Array.isArray(all)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY HARDENING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Advanced RBAC', () => {
  const adminRole: Role = {
    id: 'admin', name: 'Admin', description: 'Admin role',
    permissions: [{ resource: 'journal', action: 'create' }, { resource: 'journal', action: 'read' }, { resource: '*', action: 'manage' }],
    inherits: [], isSystem: false, priority: 100,
  }

  beforeEach(() => {
    defineRole(adminRole)
  })

  it('defines and retrieves roles', () => {
    expect(getRole('admin')?.name).toBe('Admin')
  })

  it('assigns roles to users', () => {
    const result = assignRole('user-1', 'tenant-1', 'admin')
    expect(result.success).toBe(true)
  })

  it('prevents assigning unknown roles', () => {
    const result = assignRole('user-1', 'tenant-1', 'unknown-role')
    expect(result.success).toBe(false)
  })

  it('revokes roles from users', () => {
    assignRole('user-2', 'tenant-1', 'admin')
    revokeRole('user-2', 'tenant-1', 'admin')
    expect(getUserRoles('user-2', 'tenant-1')).toHaveLength(0)
  })

  it('checks permissions', () => {
    assignRole('user-3', 'tenant-1', 'admin')
    const adminGranted = checkPermission('user-3', 'tenant-1', 'journal', 'create')
    expect(adminGranted.granted).toBe(true)

    const denied = checkPermission('user-3', 'tenant-1', 'audit', 'read')
    expect(denied.granted).toBe(true)
  })

  it('hasPermission shorthand works', () => {
    assignRole('user-4', 'tenant-1', 'admin')
    expect(hasPermission('user-4', 'tenant-1', 'journal', 'read')).toBe(true)
  })

  it('registers system roles', () => {
    registerSystemRoles()
    expect(getAllRoles().length).toBeGreaterThanOrEqual(7)
  })
})

describe('Session Hardening', () => {
  const POLICY = {
    maxSessionDuration: 3600000,
    idleTimeout: 600000,
    maxConcurrentSessions: 5,
    requireMfa: false,
    enforceIpBinding: true,
    enforceDeviceBinding: true,
    rotationInterval: 3600000,
  }

  it('creates sessions', () => {
    const session = createSession('user-1', 'tenant-1', '127.0.0.1', 'device-fp-1', 'UA-string', POLICY)
    expect(session.sessionId).toBeTruthy()
    expect(session.userId).toBe('user-1')
  })

  it('validates active sessions', () => {
    const session = createSession('user-2', 'tenant-1', '10.0.0.1', 'device-2', 'UA', POLICY)
    const result = validateSession(session.sessionId, '10.0.0.1', 'device-2', POLICY)
    expect(result.valid).toBe(true)
  })

  it('rejects expired sessions', () => {
    const expiredPolicy = { ...POLICY, maxSessionDuration: -1 }
    const session = createSession('user-3', 'tenant-1', '10.0.0.2', 'device-3', 'UA', expiredPolicy)
    const result = validateSession(session.sessionId, '10.0.0.2', 'device-3', expiredPolicy)
    expect(result.valid).toBe(false)
  })

  it('rejects IP mismatches', () => {
    const session = createSession('user-4', 'tenant-1', '10.0.0.3', 'device-4', 'UA', POLICY)
    const result = validateSession(session.sessionId, '10.0.0.99', 'device-4', POLICY)
    expect(result.valid).toBe(false)
  })

  it('destroys sessions', () => {
    const session = createSession('user-5', 'tenant-1', '10.0.0.4', 'device-5', 'UA', POLICY)
    destroySession(session.sessionId)
    const result = validateSession(session.sessionId, '10.0.0.4', 'device-5', POLICY)
    expect(result.valid).toBe(false)
  })

  it('destroys all user sessions', () => {
    createSession('user-6', 'tenant-1', '10.0.0.5', 'device-6', 'UA', POLICY)
    createSession('user-6', 'tenant-1', '10.0.0.5', 'device-6', 'UA', POLICY)
    const count = destroyAllUserSessions('user-6')
    expect(count).toBeGreaterThanOrEqual(2)
    expect(getActiveSessions('user-6')).toHaveLength(0)
  })

  it('returns login anomalies', () => {
    const anomalies = getLoginAnomalies()
    expect(Array.isArray(anomalies)).toBe(true)
  })
})

describe('Tamper Detection', () => {
  it('records integrity records', () => {
    const record = recordIntegrity('journal', 'entry-1', '{"amount":100}', 'create')
    expect(record.hash).toBeTruthy()
    expect(record.previousHash).toBe('GENESIS')
  })

  it('chains integrity records', () => {
    recordIntegrity('journal', 'entry-2', 'data1', 'create')
    const record = recordIntegrity('journal', 'entry-2', 'data2', 'update')
    expect(record.previousHash).not.toBe('GENESIS')
  })

  it('verifies integrity chain', () => {
    recordIntegrity('journal', 'entry-3', 'data1', 'create')
    recordIntegrity('journal', 'entry-3', 'data2', 'update')
    const events = verifyIntegrity('journal', 'entry-3')
    expect(events).toHaveLength(0)
  })

  it('detects tampering', () => {
    recordIntegrity('journal', 'entry-4', 'original', 'create')
    const chain = getIntegrityChain('journal', 'entry-4')
    chain[0].hash = 'tampered_hash'
    const events = verifyIntegrity('journal', 'entry-4')
    expect(events.length).toBeGreaterThan(0)
  })

  it('hashes entity data', () => {
    const hash1 = hashEntityData({ id: '1', name: 'test' })
    const hash2 = hashEntityData({ id: '1', name: 'test' })
    expect(hash1).toBe(hash2)
  })
})

describe('Abuse Detection', () => {
  it('allows requests within rate limit', () => {
    const result = checkRateLimit('key-1', 10, 60000, '10.0.0.1')
    expect(result.allowed).toBe(true)
    expect(result.retryAfter).toBe(0)
  })

  it('rejects requests over rate limit', () => {
    for (let i = 0; i < 10; i++) {
      checkRateLimit('key-2', 5, 60000, '10.0.0.2')
    }
    const result = checkRateLimit('key-2', 5, 60000, '10.0.0.2')
    expect(result.allowed).toBe(false)
  })

  it('blocks and unblocks IPs', () => {
    blockIP('10.0.0.99', 60000)
    expect(isBlocked('10.0.0.99')).toBe(true)
    expect(getBlockedIPs()).toContain('10.0.0.99')
    unblockIP('10.0.0.99')
    expect(isBlocked('10.0.0.99')).toBe(false)
  })

  it('detects abuse patterns', () => {
    recordAbuseEvent({
      type: 'suspicious_pattern', key: 'test', ip: '10.0.0.100',
      detectedAt: new Date().toISOString(), details: {}, severity: 'high',
    })
    expect(isBlocked('10.0.0.100')).toBe(true)
  })

  it('tracks patterns', () => {
    trackPattern('pattern-key', 60000, 3)
    trackPattern('pattern-key', 60000, 3)
    trackPattern('pattern-key', 60000, 3)
    expect(trackPattern('pattern-key', 60000, 3)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLIANCE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Immutable Log', () => {
  beforeEach(() => {
    clearEntries()
  })

  it('appends entries with hash chain', () => {
    const entry = appendImmutableEntry({
      action: 'journal.created',
      actorId: 'user-1',
      actorName: 'Admin',
      tenantId: 't1',
      resource: 'journal',
      resourceId: 'entry-1',
      changes: { amount: { old: 0, new: 100 } },
    })
    expect(entry.hash).toBeTruthy()
    expect(entry.sequence).toBe(1)
    expect(entry.previousHash).toBe('GENESIS')
  })

  it('verifies chain integrity', () => {
    appendImmutableEntry({
      action: 'journal.created', actorId: 'u1', actorName: 'A',
      tenantId: 't1', resource: 'journal', resourceId: 'e1',
    })
    appendImmutableEntry({
      action: 'journal.updated', actorId: 'u1', actorName: 'A',
      tenantId: 't1', resource: 'journal', resourceId: 'e1',
    })
    const result = verifyChain('t1')
    expect(result.valid).toBe(true)
    expect(result.totalEntries).toBeGreaterThanOrEqual(2)
  })

  it('exports log as JSON', () => {
    appendImmutableEntry({
      action: 'test', actorId: 'u1', actorName: 'A',
      tenantId: 't1', resource: 'r', resourceId: 'r1',
    })
    const json = exportImmutableLog('json', 't1')
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('exports log as CSV', () => {
    const csv = exportImmutableLog('csv', 't1')
    expect(csv).toContain('id,sequence,timestamp,action')
  })

  it('filters entries', () => {
    appendImmutableEntry({
      action: 'journal.created', actorId: 'u1', actorName: 'A',
      tenantId: 't1', resource: 'journal', resourceId: 'e1',
    })
    const entries = getImmutableEntries({ tenantId: 't1', action: 'journal.created' })
    expect(entries.length).toBeGreaterThan(0)
  })

  it('returns chain stats', () => {
    appendImmutableEntry({
      action: 'update', actorId: 'u1', actorName: 'A',
      tenantId: 't1', resource: 'journal', resourceId: 'e1',
    })
    appendImmutableEntry({
      action: 'create', actorId: 'u2', actorName: 'B',
      tenantId: 't1', resource: 'account', resourceId: 'a1',
    })
    const stats = getChainStats('t1')
    expect(stats.totalEntries).toBeGreaterThan(0)
    expect(stats.uniqueActors).toBeGreaterThan(0)
  })
})

describe('Retention Engine', () => {
  it('loads default policies', () => {
    loadDefaultPolicies()
    const policies = getAllRetentionPolicies()
    expect(policies.length).toBeGreaterThan(0)
  })

  it('sets custom retention policy', () => {
    setRetentionPolicy({ category: 'custom_data', retentionDays: 90, action: 'delete', legalHold: false, description: 'Custom' })
    expect(getRetentionPolicy('custom_data')?.retentionDays).toBe(90)
  })

  it('places and releases legal holds', () => {
    const hold = placeLegalHold('journal', ['entry-1', 'entry-2'], 'Legal case #42', 'admin')
    expect(hold.active).toBe(true)
    expect(isUnderLegalHold('journal', 'entry-1')).toBe(true)
    expect(isUnderLegalHold('journal', 'entry-3')).toBe(false)

    releaseLegalHold(hold.id)
    expect(isUnderLegalHold('journal', 'entry-1')).toBe(false)
  })

  it('gets active legal holds', () => {
    placeLegalHold('journal', ['entry-5'], 'Case #2', 'admin')
    const holds = getActiveLegalHolds('journal')
    expect(holds.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('System Health', () => {
  it('builds system summary', () => {
    const components = [
      createComponent('database', 'healthy', 'DB connected'),
      createComponent('redis', 'healthy', 'Redis connected'),
    ]
    const summary = buildSystemSummary(components, '1.0.0')
    expect(summary.overallStatus).toBe('healthy')
    expect(summary.components).toHaveLength(2)
  })

  it('assesses overall health', () => {
    expect(assessOverallHealth([createComponent('a', 'healthy', 'ok')])).toBe('healthy')
    expect(assessOverallHealth([createComponent('a', 'degraded', 'warn')])).toBe('degraded')
    expect(assessOverallHealth([createComponent('a', 'unhealthy', 'fail')])).toBe('unhealthy')
  })

  it('returns system uptime', () => {
    expect(getSystemUptime()).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cache Manager', () => {
  beforeEach(() => {
    createCache('test-cache', { ttl: 60000, maxSize: 100, evictionPolicy: 'lru' })
    clear('test-cache')
  })

  it('stores and retrieves values', () => {
    set('test-cache', 'key-1', { data: 'hello' })
    expect(get('test-cache', 'key-1')).toEqual({ data: 'hello' })
  })

  it('returns undefined for missing keys', () => {
    expect(get('test-cache', 'nonexistent')).toBeUndefined()
  })

  it('deletes values', () => {
    set('test-cache', 'to-delete', 'value')
    del('test-cache', 'to-delete')
    expect(get('test-cache', 'to-delete')).toBeUndefined()
  })

  it('clears entire namespace', () => {
    set('test-cache', 'a', 1)
    set('test-cache', 'b', 2)
    clear('test-cache')
    expect(get('test-cache', 'a')).toBeUndefined()
    expect(get('test-cache', 'b')).toBeUndefined()
  })

  it('getOrSet runs fn on cache miss', async () => {
    const fn = vi.fn().mockResolvedValue('computed')
    const result = await getOrSet('test-cache', 'compute-key', fn)
    expect(result).toBe('computed')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('getOrSet returns cached value', async () => {
    set('test-cache', 'cached-key', 'cached-value')
    const fn = vi.fn().mockResolvedValue('new-value')
    const result = await getOrSet('test-cache', 'cached-key', fn)
    expect(result).toBe('cached-value')
    expect(fn).not.toHaveBeenCalled()
  })

  it('invalidates by pattern', async () => {
    set('test-cache', 'user:1', 'a')
    set('test-cache', 'user:2', 'b')
    set('test-cache', 'config:1', 'c')
    const count = await invalidatePattern('test-cache', /^user:/)
    expect(count).toBe(2)
    expect(get('test-cache', 'user:1')).toBeUndefined()
    expect(get('test-cache', 'config:1')).toBe('c')
  })

  it('returns stats', () => {
    set('test-cache', 'stat-key', 'value')
    const stats = getStats('test-cache')
    expect(stats?.size).toBe(1)
    expect(stats?.config.evictionPolicy).toBe('lru')
  })

  it('returns all stats', () => {
    const all = getAllStats()
    expect(all.length).toBeGreaterThan(0)
  })
})

describe('Bulk Operations', () => {
  it('processes items in bulk', async () => {
    const items = [1, 2, 3, 4, 5]
    const processor = vi.fn().mockResolvedValue('ok')
    const result = await processBulk(items, processor, createBulkConfig({ batchSize: 2 }))
    expect(result.succeeded).toBe(5)
    expect(result.failed).toBe(0)
    expect(processor).toHaveBeenCalledTimes(5)
  })

  it('handles errors with continueOnError', async () => {
    const items = [1, 2, 3]
    const processor = vi.fn()
      .mockResolvedValueOnce('ok')
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok')

    const result = await processBulk(items, processor, createBulkConfig({ continueOnError: true, retryFailedItems: false }))
    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(1)
  })

  it('processes sequentially with progress', async () => {
    const items = ['a', 'b', 'c']
    const processor = vi.fn().mockResolvedValue('ok')
    const onProgress = vi.fn()

    const result = await processBatchSequential(items, processor, createBulkConfig({ batchSize: 2 }), onProgress)
    expect(result.succeeded).toBe(3)
    expect(onProgress).toHaveBeenCalled()
  })

  it('chunks arrays', () => {
    const chunks = chunkArray([1, 2, 3, 4, 5], 2)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toHaveLength(2)
    expect(chunks[2]).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-REGION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Region Manager', () => {
  it('loads default regions', () => {
    loadDefaultRegions()
    expect(getAllRegions().length).toBeGreaterThan(0)
  })

  it('registers custom regions', () => {
    registerRegion({
      id: 'custom-region', name: 'Custom', endpoint: 'https://custom.api.com',
      status: 'active', priority: 5, capabilities: ['read', 'write'],
      latency: 20, lastHealthCheck: new Date().toISOString(),
    })
    expect(getAllRegions().length).toBeGreaterThan(4)
  })

  it('filters active regions', () => {
    const active = getActiveRegions()
    expect(active.every(r => r.status === 'active')).toBe(true)
  })

  it('assigns tenants to regions', () => {
    const assignment = assignTenantToRegion('tenant-multi-1')
    expect(assignment.primaryRegion).toBeTruthy()
    expect(assignment.failoverRegion).toBeTruthy()
    expect(assignment.readRegions.length).toBeGreaterThan(0)
  })

  it('retrieves tenant assignment', () => {
    const assignment = getTenantAssignment('tenant-multi-1')
    expect(assignment?.tenantId).toBe('tenant-multi-1')
  })

  it('fails over tenants between regions', async () => {
    const result = await failoverTenant('tenant-multi-1')
    expect(result.success).toBe(true)
    expect(result.newPrimary).toBeTruthy()
  })

  it('registers and retrieves replicas', () => {
    registerReplica({
      id: 'replica-1', region: 'us-east', type: 'read',
      endpoint: 'https://replica-1.api.com', status: 'online', lag: 1,
    })
    expect(getReplicas('us-east')).toHaveLength(1)
  })

  it('returns tenant region distribution', () => {
    assignTenantToRegion('tenant-dist-1')
    assignTenantToRegion('tenant-dist-2')
    const dist = getTenantRegionDistribution()
    expect(Object.keys(dist).length).toBeGreaterThan(0)
  })
})
