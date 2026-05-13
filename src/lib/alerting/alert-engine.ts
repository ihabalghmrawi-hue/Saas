import { createLogger } from '@/lib/observability/logger'

const logger = createLogger('alert-engine')

export type AlertSeverity = 'critical' | 'warning' | 'info'
export type AlertStatus = 'firing' | 'acknowledged' | 'resolved'

export interface Alert {
  id: string
  name: string
  message: string
  severity: AlertSeverity
  status: AlertStatus
  source: string
  metadata: Record<string, unknown>
  firedAt: string
  acknowledgedAt?: string
  acknowledgedBy?: string
  resolvedAt?: string
  resolvedBy?: string
  duration?: number
  count: number
}

export interface AlertRule {
  name: string
  severity: AlertSeverity
  source: string
  description: string
  evaluate: () => Promise<AlertEvaluation>
}

export interface AlertEvaluation {
  firing: boolean
  message: string
  metadata: Record<string, unknown>
}

type AlertHandler = (alert: Alert) => Promise<void>

let rules = new Map<string, AlertRule>()
let activeAlerts = new Map<string, Alert>()
let handlers = new Map<string, AlertHandler[]>()

export function configureAlertStores(stores: {
  rules?: Map<string, AlertRule>
  activeAlerts?: Map<string, Alert>
  handlers?: Map<string, AlertHandler[]>
}): void {
  if (stores.rules) rules = stores.rules
  if (stores.activeAlerts) activeAlerts = stores.activeAlerts
  if (stores.handlers) handlers = stores.handlers
}

export function registerAlertRule(rule: AlertRule): void {
  rules.set(rule.name, rule)
}

export function onAlert(alertName: string, handler: AlertHandler): void {
  const existing = handlers.get(alertName) || []
  existing.push(handler)
  handlers.set(alertName, existing)
}

export function onAnyAlert(handler: AlertHandler): void {
  const existing = handlers.get('*') || []
  existing.push(handler)
  handlers.set('*', existing)
}

async function dispatchAlert(alert: Alert): Promise<void> {
  const specific = handlers.get(alert.name) || []
  const wildcard = handlers.get('*') || []

  for (const handler of [...specific, ...wildcard]) {
    try {
      await handler(alert)
    } catch (error) {
      logger.error(`Alert handler failed for ${alert.name}`, error instanceof Error ? error : undefined, { alert })
    }
  }
}

export async function evaluateAlerts(): Promise<Alert[]> {
  const fired: Alert[] = []

  for (const [, rule] of rules) {
    try {
      const evaluation = await rule.evaluate()

      if (evaluation.firing) {
        const existing = activeAlerts.get(rule.name)
        const now = new Date().toISOString()

        if (existing) {
          const updated: Alert = {
            ...existing,
            message: evaluation.message,
            metadata: evaluation.metadata,
            count: existing.count + 1,
            duration: existing.firedAt ? Date.now() - new Date(existing.firedAt).getTime() : undefined,
          }
          activeAlerts.set(rule.name, updated)
          fired.push(updated)
        } else {
          const alert: Alert = {
            id: `${rule.name}_${Date.now()}`,
            name: rule.name,
            message: evaluation.message,
            severity: rule.severity,
            status: 'firing',
            source: rule.source,
            metadata: evaluation.metadata,
            firedAt: now,
            count: 1,
          }
          activeAlerts.set(rule.name, alert)
          fired.push(alert)
        }
      } else {
        const existing = activeAlerts.get(rule.name)
        if (existing) {
          const resolved: Alert = {
            ...existing,
            status: 'resolved',
            resolvedAt: new Date().toISOString(),
            duration: existing.firedAt ? Date.now() - new Date(existing.firedAt).getTime() : undefined,
          }
          activeAlerts.delete(rule.name)
          fired.push(resolved)
        }
      }
    } catch (error) {
      logger.error(`Alert rule evaluation failed: ${rule.name}`, error instanceof Error ? error : undefined)
    }
  }

  for (const alert of fired) {
    await dispatchAlert(alert)
  }

  return fired
}

export function acknowledgeAlert(name: string, by: string): Alert | undefined {
  const alert = activeAlerts.get(name)
  if (!alert) return undefined

  const updated: Alert = {
    ...alert,
    status: 'acknowledged',
    acknowledgedAt: new Date().toISOString(),
    acknowledgedBy: by,
  }
  activeAlerts.set(name, updated)
  return updated
}

export function getActiveAlerts(): Alert[] {
  return Array.from(activeAlerts.values()).filter(a => a.status === 'firing' || a.status === 'acknowledged')
}

export function getAlertHistory(): Alert[] {
  return Array.from(activeAlerts.values())
}

export function getAlertsBySeverity(severity: AlertSeverity): Alert[] {
  return getActiveAlerts().filter(a => a.severity === severity)
}

export function registerDefaultAlertHandlers(sendNotification: (alert: Alert) => Promise<void>, sendWebhook: (alert: Alert) => Promise<void>): void {
  onAnyAlert(async (alert) => {
    logger.info(`Alert: [${alert.severity}] ${alert.name} - ${alert.message}`, {
      alert: { name: alert.name, severity: alert.severity, status: alert.status },
    })
  })

  onAnyAlert(sendNotification)

  onAnyAlert(sendWebhook)
}
