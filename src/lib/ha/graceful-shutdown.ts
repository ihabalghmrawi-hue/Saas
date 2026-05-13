import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('graceful-shutdown')

interface ShutdownHandler {
  name: string
  priority: number
  handler: () => Promise<void>
  timeout: number
}

const handlers: ShutdownHandler[] = []
let isShuttingDown = false

export function registerShutdownHandler(name: string, handler: () => Promise<void>, priority = 100, timeout = 30000): void {
  handlers.push({ name, priority, handler, timeout })
  handlers.sort((a, b) => a.priority - b.priority)
}

export async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring duplicate signal')
    return
  }

  isShuttingDown = true
  logger.info(`Initiating graceful shutdown (signal: ${signal})`)

  for (const { name, handler, timeout } of handlers) {
    try {
      logger.info(`Running shutdown handler: ${name}`)
      await Promise.race([
        handler(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error(`Handler ${name} timed out after ${timeout}ms`)), timeout)
        ),
      ])
      logger.info(`Shutdown handler completed: ${name}`)
    } catch (error) {
      logger.error(`Shutdown handler failed: ${name}`, error instanceof Error ? error : undefined)
    }
  }

  logger.info('Graceful shutdown complete')
}

export function isShuttingDownFlag(): boolean {
  return isShuttingDown
}

export function registerDefaultShutdownHandlers(
  closeDb: () => Promise<void>,
  closeQueues: () => Promise<void>,
  flushMetrics: () => Promise<void>,
  closeHttpServer: () => Promise<void>,
): void {
  registerShutdownHandler('close-http-server', closeHttpServer, 10, 10000)
  registerShutdownHandler('drain-queues', closeQueues, 50, 30000)
  registerShutdownHandler('flush-metrics', flushMetrics, 80, 5000)
  registerShutdownHandler('close-db-connections', closeDb, 90, 10000)
}
