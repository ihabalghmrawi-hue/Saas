import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'
import {
  getOrCreateStripeCustomer,
  createCheckoutSession,
} from '@/lib/stripe'
import { PLAN_PRICING } from '@/lib/plans'
import type { Plan } from '@/lib/plans'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST(req: NextRequest) {
  const { plan } = await req.json() as { plan: Plan }

  if (!['basic', 'pro'].includes(plan)) {
    return NextResponse.json({ error: 'خطة غير صالحة' }, { status: 400 })
  }

  const pricing = PLAN_PRICING[plan]
  if (!pricing.stripePriceId) {
    return NextResponse.json({ error: 'Stripe price ID غير مُعد — تحقق من متغيرات البيئة' }, { status: 500 })
  }

  const companyId = getCompanyId()
  const supabase  = createClient()

  // Get company info for Stripe customer creation
  const { data: company } = await supabase
    .from('companies')
    .select('name, email')
    .eq('id', companyId)
    .single()

  // Get subscription to check for existing Stripe customer
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('company_id', companyId)
    .single()

  let customerId = sub?.stripe_customer_id
  if (!customerId) {
    try {
      customerId = await getOrCreateStripeCustomer(
        companyId,
        company?.email || '',
        company?.name  || 'شركة',
      )
      // Save customer ID
      await supabase.from('subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('company_id', companyId)
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  try {
    const url = await createCheckoutSession({
      companyId,
      customerId,
      priceId:    pricing.stripePriceId,
      successUrl: `${APP_URL}/dashboard/billing?success=1&plan=${plan}`,
      cancelUrl:  `${APP_URL}/dashboard/billing?canceled=1`,
    })
    return NextResponse.json({ url })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
