import { RedisClient } from './client'

const IDEMPOTENCY_PREFIX = 'idempotency:'
const LOCK_PREFIX = 'idempotency-lock:'
const DEFAULT_TTL = 86_400_000
const LOCK_TTL = 10_000

export interface IdempotencyRecord {
  key: string
  result: unknown
  createdAt: number
  expiresAt: number
}

export class IdempotencyStore {
  private client: RedisClient

  constructor(client: RedisClient) {
    this.client = client
  }

  async process<T>(
    idempotencyKey: string,
    fn: () => Promise<T>,
    ttl = DEFAULT_TTL
  ): Promise<T> {
    const existing = await this.getResult<T>(idempotencyKey)
    if (existing !== null) return existing

    const lockAcquired = await this.acquireLock(idempotencyKey)
    if (!lockAcquired) {
      for (let i = 0; i < 50; i++) {
        await sleep(100)
        const retry = await this.getResult<T>(idempotencyKey)
        if (retry !== null) return retry
      }
      throw new IdempotencyError('Could not acquire idempotency lock after retries', 'LOCK_TIMEOUT')
    }

    try {
      const doubleCheck = await this.getResult<T>(idempotencyKey)
      if (doubleCheck !== null) return doubleCheck

      const result = await fn()
      await this.storeResult(idempotencyKey, result, ttl)
      return result
    } finally {
      await this.releaseLock(idempotencyKey)
    }
  }

  async getResult<T>(idempotencyKey: string): Promise<T | null> {
    const data = await this.client.get(`${IDEMPOTENCY_PREFIX}${idempotencyKey}`)
    if (!data) return null
    const record: IdempotencyRecord = JSON.parse(data)
    return record.result as T
  }

  async isProcessed(idempotencyKey: string): Promise<boolean> {
    const exists = await this.client.exists(`${IDEMPOTENCY_PREFIX}${idempotencyKey}`)
    return exists === 1
  }

  async clear(key: string): Promise<boolean> {
    const result = await this.client.del(`${IDEMPOTENCY_PREFIX}${key}`)
    return result > 0
  }

  async clearExpired(): Promise<number> {
    let cleared = 0
    let cursor = '0'
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', `${IDEMPOTENCY_PREFIX}*`, 'COUNT', 100)
      cursor = nextCursor
      for (const key of keys) {
        const ttl = await this.client.ttl(key)
        if (ttl <= 0) {
          await this.client.del(key)
          cleared++
        }
      }
    } while (cursor !== '0')
    return cleared
  }

  private async storeResult(key: string, result: unknown, ttl: number): Promise<void> {
    const record: IdempotencyRecord = {
      key,
      result,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
    }
    await this.client.setex(`${IDEMPOTENCY_PREFIX}${key}`, Math.ceil(ttl / 1000), JSON.stringify(record))
  }

  private async acquireLock(key: string): Promise<boolean> {
    const result = await this.client.set(
      `${LOCK_PREFIX}${key}`,
      '1',
      'PX',
      LOCK_TTL,
      'NX'
    )
    return result === 'OK'
  }

  private async releaseLock(key: string): Promise<void> {
    await this.client.del(`${LOCK_PREFIX}${key}`)
  }
}

export class IdempotencyError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'IdempotencyError'
    this.code = code
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
