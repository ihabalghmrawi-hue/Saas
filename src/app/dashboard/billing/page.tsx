import { getSubscription, getCompanyId } from '@/lib/tenant'
import { buildSubscriptionContext } from '@/lib/plans'
import { BillingClient } from './billing-client'

export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const companyId = getCompanyId()

  let sub
  try {
    sub = await getSubscription(companyId)
  } catch {
    sub = buildSubscriptionContext({ company_id: companyId, plan: 'free', status: 'active' })
  }

  return <BillingClient subscription={sub} />
}
