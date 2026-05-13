import { getCompanyId, getCurrency } from '@/lib/tenant'
import { IntegrityClient } from './integrity-client'

export const dynamic = 'force-dynamic'

export default async function IntegrityPage() {
  const companyId = await getCompanyId()
  const currency = await getCurrency()

  return <IntegrityClient companyId={companyId} currency={currency} />
}
