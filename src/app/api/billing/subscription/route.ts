import { NextResponse } from 'next/server'
import { getSubscription, getCompanyId } from '@/lib/tenant'

export async function GET() {
  try {
    const companyId = getCompanyId()
    const sub       = await getSubscription(companyId)
    return NextResponse.json(sub)
  } catch {
    return NextResponse.json(
      { plan: 'free', status: 'active', isActive: true, isTrialing: false,
        daysLeft: null, currentPeriodEnd: null, cancelAtPeriodEnd: false,
        stripeCustomerId: null, features: {} },
      { status: 200 }
    )
  }
}
