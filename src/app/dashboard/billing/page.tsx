import { getSubscription, getCompanyId } from '@/lib/tenant'
import { BillingClient } from './billing-client'

export const dynamic = 'force-dynamic'

export default async function BillingPage() {
  const companyId = getCompanyId()
  const sub       = await getSubscription(companyId)
  return <BillingClient subscription={sub} />
}
