import { RedisClient } from './client'

const QUEUE_PREFIX = 'queue:'
const PROCESSING_PREFIX = 'processing:'
const DEAD_LETTER_PREFIX = 'dead-letter:'
const MAX_RETRIES = 3
const VISIBILITY_TIMEOUT = 60_000

export interface QueueMessage<T = any> {
  id: string
  data: T
  metadata: {
    timestamp: number
    attempts: number
    maxRetries: number
    enqueuedAt: number
    correlationId?: string
    causationId?: string
    tenantId?: string
  }
}

export interface QueueOptions {
  visibilityTimeout?: number
  maxRetries?: number
  deadLetterQueue?: string
  dedupWindow?: number
}

export class DistributedQueue {
  private client: RedisClient
  private prefix: string

  constructor(client: RedisClient, prefix: string = '') {
    this.client = client
    this.prefix = prefix
  }

  private key(name: string): string {
    return `${QUEUE_PREFIX}${this.prefix}${name}`
  }

  private processingKey(name: string): string {
    return `${PROCESSING_PREFIX}${this.prefix}${name}`
  }

  private deadLetterKey(name: string): string {
    return `${DEAD_LETTER_PREFIX}${this.prefix}${name}`
  }

  async enqueue<T>(queue: string, data: T, options?: QueueOptions): Promise<string> {
    const id = generateMessageId()
    const correlationId = options?.dedupWindow ? undefined : undefined
    const msg: QueueMessage<T> = {
      id,
      data,
      metadata: {
        timestamp: Date.now(),
        attempts: 0,
        maxRetries: options?.maxRetries ?? MAX_RETRIES,
        enqueuedAt: Date.now(),
      },
    }

    if (options?.dedupWindow && options.dedupWindow > 0) {
      const dedupKey = `${this.key(queue)}:dedup:${id}`
      const deduped = await this.client.set(dedupKey, '1', 'PX', options.dedupWindow, 'NX')
      if (!deduped) {
        throw new QueueError(`Duplicate message ${id} within dedup window`, 'DUPLICATE')
      }
    }

    const serialized = JSON.stringify(msg)
    await this.client.lpush(this.key(queue), serialized)
    return id
  }

  async enqueueBatch<T>(queue: string, items: T[], options?: QueueOptions): Promise<string[]> {
    const ids: string[] = []
    const pipeline = this.client.pipeline()
    for (const item of items) {
      const id = generateMessageId()
      ids.push(id)
      const msg: QueueMessage<T> = {
        id,
        data: item,
        metadata: {
          timestamp: Date.now(),
          attempts: 0,
          maxRetries: options?.maxRetries ?? MAX_RETRIES,
          enqueuedAt: Date.now(),
        },
      }
      pipeline.lpush(this.key(queue), JSON.stringify(msg))
    }
    await pipeline.exec()
    return ids
  }

  async dequeue<T = any>(queue: string, timeout = 5): Promise<QueueMessage<T> | null> {
    const result = await this.client.brpoplpush(
      this.key(queue),
      this.processingKey(queue),
      timeout
    )
    if (!result) return null

    const msg: QueueMessage<T> = JSON.parse(result)
    msg.metadata.attempts++
    return msg
  }

  async ack<T = any>(queue: string, message: QueueMessage<T>): Promise<void> {
    const key = this.processingKey(queue)
    await this.client.lrem(key, 1, JSON.stringify(message))
  }

  async nack<T = any>(queue: string, message: QueueMessage<T>): Promise<void> {
    const processingKey = this.processingKey(queue)
    await this.client.lrem(processingKey, 1, JSON.stringify(message))

    if (message.metadata.attempts >= message.metadata.maxRetries) {
      const dlq = `${this.deadLetterKey(queue)}`
      await this.client.lpush(dlq, JSON.stringify(message))
      return
    }

    await this.client.lpush(this.key(queue), JSON.stringify(message))
  }

  async peek<T = any>(queue: string, count = 10): Promise<QueueMessage<T>[]> {
    const items = await this.client.lrange(this.key(queue), 0, count - 1)
    return items.map((i) => JSON.parse(i))
  }

  async peekDeadLetter<T = any>(queue: string, count = 10): Promise<QueueMessage<T>[]> {
    const items = await this.client.lrange(this.deadLetterKey(queue), 0, count - 1)
    return items.map((i) => JSON.parse(i))
  }

  async length(queue: string): Promise<number> {
    return this.client.llen(this.key(queue))
  }

  async processingLength(queue: string): Promise<number> {
    return this.client.llen(this.processingKey(queue))
  }

  async deadLetterLength(queue: string): Promise<number> {
    return this.client.llen(this.deadLetterKey(queue))
  }

  async requeueDeadLetter<T = any>(queue: string, count = 10): Promise<number> {
    const dlq = this.deadLetterKey(queue)
    let requeued = 0
    for (let i = 0; i < count; i++) {
      const item = await this.client.rpoplpush(dlq, this.key(queue))
      if (!item) break
      requeued++
    }
    return requeued
  }

  async purgeProcessing(queue: string): Promise<number> {
    const key = this.processingKey(queue)
    const items = await this.client.lrange(key, 0, -1)
    if (items.length === 0) return 0
    await this.client.del(key)
    return items.length
  }

  async purge(queue: string): Promise<number> {
    const items = await this.client.lrange(this.key(queue), 0, -1)
    if (items.length === 0) return 0
    await this.client.del(this.key(queue))
    return items.length
  }

  async retryExpiredProcessing(queues: string[], timeout = VISIBILITY_TIMEOUT): Promise<number> {
    let retried = 0
    for (const queue of queues) {
      const key = this.processingKey(queue)
      const items = await this.client.lrange(key, 0, -1)
      for (const item of items) {
        try {
          const msg = JSON.parse(item)
          const elapsed = Date.now() - msg.metadata.timestamp
          if (elapsed >= timeout) {
            await this.client.lrem(key, 1, item)
            msg.metadata.attempts++
            if (msg.metadata.attempts >= msg.metadata.maxRetries) {
              await this.client.lpush(this.deadLetterKey(queue), JSON.stringify(msg))
            } else {
              await this.client.lpush(this.key(queue), JSON.stringify(msg))
            }
            retried++
          }
        } catch {
          await this.client.lpush(this.key(queue), item)
          await this.client.lrem(key, 1, item)
          retried++
        }
      }
    }
    return retried
  }

  async stats(queue: string): Promise<QueueStats> {
    const [length, processing, deadLetter] = await Promise.all([
      this.length(queue),
      this.processingLength(queue),
      this.deadLetterLength(queue),
    ])
    return { queue, length, processing, deadLetter }
  }
}

export interface QueueStats {
  queue: string
  length: number
  processing: number
  deadLetter: number
}

export class QueueError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'QueueError'
    this.code = code
  }
}

function generateMessageId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
