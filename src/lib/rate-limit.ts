/**
 * Edge-compatible sliding window rate limiter.
 *
 * Uses an in-memory Map — works within a single Edge / serverless instance.
 * For multi-region distributed rate limiting, upgrade to Upstash Redis:
 *   https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
 *
 * Configured limits:
 *   login  — 5 attempts per 15 minutes per IP
 *   api    — 200 requests per minute per IP+tenant
 *   pin    — 5 attempts per 10 minutes per IP (staff PIN login)
 */

interface Window {
  count:     number
  resetAt:   number
}

// Global store — lives for the duration of the Edge function instance
const store = new Map<string, Window>()

// Prune stale entries every 5 minutes to avoid unbounded memory growth
const PRUNE_INTERVAL = 5 * 60 * 1000
let lastPrune = Date.now()

function pruneIfNeeded() {
  if (Date.now() - lastPrune < PRUNE_INTERVAL) return
  lastPrune = Date.now()
  const now = Date.now()
  for (const [key, win] of store) {
    if (win.resetAt < now) store.delete(key)
  }
}

export interface RateLimitConfig {
  windowMs: number   // sliding window duration in ms
  max:      number   // max requests per window
}

export interface RateLimitResult {
  allowed:    boolean
  remaining:  number
  resetAt:    number   // epoch ms
  retryAfter: number   // seconds until reset
}

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  pruneIfNeeded()

  const now      = Date.now()
  const existing = store.get(key)

  if (!existing || existing.resetAt < now) {
    // New or expired window
    const win: Window = { count: 1, resetAt: now + config.windowMs }
    store.set(key, win)
    return {
      allowed:    true,
      remaining:  config.max - 1,
      resetAt:    win.resetAt,
      retryAfter: 0,
    }
  }

  existing.count++
  const allowed    = existing.count <= config.max
  const remaining  = Math.max(0, config.max - existing.count)
  const retryAfter = allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000)

  return { allowed, remaining, resetAt: existing.resetAt, retryAfter }
}

// ── Preset configs ─────────────────────────────────────────────────────────────

export const RATE_LIMITS = {
  login:  { windowMs: 15 * 60 * 1000, max: 5   },   // 5/15 min — brute-force protection
  pin:    { windowMs: 10 * 60 * 1000, max: 5   },   // 5/10 min — PIN brute-force
  api:    { windowMs:      60 * 1000, max: 200 },   // 200/min  — general API
  export: { windowMs:  5 * 60 * 1000, max: 10  },   // 10/5 min — heavy exports
} satisfies Record<string, RateLimitConfig>

// ── Middleware helper ──────────────────────────────────────────────────────────

export function getClientIp(request: { headers: { get(name: string): string | null } }): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

/** Returns 429 headers when rate-limited */
export function rateLimitHeaders(result: RateLimitResult, config: RateLimitConfig): Record<string, string> {
  return {
    'X-RateLimit-Limit':     String(config.max),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset':     String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed ? {} : { 'Retry-After': String(result.retryAfter) }),
  }
}
