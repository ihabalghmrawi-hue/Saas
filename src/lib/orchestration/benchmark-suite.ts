import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('benchmark-suite')

export interface BenchmarkResult {
  name: string
  category: BenchmarkCategory
  operations: number
  durationMs: number
  opsPerSecond: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
  errorRate: number
  metadata: Record<string, any>
  timestamp: number
}

export type BenchmarkCategory =
  | 'runtime_stress'
  | 'multi_worker'
  | 'queue_throughput'
  | 'replication'
  | 'event_propagation'
  | 'redis_coordination'
  | 'failover_timing'

export interface BenchmarkConfig {
  name: string
  category: BenchmarkCategory
  concurrency: number
  totalOperations: number
  durationSeconds: number
  payloadSize: number
  targetResource?: string
  options: Record<string, any>
}

export interface BenchmarkRun {
  id: string
  config: BenchmarkConfig
  results: BenchmarkResult[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt: number
  completedAt?: number
  error?: string
}

let benchmarkResults = new Map<string, BenchmarkResult[]>()
let benchmarkRuns = new Map<string, BenchmarkRun>()

export function configureBenchmarkStores(stores: {
  benchmarkResults?: Map<string, BenchmarkResult[]>
  benchmarkRuns?: Map<string, BenchmarkRun>
}): void {
  if (stores.benchmarkResults) benchmarkResults = stores.benchmarkResults
  if (stores.benchmarkRuns) benchmarkRuns = stores.benchmarkRuns
}

export async function runBenchmark(config: BenchmarkConfig): Promise<BenchmarkRun> {
  const run: BenchmarkRun = {
    id: `benchmark:${config.category}:${config.name}:${Date.now().toString(36)}`,
    config, results: [], status: 'running', startedAt: Date.now(),
  }
  benchmarkRuns.set(run.id, run)

  logger.info(`Benchmark starting: ${config.name} (${config.category}, concurrency=${config.concurrency}, ops=${config.totalOperations})`)

  try {
    const latencies: number[] = []
    let errors = 0
    const startTime = Date.now()
    const deadline = startTime + config.durationSeconds * 1000
    let ops = 0

    while (Date.now() < deadline && ops < config.totalOperations) {
      const batchSize = Math.min(config.concurrency, config.totalOperations - ops)
      const batchStart = Date.now()

      const batchPromises = Array.from({ length: batchSize }, async () => {
        const opStart = Date.now()
        try {
          await executeBenchmarkOperation(config)
          latencies.push(Date.now() - opStart)
        } catch {
          errors++
        }
      })

      await Promise.all(batchPromises)
      ops += batchSize
      const batchDuration = Date.now() - batchStart

      if (batchDuration < 100) await new Promise(resolve => setTimeout(resolve, 100 - batchDuration))
    }

    const duration = Date.now() - startTime
    const sortedLatencies = [...latencies].sort((a, b) => a - b)
    const totalOps = latencies.length
    const totalErrors = errors

    const result: BenchmarkResult = {
      name: config.name,
      category: config.category,
      operations: totalOps,
      durationMs: duration,
      opsPerSecond: Math.round((totalOps / duration) * 1000),
      p50Ms: percentile(sortedLatencies, 50),
      p95Ms: percentile(sortedLatencies, 95),
      p99Ms: percentile(sortedLatencies, 99),
      errorRate: totalOps > 0 ? totalErrors / totalOps : 0,
      metadata: { concurrency: config.concurrency, payloadSize: config.payloadSize, ...config.options },
      timestamp: Date.now(),
    }

    run.results = [result]
    run.status = 'completed'
    run.completedAt = Date.now()

    if (!benchmarkResults.has(config.category)) benchmarkResults.set(config.category, [])
    benchmarkResults.get(config.category)!.push(result)

    logger.info(`Benchmark completed: ${config.name} (${result.opsPerSecond} ops/s, p50=${result.p50Ms}ms, p95=${result.p95Ms}ms, errors=${totalErrors})`)
  } catch (err) {
    run.status = 'failed'
    run.error = `${err}`
    logger.error(`Benchmark failed: ${config.name}: ${err}`)
  }

  return run
}

async function executeBenchmarkOperation(config: BenchmarkConfig): Promise<void> {
  const latency = Math.random() * 10 + 1
  switch (config.category) {
    case 'redis_coordination':
      await new Promise(resolve => setTimeout(resolve, latency))
      break
    case 'queue_throughput':
      await new Promise(resolve => setTimeout(resolve, latency))
      break
    case 'replication':
      await new Promise(resolve => setTimeout(resolve, latency * 2))
      break
    case 'event_propagation':
      await new Promise(resolve => setTimeout(resolve, latency * 0.5))
      break
    case 'failover_timing':
      await new Promise(resolve => setTimeout(resolve, latency * 5))
      break
    default:
      await new Promise(resolve => setTimeout(resolve, latency))
  }
  if (Math.random() < 0.001) throw new Error('Simulated benchmark error')
}

export async function runBenchmarkSuite(suite: BenchmarkConfig[]): Promise<BenchmarkRun[]> {
  const runs: BenchmarkRun[] = []
  for (const config of suite) {
    const run = await runBenchmark(config)
    runs.push(run)
  }
  return runs
}

export function getBenchmarkResults(category?: BenchmarkCategory): BenchmarkResult[] {
  if (category) return benchmarkResults.get(category) || []
  return Array.from(benchmarkResults.values()).flat()
}

export function getBenchmarkRun(id: string): BenchmarkRun | undefined {
  return benchmarkRuns.get(id)
}

export function listBenchmarkRuns(category?: BenchmarkCategory, limit = 20): BenchmarkRun[] {
  let runs = Array.from(benchmarkRuns.values())
  if (category) runs = runs.filter(r => r.config.category === category)
  return runs.sort((a, b) => b.startedAt - a.startedAt).slice(0, limit)
}

export function computeBenchmarkSummary(): {
  totalRuns: number
  categories: Record<string, number>
  avgOpsPerSecond: Record<string, number>
  avgP95Ms: Record<string, number>
  errorRates: Record<string, number>
} {
  const categories: Record<string, number> = {}
  const catResults = new Map<string, BenchmarkResult[]>()

  for (const [cat, results] of benchmarkResults) {
    categories[cat] = results.length
    catResults.set(cat, results)
  }

  const avgOpsPerSecond: Record<string, number> = {}
  const avgP95Ms: Record<string, number> = {}
  const errorRates: Record<string, number> = {}

  for (const [cat, results] of catResults) {
    avgOpsPerSecond[cat] = results.reduce((s, r) => s + r.opsPerSecond, 0) / results.length
    avgP95Ms[cat] = results.reduce((s, r) => s + r.p95Ms, 0) / results.length
    errorRates[cat] = results.reduce((s, r) => s + r.errorRate, 0) / results.length
  }

  return { totalRuns: benchmarkRuns.size, categories, avgOpsPerSecond, avgP95Ms, errorRates }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}
