import { RedisClient } from './client'

const SESSION_PREFIX = 'session:'
const USER_SESSIONS_PREFIX = 'user-sessions:'
const DEFAULT_TTL = 86_400_000
const MAX_CONCURRENT_SESSIONS = 10

export interface SessionData {
  userId: string
  role: string
  tenantId?: string
  ip?: string
  device?: string
  userAgent?: string
  metadata?: Record<string, any>
  createdAt: number
  lastAccessedAt: number
}

export interface SessionInfo {
  id: string
  data: SessionData
  expiresAt: number
}

export class DistributedSessionStore {
  private client: RedisClient

  constructor(client: RedisClient) {
    this.client = client
  }

  async createSession(
    userId: string,
    data: Omit<SessionData, 'createdAt' | 'lastAccessedAt'>,
    ttl = DEFAULT_TTL
  ): Promise<SessionInfo> {
    const id = generateSessionId()
    const now = Date.now()
    const sessionData: SessionData = {
      ...data,
      userId,
      createdAt: now,
      lastAccessedAt: now,
    }

    const sessionKey = `${SESSION_PREFIX}${id}`
    const pipeline = this.client.pipeline()
    pipeline.set(sessionKey, JSON.stringify(sessionData))
    pipeline.pexpire(sessionKey, ttl)
    pipeline.sadd(`${USER_SESSIONS_PREFIX}${userId}`, id)
    pipeline.pexpire(`${USER_SESSIONS_PREFIX}${userId}`, ttl)
    await pipeline.exec()

    await this.enforceSessionLimit(userId)

    return { id, data: sessionData, expiresAt: now + ttl }
  }

  async getSession(sessionId: string): Promise<SessionInfo | null> {
    const sessionKey = `${SESSION_PREFIX}${sessionId}`
    const data = await this.client.get(sessionKey)
    if (!data) return null

    const sessionData: SessionData = JSON.parse(data)
    const ttl = await this.client.pttl(sessionKey)
    return { id: sessionId, data: sessionData, expiresAt: Date.now() + ttl }
  }

  async updateSession(sessionId: string, updates: Partial<SessionData>): Promise<boolean> {
    const sessionKey = `${SESSION_PREFIX}${sessionId}`
    const data = await this.client.get(sessionKey)
    if (!data) return false

    const sessionData: SessionData = JSON.parse(data)
    Object.assign(sessionData, updates, { lastAccessedAt: Date.now() })
    await this.client.set(sessionKey, JSON.stringify(sessionData))
    return true
  }

  async touchSession(sessionId: string): Promise<boolean> {
    return this.updateSession(sessionId, {})
  }

  async destroySession(sessionId: string): Promise<boolean> {
    const sessionKey = `${SESSION_PREFIX}${sessionId}`
    const data = await this.client.get(sessionKey)
    if (!data) return false

    const sessionData: SessionData = JSON.parse(data)
    const pipeline = this.client.pipeline()
    pipeline.del(sessionKey)
    pipeline.srem(`${USER_SESSIONS_PREFIX}${sessionData.userId}`, sessionId)
    await pipeline.exec()
    return true
  }

  async destroyAllUserSessions(userId: string): Promise<number> {
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`
    const sessionIds = await this.client.smembers(userSessionsKey)
    if (sessionIds.length === 0) return 0

    const pipeline = this.client.pipeline()
    for (const id of sessionIds) {
      pipeline.del(`${SESSION_PREFIX}${id}`)
    }
    pipeline.del(userSessionsKey)
    await pipeline.exec()
    return sessionIds.length
  }

  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    const sessionIds = await this.client.smembers(`${USER_SESSIONS_PREFIX}${userId}`)
    if (sessionIds.length === 0) return []

    const pipeline = this.client.pipeline()
    for (const id of sessionIds) {
      pipeline.get(`${SESSION_PREFIX}${id}`)
    }
    const results = await pipeline.exec()
    if (!results) return []

    const sessions: SessionInfo[] = []
    for (let i = 0; i < sessionIds.length; i++) {
      const data = results[i][1] as string | null
      if (data) {
        sessions.push({
          id: sessionIds[i],
          data: JSON.parse(data),
          expiresAt: Date.now() + DEFAULT_TTL,
        })
      }
    }
    return sessions
  }

  async getActiveSessionCount(userId: string): Promise<number> {
    return this.client.scard(`${USER_SESSIONS_PREFIX}${userId}`)
  }

  async rotateSession(sessionId: string): Promise<SessionInfo | null> {
    const session = await this.getSession(sessionId)
    if (!session) return null

    await this.destroySession(sessionId)
    return this.createSession(session.data.userId, session.data, DEFAULT_TTL)
  }

  private async enforceSessionLimit(userId: string): Promise<void> {
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`
    const count = await this.client.scard(userSessionsKey)
    if (count <= MAX_CONCURRENT_SESSIONS) return

    const sessionIds = await this.client.sort(userSessionsKey, 'BY', 'nosort', 'GET', `${SESSION_PREFIX}*->createdAt`, 'ALPHA')
    const toRemove = count - MAX_CONCURRENT_SESSIONS
    for (let i = 0; i < toRemove && i < sessionIds.length; i++) {
      const id = sessionIds[i]
      await this.client.del(`${SESSION_PREFIX}${id}`)
      await this.client.srem(userSessionsKey, id)
    }
  }

  async getStats(): Promise<{ totalSessions: number; uniqueUsers: number }> {
    let totalSessions = 0
    let cursor = '0'
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', `${SESSION_PREFIX}*`, 'COUNT', 1000)
      cursor = nextCursor
      totalSessions += keys.length
    } while (cursor !== '0')

    let uniqueUsers = 0
    cursor = '0'
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', `${USER_SESSIONS_PREFIX}*`, 'COUNT', 1000)
      cursor = nextCursor
      uniqueUsers += keys.length
    } while (cursor !== '0')

    return { totalSessions, uniqueUsers }
  }
}

function generateSessionId(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}
