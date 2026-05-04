// Stripe webhook handler — processes all billing events
// Must be excluded from auth middleware (it uses raw body + Stripe signature)
import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import type Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Raw body needed for Stripe signature verification
export async function POST(req: NextRequest) {
  const payload   = await req.text()
  const signature = req.headers.get('stripe-signature') || ''

  let event: Stripe.Event
  try {
    event = constructWebhookEvent(payload, signature)
  } catch (e: any) {
    return NextResponse.json({ error: `Webhook signature invalid: ${e.message}` }, { status: 400 })
  }

  const supabase = createClient()

  // Idempotency — skip if already processed
  const { data: existing } = await supabase
    .from('stripe_webhook_log')
    .select('id')
    .eq('event_id', event.id)
    .single()
  if (existing) return NextResponse.json({ ok: true, skipped: true })

  let companyId: string | null = null
  let error: string | null     = null

  try {
    switch (event.type) {

      // ── Checkout completed → activate subscription ──────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        companyId     = session.metadata?.company_id || null
        if (!companyId) break

        await supabase.from('subscriptions').upsert({
          company_id:             companyId,
          stripe_customer_id:     session.customer as string,
          stripe_subscription_id: session.subscription as string,
          status:                 'active',
          updated_at:             new Date().toISOString(),
        }, { onConflict: 'company_id' })
        break
      }

      // ── Invoice paid → mark active, update period ──────────────────────────
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const subId   = invoice.subscription as string
        if (!subId) break

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('company_id')
          .eq('stripe_subscription_id', subId)
          .single()
        companyId = sub?.company_id || null
        if (!companyId) break

        await supabase.from('subscriptions').update({
          status:               'active',
          current_period_start: new Date(invoice.period_start * 1000).toISOString(),
          current_period_end:   new Date(invoice.period_end   * 1000).toISOString(),
          updated_at:           new Date().toISOString(),
        }).eq('company_id', companyId)
        break
      }

      // ── Invoice payment failed ─────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subId   = invoice.subscription as string
        if (!subId) break

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('company_id')
          .eq('stripe_subscription_id', subId)
          .single()
        companyId = sub?.company_id || null
        if (!companyId) break

        await supabase.from('subscriptions').update({
          status:     'past_due',
          updated_at: new Date().toISOString(),
        }).eq('company_id', companyId)
        break
      }

      // ── Subscription updated (plan change, trial end, etc.) ────────────────
      case 'customer.subscription.updated': {
        const sub   = event.data.object as Stripe.Subscription
        companyId   = sub.metadata?.company_id || null

        if (!companyId) {
          const { data: row } = await supabase
            .from('subscriptions')
            .select('company_id')
            .eq('stripe_subscription_id', sub.id)
            .single()
          companyId = row?.company_id || null
        }
        if (!companyId) break

        const priceId   = sub.items.data[0]?.price?.id || ''
        const planBasic = process.env.STRIPE_PRICE_BASIC || ''
        const planPro   = process.env.STRIPE_PRICE_PRO   || ''
        const plan      = priceId === planPro ? 'pro' : priceId === planBasic ? 'basic' : 'free'

        await supabase.from('subscriptions').update({
          stripe_subscription_id: sub.id,
          stripe_customer_id:     sub.customer as string,
          plan,
          status:                 sub.status,
          cancel_at_period_end:   sub.cancel_at_period_end,
          current_period_start:   new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end:     new Date(sub.current_period_end   * 1000).toISOString(),
          trial_ends_at:          sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          updated_at:             new Date().toISOString(),
        }).eq('company_id', companyId)
        break
      }

      // ── Subscription canceled ──────────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const { data: row } = await supabase
          .from('subscriptions')
          .select('company_id')
          .eq('stripe_subscription_id', sub.id)
          .single()
        companyId = row?.company_id || null
        if (!companyId) break

        await supabase.from('subscriptions').update({
          status:     'canceled',
          plan:       'free',
          updated_at: new Date().toISOString(),
        }).eq('company_id', companyId)
        break
      }

      default:
        break
    }
  } catch (e: any) {
    error = e.message
    console.error('Webhook handler error:', e)
  }

  // Log every event
  await supabase.from('stripe_webhook_log').insert({
    event_id:   event.id,
    event_type: event.type,
    company_id: companyId,
    payload:    event.data.object,
    error,
  }).then(() => {})

  return NextResponse.json({ ok: true })
}
