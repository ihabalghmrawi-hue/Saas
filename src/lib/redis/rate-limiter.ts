import { RedisClient } from './client'

const RATE_LIMIT_PREFIX = 'ratelimit:'

export interface RateLimitWindow {
  window: number
  max: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  reset: number
  total: number
}

export class RedisRateLimiter {
  private client: RedisClient

  constructor(client: RedisClient) {
    this.client = client
  }

  async check(
    key: string,
    windows: RateLimitWindow[]
  ): Promise<RateLimitResult> {
    const now = Date.now()
    const results = await Promise.all(
      windows.map(async (w) => {
        const windowKey = `${RATE_LIMIT_PREFIX}${key}:${w.window}`
        const cleanup = now - w.window

        const multi = this.client.multi()
        multi.zremrangebyscore(windowKey, 0, cleanup)
        multi.zadd(windowKey, now, `${now}:${Math.random()}`)
        multi.zcard(windowKey)
        multi.pexpire(windowKey, w.window * 2)
        const result = await multi.exec()
        if (!result) return { allowed: true, remaining: w.max, reset: now + w.window, total: 0 }

        const count = result[2][1] as number
        const allowed = count <= w.max
        return {
          allowed,
          remaining: Math.max(0, w.max - count),
          reset: now + w.window,
          total: count,
        }
      })
    )

    const allowed = results.every((r) => r.allowed)
    const remaining = Math.min(...results.map((r) => r.remaining))
    const reset = Math.max(...results.map((r) => r.reset))
    const total = Math.max(...results.map((r) => r.total))

    return { allowed, remaining, reset, total }
  }

  async checkSlidingWindow(key: string, windowMs: number, max: number): Promise<RateLimitResult> {
    return this.check(key, [{ window: windowMs, max }])
  }

  async reset(key: string): Promise<void> {
    const pattern = `${RATE_LIMIT_PREFIX}${key}:*`
    let cursor = '0'
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = nextCursor
      if (keys.length > 0) {
        await this.client.del(...keys)
      }
    } while (cursor !== '0')
  }

  async getRemaining(key: string, window: number, max: number): Promise<number> {
    const windowKey = `${RATE_LIMIT_PREFIX}${key}:${window}`
    const cleanup = Date.now() - window
    await this.client.zremrangebyscore(windowKey, 0, cleanup)
    const count = await this.client.zcard(windowKey)
    return Math.max(0, max - count)
  }
}
