import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  computeLifecycle,
  needsStatusSync,
  GRACE_PERIOD_DAYS,
  WARN_DAYS_TRIAL,
  WARN_DAYS_ACTIVE,
  type SubscriptionRow,
} from '../subscription'

function daysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function makeRow(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id:            'sub-1',
    company_id:    'co-1',
    plan:          'pro',
    status:        'active',
    start_date:    daysFromNow(-30),
    end_date:      daysFromNow(30),
    trial_ends_at: null,
    notes:         null,
    ...overrides,
  }
}

describe('computeLifecycle', () => {
  it('returns expired+blocked for null row', () => {
    const r = computeLifecycle(null)
    expect(r.isBlocked).toBe(true)
    expect(r.status).toBe('expired')
  })

  it('returns blocked for suspended', () => {
    const r = computeLifecycle(makeRow({ status: 'suspended' }))
    expect(r.isBlocked).toBe(true)
    expect(r.status).toBe('suspended')
  })

  it('returns blocked for cancelled', () => {
    const r = computeLifecycle(makeRow({ status: 'cancelled' }))
    expect(r.isBlocked).toBe(true)
    expect(r.status).toBe('cancelled')
  })

  it('active subscription with future end_date is not blocked', () => {
    const r = computeLifecycle(makeRow({ end_date: daysFromNow(30) }))
    expect(r.status).toBe('active')
    expect(r.isBlocked).toBe(false)
    expect(r.daysLeft).toBeGreaterThan(0)
  })

  it('active subscription with no end_date is perpetual', () => {
    const r = computeLifecycle(makeRow({ end_date: null }))
    expect(r.status).toBe('active')
    expect(r.isBlocked).toBe(false)
    expect(r.daysLeft).toBeNull()
  })

  it('shows renewal banner when ≤ WARN_DAYS_ACTIVE left', () => {
    const r = computeLifecycle(makeRow({ end_date: daysFromNow(WARN_DAYS_ACTIVE - 1) }))
    expect(r.showRenewalBanner).toBe(true)
  })

  it('no renewal banner when > WARN_DAYS_ACTIVE left', () => {
    const r = computeLifecycle(makeRow({ end_date: daysFromNow(WARN_DAYS_ACTIVE + 1) }))
    expect(r.showRenewalBanner).toBe(false)
  })

  it('active subscription past end_date enters grace period', () => {
    const r = computeLifecycle(makeRow({ end_date: daysFromNow(-1) }))
    expect(r.status).toBe('grace')
    expect(r.isBlocked).toBe(false)
    expect(r.showGraceBanner).toBe(true)
    expect(r.graceDaysLeft).toBeGreaterThan(0)
  })

  it('active subscription past grace period is expired+blocked', () => {
    const r = computeLifecycle(makeRow({ end_date: daysFromNow(-(GRACE_PERIOD_DAYS + 1)) }))
    expect(r.status).toBe('expired')
    expect(r.isBlocked).toBe(true)
    expect(r.graceDaysLeft).toBeNull()
  })

  it('trialing with future trial end is not blocked', () => {
    const r = computeLifecycle(makeRow({
      status:        'trialing',
      end_date:      null,
      trial_ends_at: daysFromNow(5),
    }))
    expect(r.status).toBe('trialing')
    expect(r.isBlocked).toBe(false)
  })

  it('trialing shows trial banner when ≤ WARN_DAYS_TRIAL left', () => {
    const r = computeLifecycle(makeRow({
      status:        'trialing',
      end_date:      null,
      trial_ends_at: daysFromNow(WARN_DAYS_TRIAL - 1),
    }))
    expect(r.showTrialBanner).toBe(true)
  })

  it('trialing past trial end enters grace period', () => {
    const r = computeLifecycle(makeRow({
      status:        'trialing',
      end_date:      null,
      trial_ends_at: daysFromNow(-1),
    }))
    expect(r.status).toBe('grace')
    expect(r.isBlocked).toBe(false)
  })

  it('trialing past grace period is expired', () => {
    const r = computeLifecycle(makeRow({
      status:        'trialing',
      end_date:      null,
      trial_ends_at: daysFromNow(-(GRACE_PERIOD_DAYS + 2)),
    }))
    expect(r.status).toBe('expired')
    expect(r.isBlocked).toBe(true)
  })
})

describe('needsStatusSync', () => {
  it('returns false when DB status matches computed', () => {
    const row      = makeRow({ status: 'active' })
    const computed = computeLifecycle(row)
    expect(needsStatusSync(row, computed)).toBe(false)
  })

  it('returns true for active→grace transition', () => {
    const row      = makeRow({ status: 'active', end_date: daysFromNow(-1) })
    const computed = computeLifecycle(row)
    expect(computed.status).toBe('grace')
    expect(needsStatusSync(row, computed)).toBe(true)
  })

  it('returns true for active→expired transition', () => {
    const row      = makeRow({ status: 'active', end_date: daysFromNow(-(GRACE_PERIOD_DAYS + 2)) })
    const computed = computeLifecycle(row)
    expect(computed.status).toBe('expired')
    expect(needsStatusSync(row, computed)).toBe(true)
  })

  it('returns true for trialing→expired transition', () => {
    const row      = makeRow({
      status:        'trialing',
      end_date:      null,
      trial_ends_at: daysFromNow(-(GRACE_PERIOD_DAYS + 2)),
    })
    const computed = computeLifecycle(row)
    expect(computed.status).toBe('expired')
    expect(needsStatusSync(row, computed)).toBe(true)
  })

  it('returns false for suspended (admin-forced, no auto-sync)', () => {
    const row      = makeRow({ status: 'suspended' })
    const computed = computeLifecycle(row)
    expect(needsStatusSync(row, computed)).toBe(false)
  })
})
