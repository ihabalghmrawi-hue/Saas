/**
 * Subscription-level gate policy.
 *
 * Determines whether a tenant can access the system based on computed
 * subscription lifecycle. Use this in API routes and middleware.
 */

import { computeLifecycle, type SubscriptionRow } from '@/lib/subscription'

export interface SubscriptionGate {
  allowed:       boolean
  status:        string
  graceBanner:   boolean
  graceDaysLeft: number | null
  trialBanner:   boolean
  renewalBanner: boolean
  daysLeft:      number | null
}

export class SubscriptionBlockedError extends Error {
  readonly statusCode = 402
  constructor(public readonly status: string) {
    super(status === 'suspended'  ? 'الاشتراك موقوف'
        : status === 'cancelled'  ? 'الاشتراك ملغى'
        : status === 'expired'    ? 'انتهت صلاحية الاشتراك'
        :                           'الاشتراك غير نشط')
    this.name = 'SubscriptionBlockedError'
  }
}

// ── Gate check ────────────────────────────────────────────────────────────────

export function evaluateSubscriptionGate(row: SubscriptionRow | null): SubscriptionGate {
  const lc = computeLifecycle(row)
  return {
    allowed:       !lc.isBlocked,
    status:        lc.status,
    graceBanner:   lc.showGraceBanner,
    graceDaysLeft: lc.graceDaysLeft,
    trialBanner:   lc.showTrialBanner,
    renewalBanner: lc.showRenewalBanner,
    daysLeft:      lc.daysLeft,
  }
}

export function assertSubscriptionAllowed(row: SubscriptionRow | null): SubscriptionGate {
  const gate = evaluateSubscriptionGate(row)
  if (!gate.allowed) throw new SubscriptionBlockedError(gate.status)
  return gate
}

// ── Header helpers (set subscription context on response/request) ─────────────

export function subscriptionHeaders(gate: SubscriptionGate): Record<string, string> {
  return {
    'x-sub-status':    gate.status,
    'x-sub-grace':     gate.graceBanner  ? '1' : '0',
    'x-sub-trial':     gate.trialBanner  ? '1' : '0',
    'x-sub-renewal':   gate.renewalBanner ? '1' : '0',
    'x-sub-days-left': gate.daysLeft != null ? String(gate.daysLeft) : '-1',
  }
}
