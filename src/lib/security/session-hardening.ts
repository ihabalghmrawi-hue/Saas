import { createLogger } from '@/lib/observability/logger'
import { incrementCounter } from '@/lib/metrics/collector'

const logger = createLogger('session-hardening')

export interface SessionPolicy {
  maxSessionDuration: number
  idleTimeout: number
  maxConcurrentSessions: number
  requireMfa: boolean
  enforceIpBinding: boolean
  enforceDeviceBinding: boolean
  rotationInterval: number
}

export interface SessionInfo {
  sessionId: string
  userId: string
  tenantId: string
  ipAddress: string
  deviceFingerprint: string
  userAgent: string
  createdAt: number
  lastActivityAt: number
  expiresAt: number
  mfaVerified: boolean
  tokenVersion: number
}

interface LoginAnomaly {
  type: 'new_ip' | 'new_device' | 'suspicious_geo' | 'off_hours' | 'rapid_fire'
  userId: string
  severity: 'low' | 'medium' | 'high'
  details: Record<string, unknown>
}

let activeSessions = new Map<string, SessionInfo>()
let loginHistory = new Map<string, Array<{ ip: string; device: string; timestamp: number; success: boolean }>>()
let anomalyLog: LoginAnomaly[] = []

export function configureSessionStores(stores: {
  activeSessions?: Map<string, SessionInfo>
  loginHistory?: Map<string, Array<{ ip: string; device: string; timestamp: number; success: boolean }>>
  anomalyLog?: LoginAnomaly[]
}): void {
  if (stores.activeSessions) activeSessions = stores.activeSessions
  if (stores.loginHistory) loginHistory = stores.loginHistory
  if (stores.anomalyLog) anomalyLog = stores.anomalyLog
}

const DEFAULT_POLICY: SessionPolicy = {
  maxSessionDuration: 43200000,
  idleTimeout: 1800000,
  maxConcurrentSessions: 5,
  requireMfa: false,
  enforceIpBinding: true,
  enforceDeviceBinding: true,
  rotationInterval: 3600000,
}

export function createSession(
  userId: string,
  tenantId: string,
  ipAddress: string,
  deviceFingerprint: string,
  userAgent: string,
  policy: SessionPolicy = DEFAULT_POLICY,
): SessionInfo {
  const now = Date.now()
  const sessionId = `sess_${userId}_${now}_${Math.random().toString(36).slice(2, 8)}`

  const existing = getActiveSessions(userId)
  if (existing.length >= policy.maxConcurrentSessions) {
    const oldest = existing.sort((a, b) => a.createdAt - b.createdAt)[0]
    activeSessions.delete(oldest.sessionId)
    logger.warn(`Session evicted: ${oldest.sessionId} — max concurrent sessions reached`, { data: { userId, maxSessions: policy.maxConcurrentSessions } })
  }

  const session: SessionInfo = {
    sessionId,
    userId,
    tenantId,
    ipAddress,
    deviceFingerprint,
    userAgent,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: now + policy.maxSessionDuration,
    mfaVerified: false,
    tokenVersion: 1,
  }

  activeSessions.set(sessionId, session)
  recordLoginAttempt(userId, ipAddress, deviceFingerprint, true)
  incrementCounter('sessions_created_total', { tenantId })
  logger.info(`Session created: ${sessionId}`, { userId, tenantId })

  return session
}

