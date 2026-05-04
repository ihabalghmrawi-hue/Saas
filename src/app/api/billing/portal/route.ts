import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCompanyId } from '@/lib/tenant'
import { createPortalSession } from '@/lib/stripe'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST(_req: NextRequest) {
  const companyId = getCompanyId()
  const supabase  = createClient()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('company_id', companyId)
    .single()

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'لا يوجد اشتراك Stripe مرتبط' }, { status: 404 })
  }

  try {
    const url = await createPortalSession(
      sub.stripe_customer_id,
      `${APP_URL}/dashboard/billing`,
    )
    return NextResponse.json({ url })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
