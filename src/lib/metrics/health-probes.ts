export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  component: string
  message: string
  duration: number
  lastChecked: string
  metadata?: Record<string, unknown>
}

export interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: HealthCheckResult[]
  timestamp: string
  uptime: number
  version: string
}

const START_TIME = Date.now()
const APP_VERSION = process.env.APP_VERSION || '1.0.0'

export type HealthChecker = () => Promise<HealthCheckResult>

const checkers = new Map<string, HealthChecker>()

export function registerHealthCheck(name: string, checker: HealthChecker): void {
  checkers.set(name, checker)
}

export async function runHealthChecks(): Promise<HealthReport> {
  const checks: HealthCheckResult[] = []

  for (const [name, checker] of checkers) {
    try {
      const result = await checker()
      checks.push(result)
    } catch (error) {
      checks.push({
        status: 'unhealthy',
        component: name,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 0,
        lastChecked: new Date().toISOString(),
      })
    }
  }

  const hasUnhealthy = checks.some(c => c.status === 'unhealthy')
  const hasDegraded = checks.some(c => c.status === 'degraded')

  return {
    status: hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy',
    checks,
    timestamp: new Date().toISOString(),
    uptime: Date.now() - START_TIME,
    version: APP_VERSION,
  }
}

export function createDbHealthChecker(getDbHealth: () => Promise<boolean>): HealthChecker {
  return async () => {
    const start = Date.now()
    const healthy = await getDbHealth()
    return {
      status: healthy ? 'healthy' : 'unhealthy',
      component: 'database',
      message: healthy ? 'Database connection established' : 'Database connection failed',
      duration: Date.now() - start,
      lastChecked: new Date().toISOString(),
    }
  }
}

export function createRedisHealthChecker(getRedisHealth: () => Promise<boolean>): HealthChecker {
  return async () => {
    const start = Date.now()
    const healthy = await getRedisHealth()
    return {
      status: healthy ? 'healthy' : 'degraded',
      component: 'redis',
      message: healthy ? 'Redis connection established' : 'Redis connection failed',
      duration: Date.now() - start,
      lastChecked: new Date().toISOString(),
    }
  }
}

export function createQueueHealthChecker(getQueueDepth: (name: string) => Promise<number>): Array<{ name: string; checker: HealthChecker }> {
  const queues = ['accounting', 'reconciliation', 'recurring', 'backup', 'webhook', 'notifications']
  return queues.map((queue) => ({
    name: `queue_${queue}`,
    checker: async (): Promise<HealthCheckResult> => {
      const start = Date.now()
      const depth = await getQueueDepth(queue)
      const status = depth > 1000 ? 'degraded' : 'healthy'
      return {
        status,
        component: `queue.${queue}`,
        message: `Queue depth: ${depth}`,
        duration: Date.now() - start,
        lastChecked: new Date().toISOString(),
        metadata: { depth },
      }
    },
  }))
}

export function createMemoryHealthChecker(): HealthChecker {
  return async () => {
    const start = Date.now()
    const usage = process.memoryUsage()
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024)
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024)
    const pct = Math.round((heapUsedMB / heapTotalMB) * 100)

    return {
      status: pct > 90 ? 'degraded' : 'healthy',
      component: 'memory',
      message: `Heap: ${heapUsedMB}MB / ${heapTotalMB}MB (${pct}%)`,
      duration: Date.now() - start,
      lastChecked: new Date().toISOString(),
      metadata: { heapUsedMB, heapTotalMB, pct, rss: Math.round(usage.rss / 1024 / 1024) },
    }
  }
}

export async function livenessCheck(): Promise<{ status: string; timestamp: string }> {
  return { status: 'alive', timestamp: new Date().toISOString() }
}

export function startupTime(): number {
  return START_TIME
}
