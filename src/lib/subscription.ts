/**
 * Subscription Lifecycle Management
 *
 * States:
 *   trialing  → active  (payment received / admin activation)
 *   active    → grace   (end_date passed but within grace window)
 *   grace     → expired (grace window elapsed)
 *   any       → suspended (admin action)
 *   any       → cancelled (customer cancels)
 *
 * Grace period: 7 days — tenant can still access the system
 * but sees an upgrade banner. After 7 days → fully blocked.
 */

export type LifecycleStatus =
  | 'trialing'
  | 'active'
  | 'grace'       // end_date passed but within GRACE_PERIOD_DAYS
  | 'expired'     // beyond grace period
  | 'suspended'   // admin manually suspended
  | 'cancelled'

export const GRACE_PERIOD_DAYS = 7
export const TRIAL_DAYS        = 14

// Days-left thresholds for warning banners
export const WARN_DAYS_TRIAL   = 3   // show banner when ≤3 trial days left
export const WARN_DAYS_ACTIVE  = 7   // show banner when ≤7 days until renewal

export interface SubscriptionRow {
  id:            string
  company_id:    string
  plan:          string
  status:        string
  start_date:    string | null
  end_date:      string | null
  trial_ends_at: string | null
  notes:         string | null
}

export interface LifecycleResult {
  status:          LifecycleStatus
  daysLeft:        number | null   // null = unlimited / no end date
  isBlocked:       boolean         // cannot access the system
  showGraceBanner: boolean
  showTrialBanner: boolean
  showRenewalBanner: boolean
  graceDaysLeft:   number | null   // if in grace period
}

export function computeLifecycle(row: SubscriptionRow | null | undefined): LifecycleResult {
  const now = Date.now()

  if (!row) {
    return { status: 'expired', daysLeft: 0, isBlocked: true, showGraceBanner: false, showTrialBanner: false, showRenewalBanner: false, graceDaysLeft: null }
  }

  const dbStatus = row.status as LifecycleStatus

  // Admin-forced states take absolute precedence
  if (dbStatus === 'suspended' || dbStatus === 'cancelled') {
    return { status: dbStatus, daysLeft: 0, isBlocked: true, showGraceBanner: false, showTrialBanner: false, showRenewalBanner: false, graceDaysLeft: null }
  }

  // Trial check
  if (dbStatus === 'trialing') {
    const trialEnd = row.trial_ends_at ? new Date(row.trial_ends_at).getTime() : null
    if (trialEnd && trialEnd < now) {
      // Trial expired — treat as grace
      const graceEnd   = trialEnd + GRACE_PERIOD_DAYS * 86_400_000
      const pastGrace  = now > graceEnd
      const graceDaysLeft = pastGrace ? 0 : Math.ceil((graceEnd - now) / 86_400_000)
      return {
        status:           pastGrace ? 'expired' : 'grace',
        daysLeft:         0,
        isBlocked:        pastGrace,
        showGraceBanner:  !pastGrace,
        showTrialBanner:  false,
        showRenewalBanner: false,
        graceDaysLeft:    pastGrace ? null : graceDaysLeft,
      }
    }
    const daysLeft = trialEnd ? Math.ceil((trialEnd - now) / 86_400_000) : null
    return {
      status:           'trialing',
      daysLeft,
      isBlocked:        false,
      showGraceBanner:  false,
      showTrialBanner:  daysLeft !== null && daysLeft <= WARN_DAYS_TRIAL,
      showRenewalBanner: false,
      graceDaysLeft:    null,
    }
  }

  // Active subscription — check end_date
  if (row.end_date) {
    const endMs    = new Date(row.end_date).getTime()
    const daysLeft = Math.ceil((endMs - now) / 86_400_000)

    if (daysLeft > 0) {
      // Still valid
      return {
        status:           'active',
        daysLeft,
        isBlocked:        false,
        showGraceBanner:  false,
        showTrialBanner:  false,
        showRenewalBanner: daysLeft <= WARN_DAYS_ACTIVE,
        graceDaysLeft:    null,
      }
    }

    // end_date has passed — enter grace period
    const graceEnd      = endMs + GRACE_PERIOD_DAYS * 86_400_000
    const pastGrace     = now > graceEnd
    const graceDaysLeft = pastGrace ? 0 : Math.ceil((graceEnd - now) / 86_400_000)

    return {
      status:           pastGrace ? 'expired' : 'grace',
      daysLeft:         0,
      isBlocked:        pastGrace,
      showGraceBanner:  !pastGrace,
      showTrialBanner:  false,
      showRenewalBanner: false,
      graceDaysLeft:    pastGrace ? null : graceDaysLeft,
    }
  }

  // Active with no end_date = perpetual / manual subscription
  return {
    status:           'active',
    daysLeft:         null,
    isBlocked:        false,
    showGraceBanner:  false,
    showTrialBanner:  false,
    showRenewalBanner: false,
    graceDaysLeft:    null,
  }
}

/** Returns true when a subscription row needs its DB status synced */
export function needsStatusSync(row: SubscriptionRow, computed: LifecycleResult): boolean {
  const dbStatus = row.status
  const live     = computed.status
  if (dbStatus === live) return false
  // Only auto-sync trialing→expired and active→expired transitions
  const autoTransitions: Array<[string, LifecycleStatus]> = [
    ['trialing', 'expired'],
    ['trialing', 'grace'],
    ['active',   'expired'],
    ['active',   'grace'],
    ['grace',    'expired'],
  ]
  return autoTransitions.some(([from, to]) => dbStatus === from && live === to)
}
