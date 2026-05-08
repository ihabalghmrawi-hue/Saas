/**
 * Subscription Checker — runs daily at 01:00 UTC (via Vercel Cron)
 *
 * Actions:
 *   1. Mark active/trialing subscriptions as 'expired' if past grace period
 *   2. Mark 'grace' rows where end_date + GRACE_PERIOD_DAYS < now
 *   3. Log transitions to admin_actions for audit trail
 *
 * Protected by CRON_SECRET header set in Vercel project env vars.
 */

import { NextRequest, NextResponse }  from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { GRACE_PERIOD_DAYS }          from '@/lib/subscription'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function createAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  // Vercel Cron passes Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdmin()
  const now      = new Date()
  const results  = { expired: 0, graceEntered: 0, errors: 0 }

  // ── Fetch subscriptions that need evaluation ─────────────────────────────
  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('id, company_id, status, end_date, trial_ends_at, plan')
    .in('status', ['active', 'trialing', 'grace'])

  if (error) {
    console.error('[cron/subscription-checker] fetch error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  for (const sub of subs ?? []) {
    try {
      const endDate  = sub.end_date       ? new Date(sub.end_date)       : null
      const trialEnd = sub.trial_ends_at  ? new Date(sub.trial_ends_at)  : null

      const effectiveEnd = sub.status === 'trialing' ? trialEnd : endDate
      if (!effectiveEnd) continue

      const graceDeadline = new Date(effectiveEnd.getTime() + GRACE_PERIOD_DAYS * 86_400_000)
      const inGrace       = effectiveEnd < now && now <= graceDeadline
      const pastGrace     = now > graceDeadline

      if (pastGrace && sub.status !== 'expired') {
        // Transition to expired
        const { error: upErr } = await supabase
          .from('subscriptions')
          .update({ status: 'expired' })
          .eq('id', sub.id)

        if (upErr) { results.errors++; continue }

        await supabase.from('admin_actions').insert({
          action:      'subscription.auto_expired',
          target_type: 'subscription',
          target_id:   sub.id,
          details:     {
            company_id: sub.company_id,
            plan:       sub.plan,
            end_date:   sub.end_date,
            previous_status: sub.status,
          },
        })
        results.expired++
      } else if (inGrace && sub.status !== 'grace') {
        // Transition to grace period
        const { error: upErr } = await supabase
          .from('subscriptions')
          .update({ status: 'grace' })
          .eq('id', sub.id)

        if (upErr) { results.errors++; continue }

        await supabase.from('admin_actions').insert({
          action:      'subscription.grace_started',
          target_type: 'subscription',
          target_id:   sub.id,
          details:     {
            company_id:     sub.company_id,
            plan:           sub.plan,
            end_date:       sub.end_date,
            grace_deadline: graceDeadline.toISOString(),
            previous_status: sub.status,
          },
        })
        results.graceEntered++
      }
    } catch (err) {
      console.error('[cron/subscription-checker] row error:', err)
      results.errors++
    }
  }

  console.log('[cron/subscription-checker] done:', results)
  return NextResponse.json({ ok: true, timestamp: now.toISOString(), ...results })
}
