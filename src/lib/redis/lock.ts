import { RedisClient } from './client'

const LOCK_PREFIX = 'lock:'
const DEFAULT_TTL = 30_000
const RETRY_DELAY = 100
const MAX_RETRIES = 50

export interface LockOptions {
  ttl?: number
  retryDelay?: number
  maxRetries?: number
  retryCount?: number
}

export interface Lock {
  resource: string
  identifier: string
  expiresAt: number
  release: () => Promise<boolean>
  refresh: (ttl?: number) => Promise<boolean>
}

async function acquireLock(
  client: RedisClient,
  resource: string,
  identifier: string,
  ttl: number
): Promise<boolean> {
  const result = await client.set(
    `${LOCK_PREFIX}${resource}`,
    identifier,
    'PX',
    ttl,
    'NX'
  )
  return result === 'OK'
}

async function releaseLock(
  client: RedisClient,
  resource: string,
  identifier: string
): Promise<boolean> {
  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `
  const result = await client.eval(script, 1, `${LOCK_PREFIX}${resource}`, identifier)
  return result === 1
}

async function refreshLock(
  client: RedisClient,
  resource: string,
  identifier: string,
  ttl: number
): Promise<boolean> {
  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("PEXPIRE", KEYS[1], ARGV[2])
    else
      return 0
    end
  `
  const result = await client.eval(script, 1, `${LOCK_PREFIX}${resource}`, identifier, ttl.toString())
  return result === 1
}

function generateIdentifier(): string {
  return `${process.pid}-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`
}

export async function withLock<T>(
  client: RedisClient,
  resource: string,
  fn: () => Promise<T>,
  options?: LockOptions
): Promise<T> {
  const identifier = generateIdentifier()
  const ttl = options?.ttl ?? DEFAULT_TTL
  const retryDelay = options?.retryDelay ?? RETRY_DELAY
  const maxRetries = options?.maxRetries ?? MAX_RETRIES
  let retries = 0

  while (retries <= maxRetries) {
    const acquired = await acquireLock(client, resource, identifier, ttl)
    if (acquired) {
      try {
        return await fn()
      } finally {
        await releaseLock(client, resource, identifier).catch(() => {})
      }
    }
    if (retries >= maxRetries) {
      throw new LockAcquisitionError(resource, maxRetries)
    }
    retries++
    await sleep(retryDelay * retries)
  }

  throw new LockAcquisitionError(resource, maxRetries)
}

export async function tryLock(
  client: RedisClient,
  resource: string,
  options?: LockOptions
): Promise<Lock | null> {
  const identifier = generateIdentifier()
  const ttl = options?.ttl ?? DEFAULT_TTL
  const acquired = await acquireLock(client, resource, identifier, ttl)

  if (!acquired) return null

  return {
    resource,
    identifier,
    expiresAt: Date.now() + ttl,
    release: () => releaseLock(client, resource, identifier),
    refresh: (newTtl?: number) => refreshLock(client, resource, identifier, newTtl ?? ttl),
  }
}

export class LockAcquisitionError extends Error {
  constructor(resource: string, retries: number) {
    super(`Failed to acquire lock for resource "${resource}" after ${retries} retries`)
    this.name = 'LockAcquisitionError'
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
