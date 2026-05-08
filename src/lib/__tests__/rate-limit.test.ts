import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { checkRateLimit, getClientIp, rateLimitHeaders, RATE_LIMITS } from '../rate-limit'

// Each test gets a fresh module so the in-memory store is reset
beforeEach(() => {
  vi.resetModules()
})

describe('checkRateLimit', () => {
  it('allows first request', async () => {
    const { checkRateLimit } = await import('../rate-limit')
    const result = checkRateLimit('test-key', { windowMs: 60_000, max: 3 })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(2)
  })

  it('allows up to max requests', async () => {
    const { checkRateLimit } = await import('../rate-limit')
    const config = { windowMs: 60_000, max: 3 }
    checkRateLimit('k', config)
    checkRateLimit('k', config)
    const third = checkRateLimit('k', config)
    expect(third.allowed).toBe(true)
    expect(third.remaining).toBe(0)
  })

  it('blocks when over max', async () => {
    const { checkRateLimit } = await import('../rate-limit')
    const config = { windowMs: 60_000, max: 2 }
    checkRateLimit('k2', config)
    checkRateLimit('k2', config)
    const over = checkRateLimit('k2', config)
    expect(over.allowed).toBe(false)
    expect(over.remaining).toBe(0)
    expect(over.retryAfter).toBeGreaterThan(0)
  })

  it('different keys do not interfere', async () => {
    const { checkRateLimit } = await import('../rate-limit')
    const config = { windowMs: 60_000, max: 1 }
    const r1 = checkRateLimit('key-a', config)
    const r2 = checkRateLimit('key-b', config)
    expect(r1.allowed).toBe(true)
    expect(r2.allowed).toBe(true)
  })

  it('resets after window expires', async () => {
    vi.useFakeTimers()
    const { checkRateLimit } = await import('../rate-limit')
    const config = { windowMs: 1_000, max: 1 }
    checkRateLimit('reset-key', config)
    const blocked = checkRateLimit('reset-key', config)
    expect(blocked.allowed).toBe(false)

    vi.advanceTimersByTime(1_500)
    const afterReset = checkRateLimit('reset-key', config)
    expect(afterReset.allowed).toBe(true)
    vi.useRealTimers()
  })
})

describe('getClientIp', () => {
  it('extracts first IP from x-forwarded-for', () => {
    const req = { headers: { get: (h: string) => h === 'x-forwarded-for' ? '1.2.3.4, 5.6.7.8' : null } }
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    const req = { headers: { get: (h: string) => h === 'x-real-ip' ? '9.9.9.9' : null } }
    expect(getClientIp(req)).toBe('9.9.9.9')
  })

  it('returns unknown when no IP headers', () => {
    const req = { headers: { get: () => null } }
    expect(getClientIp(req)).toBe('unknown')
  })
})

describe('rateLimitHeaders', () => {
  it('includes limit/remaining/reset headers when allowed', () => {
    const result = { allowed: true, remaining: 4, resetAt: 1_700_000_000_000, retryAfter: 0 }
    const headers = rateLimitHeaders(result, { windowMs: 60_000, max: 5 })
    expect(headers['X-RateLimit-Limit']).toBe('5')
    expect(headers['X-RateLimit-Remaining']).toBe('4')
    expect(headers['Retry-After']).toBeUndefined()
  })

  it('includes Retry-After when blocked', () => {
    const result = { allowed: false, remaining: 0, resetAt: 1_700_000_000_000, retryAfter: 30 }
    const headers = rateLimitHeaders(result, { windowMs: 60_000, max: 5 })
    expect(headers['Retry-After']).toBe('30')
  })
})

describe('RATE_LIMITS presets', () => {
  it('login preset has correct max', () => {
    expect(RATE_LIMITS.login.max).toBe(5)
    expect(RATE_LIMITS.login.windowMs).toBe(15 * 60 * 1000)
  })

  it('api preset has correct max', () => {
    expect(RATE_LIMITS.api.max).toBe(200)
  })
})
