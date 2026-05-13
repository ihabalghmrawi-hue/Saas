import { createLogger } from '@/lib/observability/logger'
import { incrementCounter } from '@/lib/metrics/collector'

const logger = createLogger('abuse-detection')

export interface RateLimitState {
  key: string
  windowStart: number
  count: number
  limit: number
  windowMs: number
  blockedUntil: number | null
}

export interface AbuseEvent {
  type: 'rate_limit_exceeded' | 'suspicious_pattern' | 'api_abuse' | 'scraping' | 'credential_stuffing'
  key: string
  ip: string
  tenantId?: string
  userId?: string
  detectedAt: string
  details: Record<string, unknown>
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface EscalationAction {
  type: 'block' | 'captcha' | 'rate_limit_reduce' | 'audit_log' | 'notify_admin'
  duration: number
}

let rateLimitStore = new Map<string, RateLimitState>()
let abuseEvents: AbuseEvent[] = []
let blockedIPs = new Map<string, number>()
let patternStore = new Map<string, { count: number; firstSeen: number; lastSeen: number }>()

export function configureAbuseStores(stores: {
  rateLimitStore?: Map<string, RateLimitState>
  abuseEvents?: AbuseEvent[]
  blockedIPs?: Map<string, number>
  patternStore?: Map<string, { count: number; firstSeen: number; lastSeen: number }>
}): void {
  if (stores.rateLimitStore) rateLimitStore = stores.rateLimitStore
  if (stores.abuseEvents) abuseEvents = stores.abuseEvents
  if (stores.blockedIPs) blockedIPs = stores.blockedIPs
  if (stores.patternStore) patternStore = stores.patternStore
}

const ESCALATION_MATRIX: Record<AbuseEvent['severity'], EscalationAction[]> = {
  low: [{ type: 'rate_limit_reduce', duration: 300000 }],
  medium: [{ type: 'captcha', duration: 600000 }, { type: 'rate_limit_reduce', duration: 1800000 }],
  high: [{ type: 'block', duration: 3600000 }, { type: 'notify_admin', duration: 0 }],
  critical: [{ type: 'block', duration: 86400000 }, { type: 'audit_log', duration: 0 }, { type: 'notify_admin', duration: 0 }],
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  ip: string,
): { allowed: boolean; retryAfter: number; state: RateLimitState } {
  const now = Date.now()
  let state = rateLimitStore.get(key)

  if (!state || now - state.windowStart > windowMs) {
    state = { key, windowStart: now, count: 0, limit, windowMs, blockedUntil: null }
    rateLimitStore.set(key, state)
  }

  if (state.blockedUntil && now < state.blockedUntil) {
    recordAbuseEvent({
      type: 'rate_limit_exceeded', key, ip, detectedAt: new Date().toISOString(),
      details: { blockedUntil: state.blockedUntil, limit, count: state.count },
      severity: 'medium',
    })
    return { allowed: false, retryAfter: Math.ceil((state.blockedUntil - now) / 1000), state }
  }

  state.count++

  if (state.count > limit) {
    const escalation = getEscalation(key, now)
    state.blockedUntil = now + escalation.duration
    incrementCounter('rate_limit_exceeded_total', { key, ip })
    recordAbuseEvent({
      type: 'rate_limit_exceeded', key, ip, detectedAt: new Date().toISOString(),
      details: { limit, count: state.count, escalation: escalation.type },
      severity: getSeverity(key, state.count, limit),
    })
    return { allowed: false, retryAfter: Math.ceil(escalation.duration / 1000), state }
  }

  return { allowed: true, retryAfter: 0, state }
}

function getSeverity(key: string, count: number, limit: number): AbuseEvent['severity'] {
  const ratio = count / limit
  if (ratio > 10) return 'critical'
  if (ratio > 5) return 'high'
  if (ratio > 3) return 'medium'
  return 'low'
}

function getEscalation(key: string, now: number): EscalationAction {
  const violations = Array.from(rateLimitStore.values()).filter(s => s.key.startsWith(key.split(':')[0]))
  const severity: AbuseEvent['severity'] = violations.length > 5 ? 'critical' : violations.length > 3 ? 'high' : 'medium'
  const actions = ESCALATION_MATRIX[severity]
  return actions[0]
}

export function recordAbuseEvent(event: Omit<AbuseEvent, 'id'>): AbuseEvent {
  const full: AbuseEvent = { ...event, id: `abuse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }
  abuseEvents.push(full)
  incrementCounter('abuse_events_total', { type: event.type, severity: event.severity })

  if (event.type === 'rate_limit_exceeded' || event.severity === 'high' || event.severity === 'critical') {
    blockedIPs.set(event.ip, Date.now() + ESCALATION_MATRIX[event.severity][0].duration)
  }

  logger.warn(`Abuse event: [${event.severity}] ${event.type} from ${event.ip}`, undefined, {
    event: full,
  })

  return full
}

export function trackPattern(key: string, windowMs: number, threshold: number): boolean {
  const now = Date.now()
  const state = patternStore.get(key)

  if (!state || now - state.lastSeen > windowMs) {
    patternStore.set(key, { count: 1, firstSeen: now, lastSeen: now })
    return false
  }

  state.count++
  state.lastSeen = now

  if (state.count >= threshold) {
    return true
  }

  return false
}

export function isBlocked(ip: string): boolean {
  const until = blockedIPs.get(ip)
  if (!until) return false
  if (Date.now() > until) {
    blockedIPs.delete(ip)
    return false
  }
  return true
}

export function blockIP(ip: string, durationMs: number): void {
  blockedIPs.set(ip, Date.now() + durationMs)
  logger.warn(`IP blocked: ${ip} for ${durationMs}ms`)
}

export function unblockIP(ip: string): void {
  blockedIPs.delete(ip)
}

export function getBlockedIPs(): string[] {
  const now = Date.now()
  const active: string[] = []
  for (const [ip, until] of blockedIPs) {
    if (now < until) active.push(ip)
  }
  return active
}

export function getAbuseEvents(minSeverity?: AbuseEvent['severity']): AbuseEvent[] {
  const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 }
  return abuseEvents.filter(e => {
    if (minSeverity && severityOrder[e.severity] < severityOrder[minSeverity]) return false
    return true
  })
}

export function clearAbuseState(): void {
  rateLimitStore.clear()
  patternStore.clear()
}
