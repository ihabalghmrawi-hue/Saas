import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('retry-orchestrator')

export interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffFactor: number
  jitter: boolean
  retryableErrors: string[]
}

export interface RetryState {
  attempt: number
  lastError: string | null
  lastAttemptAt: number | null
  nextAttemptAt: number | null
}

export interface RetryResult<T> {
  success: boolean
  result: T | null
  error: string | null
  attempts: number
  totalDuration: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
  retryableErrors: ['TIMEOUT', 'RATE_LIMITED', 'NETWORK_ERROR', 'CONNECTION_RESET', 'DEADLOCK', 'SERIALIZATION_FAILURE'],
}

let retryStates = new Map<string, RetryState>()

export function configureRetryStores(stores: { retryStates?: Map<string, RetryState> }): void {
  if (stores.retryStates) retryStates = stores.retryStates
}

export function createRetryConfig(overrides: Partial<RetryConfig>): RetryConfig {
  return { ...DEFAULT_RETRY_CONFIG, ...overrides }
}

function calculateDelay(config: RetryConfig, attempt: number): number {
  let delay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1)
  delay = Math.min(delay, config.maxDelay)

  if (config.jitter) {
    delay = delay * (0.5 + Math.random() * 0.5)
  }

  return Math.floor(delay)
}

function isRetryable(error: string, config: RetryConfig): boolean {
  return config.retryableErrors.some(e =>
    error.toUpperCase().includes(e.toUpperCase())
  )
}

export async function withRetry<T>(
  operationId: string,
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<RetryResult<T>> {
  const startTime = Date.now()
  let state = retryStates.get(operationId) || { attempt: 0, lastError: null, lastAttemptAt: null, nextAttemptAt: null }
  let lastError: string | null = null

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      state.attempt = attempt
      state.lastAttemptAt = Date.now()

      const result = await fn()

      state.lastError = null
      state.nextAttemptAt = null
      retryStates.set(operationId, state)

      return {
        success: true,
        result,
        error: null,
        attempts: attempt,
        totalDuration: Date.now() - startTime,
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      state.lastError = lastError

      if (attempt < config.maxRetries && isRetryable(lastError, config)) {
        const delay = calculateDelay(config, attempt)
        state.nextAttemptAt = Date.now() + delay

        logger.warn(`Retry ${attempt}/${config.maxRetries} for ${operationId} after ${delay}ms`, {
          data: { operationId, attempt, error: lastError, delay },
        })

        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        retryStates.set(operationId, state)
        return {
          success: false,
          result: null,
          error: lastError,
          attempts: attempt,
          totalDuration: Date.now() - startTime,
        }
      }
    }
  }

  return {
    success: false,
    result: null,
    error: lastError,
    attempts: config.maxRetries,
    totalDuration: Date.now() - startTime,
  }
}

export function getRetryState(operationId: string): RetryState | undefined {
  return retryStates.get(operationId)
}

export function resetRetryState(operationId: string): void {
  retryStates.delete(operationId)
}

export function clearAllRetryStates(): void {
  retryStates.clear()
}

export async function deadLetterRecovery<T>(
  deadLetterId: string,
  originalFn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<RetryResult<T>> {
  logger.info(`Attempting dead letter recovery: ${deadLetterId}`)

  const recoveryConfig: RetryConfig = {
    ...config,
    maxRetries: Math.min(config.maxRetries, 2),
    baseDelay: config.baseDelay * 2,
  }

  return withRetry(`dlq_${deadLetterId}`, originalFn, recoveryConfig)
}
