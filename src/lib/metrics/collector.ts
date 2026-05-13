type MetricType = 'counter' | 'gauge' | 'histogram'

interface MetricDefinition {
  name: string
  type: MetricType
  help: string
  labels: string[]
}

export interface MetricValue {
  value: number
  labels: Record<string, string>
  timestamp: number
}

let metrics = new Map<string, MetricValue[]>()

export function configureCollectorStores(stores: { metrics?: Map<string, MetricValue[]> }): void {
  if (stores.metrics) metrics = stores.metrics
}

function register(name: string, type: MetricType, help: string, labels: string[] = []): void {
  if (!metrics.has(name)) {
    metrics.set(name, [])
  }
}

export function incrementCounter(name: string, labels?: Record<string, string>, value = 1): void {
  if (!metrics.has(name)) metrics.set(name, [])
  const existing = metrics.get(name)!
  const key = JSON.stringify(labels || {})
  const idx = existing.findIndex(m => JSON.stringify(m.labels) === key)
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], value: existing[idx].value + value, timestamp: Date.now() }
  } else {
    existing.push({ value, labels: labels || {}, timestamp: Date.now() })
  }
}

export function setGauge(name: string, value: number, labels?: Record<string, string>): void {
  if (!metrics.has(name)) metrics.set(name, [])
  const existing = metrics.get(name)!
  const key = JSON.stringify(labels || {})
  const idx = existing.findIndex(m => JSON.stringify(m.labels) === key)
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], value, timestamp: Date.now() }
  } else {
    existing.push({ value, labels: labels || {}, timestamp: Date.now() })
  }
}

export function observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
  if (!metrics.has(name)) metrics.set(name, [])
  const entry = { value, labels: labels || {}, timestamp: Date.now() }
  metrics.get(name)!.push(entry)
}

export function getMetric(name: string): MetricValue[] {
  return metrics.get(name) || []
}

export function getAllMetrics(): Record<string, MetricValue[]> {
  const result: Record<string, MetricValue[]> = {}
  for (const [name, values] of metrics) {
    result[name] = values
  }
  return result
}

function escapeLabelValue(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

export function generatePrometheusFormat(): string {
  const lines: string[] = []

  for (const [name, values] of metrics) {
    if (values.length === 0) continue

    const isHistogram = name.startsWith('histogram_') || values.length > 1 && values.some(v => v.value !== Math.round(v.value))

    for (const mv of values) {
      const labelStr = Object.entries(mv.labels)
        .map(([k, v]) => `${k}="${escapeLabelValue(v)}"`)
        .join(',')

      if (labelStr) {
        lines.push(`${name}{${labelStr}} ${mv.value} ${mv.timestamp}`)
      } else {
        lines.push(`${name} ${mv.value} ${mv.timestamp}`)
      }
    }
  }

  return lines.join('\n') + '\n'
}

export function resetMetrics(): void {
  metrics.clear()
}

export function recordDBQuery(duration: number, operation: string, table: string): void {
  observeHistogram('db_query_duration_ms', duration, { operation, table })
  incrementCounter('db_query_total', { operation, table })
}

export function recordRPCCall(duration: number, rpcName: string): void {
  observeHistogram('rpc_duration_ms', duration, { rpc: rpcName })
  incrementCounter('rpc_calls_total', { rpc: rpcName })
}

export function recordQueueOperation(operation: string, queue: string, status: string): void {
  incrementCounter('queue_operations_total', { operation, queue, status })
  setGauge('queue_depth', 0, { queue })
}

export function recordWorkerHeartbeat(worker: string, status: string): void {
  setGauge('worker_heartbeat', status === 'alive' ? 1 : 0, { worker })
  setGauge('worker_last_heartbeat', Date.now(), { worker })
}

export function recordAccountingTransaction(type: string, status: string): void {
  incrementCounter('accounting_transactions_total', { type, status })
}

export function recordCacheOperation(operation: string, hit: boolean): void {
  incrementCounter('cache_operations_total', { operation, hit: hit ? 'true' : 'false' })
}

export function recordWebhookDelivery(status: string, integration: string): void {
  incrementCounter('webhook_deliveries_total', { status, integration })
}

export function recordBackupOperation(operation: string, status: string): void {
  incrementCounter('backup_operations_total', { operation, status })
}