export function validateSession(
  sessionId: string,
  ipAddress: string,
  deviceFingerprint: string,
  policy: SessionPolicy = DEFAULT_POLICY,
): { valid: boolean; reason?: string; session?: SessionInfo } {
  const session = activeSessions.get(sessionId)
  if (!session) return { valid: false, reason: 'Session not found' }

  const now = Date.now()

  if (now > session.expiresAt) {
    activeSessions.delete(sessionId)
    incrementCounter('sessions_expired_total', { reason: 'max_duration' })
    return { valid: false, reason: 'Session expired' }
  }

  if (now - session.lastActivityAt > policy.idleTimeout) {
    activeSessions.delete(sessionId)
    incrementCounter('sessions_expired_total', { reason: 'idle_timeout' })
    return { valid: false, reason: 'Session idle timeout' }
  }

  if (policy.enforceIpBinding && session.ipAddress !== ipAddress) {
    incrementCounter('sessions_rejected_total', { reason: 'ip_mismatch' })
    return { valid: false, reason: 'IP address mismatch' }
  }

  if (policy.enforceDeviceBinding && session.deviceFingerprint !== deviceFingerprint) {
    incrementCounter('sessions_rejected_total', { reason: 'device_mismatch' })
    return { valid: false, reason: 'Device fingerprint mismatch' }
  }

  session.lastActivityAt = now
  return { valid: true, session }
}

export function touchSession(sessionId: string): void {
  const session = activeSessions.get(sessionId)
  if (session) {
    session.lastActivityAt = Date.now()
  }
}

export function destroySession(sessionId: string): void {
  const session = activeSessions.get(sessionId)
  if (session) {
    activeSessions.delete(sessionId)
    incrementCounter('sessions_destroyed_total', { tenantId: session.tenantId })
    logger.info(`Session destroyed: ${sessionId}`)
  }
}

export function destroyAllUserSessions(userId: string): number {
  let count = 0
  for (const [, session] of activeSessions) {
    if (session.userId === userId) {
      activeSessions.delete(session.sessionId)
      count++
    }
  }
  logger.info(`Destroyed ${count} sessions for user ${userId}`)
  return count
}

export function getActiveSessions(userId?: string): SessionInfo[] {
  const all = Array.from(activeSessions.values())
  return userId ? all.filter(s => s.userId === userId) : all
}

export function rotateToken(sessionId: string): { success: boolean; newVersion?: number } {
  const session = activeSessions.get(sessionId)
  if (!session) return { success: false }

  session.tokenVersion++
  incrementCounter('session_token_rotations_total')
  return { success: true, newVersion: session.tokenVersion }
}

function recordLoginAttempt(userId: string, ip: string, device: string, success: boolean): void {
  const key = userId
  const history = loginHistory.get(key) || []
  history.push({ ip, device, timestamp: Date.now(), success })

  if (history.length > 100) history.shift()
  loginHistory.set(key, history)

  detectLoginAnomalies(userId, ip, device, history)
}

function detectLoginAnomalies(userId: string, ip: string, device: string, history: Array<{ ip: string; device: string; timestamp: number; success: boolean }>): void {
  const recent = history.filter(h => Date.now() - h.timestamp < 300000)

  if (recent.filter(h => !h.success).length >= 5) {
    anomalyLog.push({ type: 'rapid_fire', userId, severity: 'high', details: { attempts: recent.filter(h => !h.success).length, ip } })
  }

  const knownIps = new Set(history.map(h => h.ip))
  if (!knownIps.has(ip) && history.length >= 5) {
    anomalyLog.push({ type: 'new_ip', userId, severity: 'medium', details: { ip, previousIps: Array.from(knownIps).slice(-3) } })
  }

  const knownDevices = new Set(history.map(h => h.device))
  if (!knownDevices.has(device) && history.length >= 3) {
    anomalyLog.push({ type: 'new_device', userId, severity: 'low', details: { device, previousDevices: Array.from(knownDevices).slice(-3) } })
  }
}

export function getLoginAnomalies(userId?: string, minSeverity: LoginAnomaly['severity'] = 'low'): LoginAnomaly[] {
  const severityOrder = { low: 0, medium: 1, high: 2 }
  const minLevel = severityOrder[minSeverity]

  return anomalyLog.filter(a => {
    if (userId && a.userId !== userId) return false
    return severityOrder[a.severity] >= minLevel
  })
}

export function clearAnomalies(): void {
  anomalyLog.length = 0
}
