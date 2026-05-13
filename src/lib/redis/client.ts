import Redis, { Redis as RedisClient, RedisOptions } from 'ioredis'

let defaultClient: RedisClient | null = null
let defaultCluster: any = null

export interface RedisHealth {
  ok: boolean
  latency: number
  info: {
    version: string
    usedMemory: string
    connectedClients: string
    uptimeInSeconds: number
    hitRate: string
  }
}

export interface RedisConfig {
  url?: string
  host?: string
  port?: number
  password?: string
  db?: number
  keyPrefix?: string
  enableReadyCheck?: boolean
  maxRetriesPerRequest?: number
  retryStrategy?: (times: number) => number | void | null
  lazyConnect?: boolean
  tls?: { [key: string]: any }
  sentinels?: { host: string; port: number }[]
  clusterNodes?: { host: string; port: number }[]
  slotStart?: number
  slotEnd?: number
  enableAutoPipelining?: boolean
}

export function getDefaultConfig(): RedisConfig {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'finance:',
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableAutoPipelining: true,
    retryStrategy: (times: number) => {
      if (times > 10) return null
      return Math.min(times * 100, 3000)
    },
  }
}

export function createClient(config?: RedisConfig): RedisClient {
  const cfg = { ...getDefaultConfig(), ...config }

  if (cfg.clusterNodes && cfg.clusterNodes.length > 0) {
    const RedisCluster = require('ioredis').Cluster
    const cluster = new RedisCluster(cfg.clusterNodes, {
      redisOptions: {
        password: cfg.password,
        db: cfg.db,
        keyPrefix: cfg.keyPrefix,
        enableReadyCheck: cfg.enableReadyCheck,
        maxRetriesPerRequest: cfg.maxRetriesPerRequest,
        lazyConnect: cfg.lazyConnect,
        retryStrategy: cfg.retryStrategy,
      },
      enableAutoPipelining: cfg.enableAutoPipelining,
    })
    defaultCluster = cluster
    return cluster as unknown as RedisClient
  }

  if (cfg.sentinels && cfg.sentinels.length > 0) {
    const client = new Redis({
      sentinels: cfg.sentinels,
      name: 'mymaster',
      password: cfg.password,
      db: cfg.db,
      keyPrefix: cfg.keyPrefix,
      enableReadyCheck: cfg.enableReadyCheck,
      maxRetriesPerRequest: cfg.maxRetriesPerRequest,
      lazyConnect: cfg.lazyConnect,
      retryStrategy: cfg.retryStrategy,
      enableAutoPipelining: cfg.enableAutoPipelining,
    })
    return client
  }

  const client = new Redis({
    host: cfg.host,
    port: cfg.port,
    password: cfg.password,
    db: cfg.db,
    keyPrefix: cfg.keyPrefix,
    enableReadyCheck: cfg.enableReadyCheck,
    maxRetriesPerRequest: cfg.maxRetriesPerRequest,
    lazyConnect: cfg.lazyConnect,
    retryStrategy: cfg.retryStrategy,
    tls: cfg.tls,
    enableAutoPipelining: cfg.enableAutoPipelining,
  } as RedisOptions)

  return client
}

export function getDefaultClient(config?: RedisConfig): RedisClient {
  if (!defaultClient) {
    defaultClient = createClient(config)
  }
  return defaultClient
}

export function setDefaultClient(client: RedisClient): void {
  defaultClient = client
}

export async function connectClient(client: RedisClient): Promise<void> {
  if (client.status === 'ready' || client.status === 'connecting') return
  await client.connect()
}

export async function disconnectClient(client: RedisClient): Promise<void> {
  if (client.status === 'end' || client.status === 'close') return
  await client.quit()
}

export async function checkRedisHealth(client: RedisClient): Promise<RedisHealth> {
  const start = Date.now()
  const pong = await client.ping()
  const latency = Date.now() - start
  if (pong !== 'PONG') throw new Error('Redis ping failed')

  const infoRaw = await client.info()
  const info: RedisHealth['info'] = {
    version: '',
    usedMemory: '',
    connectedClients: '',
    uptimeInSeconds: 0,
    hitRate: '0',
  }
  for (const line of infoRaw.split('\r\n')) {
    if (line.startsWith('redis_version:')) info.version = line.split(':')[1]
    if (line.startsWith('used_memory_human:')) info.usedMemory = line.split(':')[1]
    if (line.startsWith('connected_clients:')) info.connectedClients = line.split(':')[1]
    if (line.startsWith('uptime_in_seconds:')) info.uptimeInSeconds = parseInt(line.split(':')[1], 10)
    if (line.startsWith('keyspace_hitrate:')) info.hitRate = line.split(':')[1]
  }

  return { ok: true, latency, info }
}

export async function flushDefaultClient(): Promise<void> {
  if (defaultClient) {
    await disconnectClient(defaultClient)
    defaultClient = null
  }
}

export { RedisClient }
export type { Redis }
