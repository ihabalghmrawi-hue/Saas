// ─── Stripe client (server-side only) ────────────────────────────────────────
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is not set — billing features will be disabled')
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null

export function requireStripe(): Stripe {
  if (!stripe) throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.')
  return stripe
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export async function getOrCreateStripeCustomer(
  companyId:   string,
  email:       string,
  companyName: string,
): Promise<string> {
  const s = requireStripe()

  // Search for existing customer
  const existing = await s.customers.search({
    query: `metadata['company_id']:'${companyId}'`,
    limit: 1,
  })
  if (existing.data.length > 0) return existing.data[0].id

  const customer = await s.customers.create({
    email,
    name:     companyName,
    metadata: { company_id: companyId },
  })
  return customer.id
}

export async function createCheckoutSession(opts: {
  companyId:    string
  customerId:   string
  priceId:      string
  successUrl:   string
  cancelUrl:    string
  trialDays?:   number
}): Promise<string> {
  const s = requireStripe()
  const session = await s.checkout.sessions.create({
    customer:    opts.customerId,
    mode:        'subscription',
    line_items:  [{ price: opts.priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url:  opts.cancelUrl,
    subscription_data: {
      trial_period_days: opts.trialDays,
      metadata: { company_id: opts.companyId },
    },
    metadata: { company_id: opts.companyId },
    allow_promotion_codes: true,
  })
  return session.url!
}

export async function createPortalSession(
  customerId:  string,
  returnUrl:   string,
): Promise<string> {
  const s = requireStripe()
  const session = await s.billingPortal.sessions.create({
    customer:   customerId,
    return_url: returnUrl,
  })
  return session.url
}

export function constructWebhookEvent(
  payload:   string | Buffer,
  signature: string,
): Stripe.Event {
  const s       = requireStripe()
  const secret  = process.env.STRIPE_WEBHOOK_SECRET!
  return s.webhooks.constructEvent(payload, signature, secret)
}
