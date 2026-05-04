import { NextResponse } from 'next/server'
import { getSubscription, getCompanyId } from '@/lib/tenant'

export async function GET() {
  const companyId = getCompanyId()
  const sub       = await getSubscription(companyId)
  return NextResponse.json(sub)
}
