import { createLogger } from '@/lib/observability/logger'
import { incrementCounter, observeHistogram } from '@/lib/metrics/collector'

const logger = createLogger('bulk-operations')

export interface BulkOperationConfig {
  batchSize: number
  concurrency: number
  retryFailedItems: boolean
  maxRetries: number
  continueOnError: boolean
}

export interface BulkOperationResult<T> {
  totalItems: number
  succeeded: number
  failed: number
  errors: Array<{ index: number; item: T; error: string }>
  duration: number
}

export interface BatchProgress {
  total: number
  processed: number
  succeeded: number
  failed: number
  percentComplete: number
  estimatedTimeRemaining: number
}

const DEFAULT_BULK_CONFIG: BulkOperationConfig = {
  batchSize: 100,
  concurrency: 5,
  retryFailedItems: true,
  maxRetries: 2,
  continueOnError: true,
}

export function createBulkConfig(overrides: Partial<BulkOperationConfig>): BulkOperationConfig {
  return { ...DEFAULT_BULK_CONFIG, ...overrides }
}

export async function processBulk<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  config: BulkOperationConfig = DEFAULT_BULK_CONFIG,
): Promise<BulkOperationResult<T>> {
  const startTime = Date.now()
  const errors: Array<{ index: number; item: T; error: string }> = []
  let succeeded = 0

  const batches = []
  for (let i = 0; i < items.length; i += config.batchSize) {
    batches.push(items.slice(i, i + config.batchSize))
  }

  for (const batch of batches) {
    const batchResults = await Promise.allSettled(
      batch.map((item, idx) => processor(item, idx).then(result => ({ result, error: null as string | null })).catch(err => ({ result: null as R | null, error: err instanceof Error ? err.message : String(err) })))
    )

    for (let i = 0; i < batchResults.length; i++) {
      const result = batchResults[i]
      if (result.status === 'fulfilled') {
        if (result.value.error) {
          errors.push({ index: i, item: batch[i], error: result.value.error })
          if (!config.continueOnError) break
        } else {
          succeeded++
        }
      } else {
        errors.push({ index: i, item: batch[i], error: result.reason instanceof Error ? result.reason.message : 'Unknown' })
        if (!config.continueOnError) break
      }
    }
  }

  const duration = Date.now() - startTime
  const totalItems = items.length

  if (config.retryFailedItems && errors.length > 0) {
    for (let retry = 0; retry < config.maxRetries; retry++) {
      const retryErrors: Array<{ index: number; item: T; error: string }> = []

      for (const error of errors) {
        try {
          await processor(error.item, error.index)
          succeeded++
        } catch (err) {
          retryErrors.push({ index: error.index, item: error.item, error: err instanceof Error ? err.message : String(err) })
        }
      }

      errors.length = 0
      errors.push(...retryErrors)

      if (errors.length === 0) break
    }
  }

  incrementCounter('bulk_operations_total', { status: errors.length === 0 ? 'success' : 'partial' })
  observeHistogram('bulk_operation_duration_ms', duration, { itemCount: String(totalItems) })

  logger.info(`Bulk operation completed: ${succeeded}/${totalItems} succeeded, ${errors.length} failed in ${duration}ms`)

  return {
    totalItems,
    succeeded,
    failed: errors.length,
    errors,
    duration,
  }
}

export async function processBatchSequential<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  config: BulkOperationConfig = DEFAULT_BULK_CONFIG,
  onProgress?: (progress: BatchProgress) => void,
): Promise<BulkOperationResult<T>> {
  const startTime = Date.now()
  const errors: Array<{ index: number; item: T; error: string }> = []
  let succeeded = 0
  let processed = 0

  for (let i = 0; i < items.length; i += config.batchSize) {
    const batch = items.slice(i, i + config.batchSize)

    for (let j = 0; j < batch.length; j++) {
      try {
        await processor(batch[j], i + j)
        succeeded++
      } catch (error) {
        errors.push({ index: i + j, item: batch[j], error: error instanceof Error ? error.message : String(error) })
        if (!config.continueOnError) break
      }
      processed++

      if (onProgress) {
        const elapsed = Date.now() - startTime
        const rate = processed / (elapsed / 1000)
        const remaining = items.length - processed
        onProgress({
          total: items.length,
          processed,
          succeeded,
          failed: errors.length,
          percentComplete: Math.round((processed / items.length) * 100),
          estimatedTimeRemaining: rate > 0 ? remaining / rate * 1000 : 0,
        })
      }
    }
  }

  return {
    totalItems: items.length,
    succeeded,
    failed: errors.length,
    errors,
    duration: Date.now() - startTime,
  }
}

export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

export async function batchUpsert<T extends Record<string, unknown>>(
  upsertFn: (chunk: T[]) => Promise<void>,
  items: T[],
  config: BulkOperationConfig = DEFAULT_BULK_CONFIG,
): Promise<BulkOperationResult<T>> {
  return processBulk(items, async (item) => {
    await upsertFn([item])
  }, config)
}
